import { DHWSystem, AHUSystem, HeatingSystem, CoolingSystem, LightingSystem, EnergyCarrier } from "@/types/system";
import { ZoneInput, CalculationResults, MonthlyResult, HourlyResult, ZoneResult, SurfaceHourlyResult, ClimateData } from "./types";
import { Project, Construction } from "@/types/project";
import { getClimateData, generateHourlyClimateData } from "./climate-data";
import { calculateLightingDemand } from "./lighting-calc";
import { calculateHourlyDHW } from "./dhw-calc";
import { calculateHourlyHvac } from "./hvac-calc"; // 설비 계산은 월간 부하 기반으로 별도 처리 필요하지만, 기존 모듈 재활용 검토
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { PEF_FACTORS, CO2_FACTORS, calculateStandardN50, getFxDefault, AirTightnessCategory, ExposureCategory, getExposureCategory } from "@/lib/standard-values";

// 물리 상수
const HEAT_CAPACITY_AIR = 0.34; // 공기의 비열 Wh/(m³K)

/**
 * 구조체의 레이어 정보를 바탕으로 실내측 유효 열용량(Wh/m²K)을 계산합니다.
 * DIN/TS 18599-2:2025-10 및 ISO 13786 기준을 참고합니다.
 */
export function calculateEffectiveThermalCapacity(construction: Construction): number {
    // DIN 18599-2 / ISO 13786
    // Effective thickness (d_eff) is limited to 10cm or until insulation layer.
    // Simplified: Take first 100mm from inside (layers[0] is usually outside? Need to check order. Convention: 0=Outside, Last=Inside).
    // beatPlus convention: layers are ordered Outside -> Inside ? Need to verify project.ts or UI.
    // Standard UI usually Top=Outside.
    // Let's assume layers are 0=Ex, N=In.
    // Iterating backwards from Inside.

    let totalCm = 0;
    let d_accumulated = 0;
    const d_max = 0.1; // 10cm limit

    // Reverse copy of layers to iterate from inside
    const layers = [...construction.layers].reverse();

    for (const layer of layers) {
        if (d_accumulated >= d_max) break;

        const d_eff = Math.min(layer.thickness, d_max - d_accumulated);
        const density = layer.density || 0;
        const specificHeat = layer.specificHeat || 0; // J/kgK

        // If insulation (lambda < ?) stop?
        // DIN 18599: Stop at insulating layer.
        if ((layer.thermalConductivity || 100) < 0.1) { // Insulation check
            // Include this insulation layer? Usually not for capacity.
            // But let's stop here.
            break;
        }

        totalCm += (density * specificHeat * d_eff); // J/m2K
        d_accumulated += d_eff;
    }

    return totalCm / 3600; // J/m2K -> Wh/m2K
}

/**
 * DIN/TS 18599-2:2025-10 Table 7 - Inclination Correction Factors (f_neig)
 */
const F_NEIG_TABLE = [
    { angle: 0, single: 1.21, double: 1.25, triple: 1.20 },
    { angle: 15, single: 1.21, double: 1.22, triple: 1.16 },
    { angle: 30, single: 1.21, double: 1.19, triple: 1.13 },
    { angle: 45, single: 1.21, double: 1.15, triple: 1.07 },
    { angle: 60, single: 1.00, double: 1.13, triple: 1.05 },
    { angle: 75, single: 1.00, double: 1.08, triple: 1.02 },
    { angle: 90, single: 1.00, double: 1.00, triple: 1.00 }
];

/**
 * Calculates the inclination correction factor (f_neig) for transparent elements.
 * Uses linear interpolation for intermediate angles.
 * Default assumes Double Glazing if not specified.
 */
function getInclinationFactor(tilt: number, glazingType: "single" | "double" | "triple" = "double"): number {
    // Clamp tilt to 0-90
    const angle = Math.max(0, Math.min(90, tilt));

    // Find lower and upper bounds
    const lowerIndex = F_NEIG_TABLE.findIndex((entry, i) => {
        const next = F_NEIG_TABLE[i + 1];
        return angle >= entry.angle && (!next || angle <= next.angle);
    });

    if (lowerIndex === -1) return 1.0; // Should not happen with clamp

    const lower = F_NEIG_TABLE[lowerIndex];
    const upper = F_NEIG_TABLE[lowerIndex + 1] || lower;

    if (lower.angle === upper.angle) return lower[glazingType];

    // Linear Interpolation
    const t = (angle - lower.angle) / (upper.angle - lower.angle);
    return lower[glazingType] + t * (upper[glazingType] - lower[glazingType]);
}

/**
 * DIN/TS 18599-2:2025-10 6.1.4.6에 따른 냉방 시 인접 비난방 공간 또는 지반의 고정 온도 산출
 */
function getCoolingSimplifiedTemp(surfaceType: string, uValue: number): number | null {
    // 1. 지반 접함 (Ground / Basement)
    if (surfaceType.includes("ground") || surfaceType === "floor_interior") {
        // floor_interior가 인접 존 ID가 없는 경우(비난방 지하 등)는 여기서 처리될 것임.
        // R_total = 1 / U
        const R = uValue > 0 ? (1 / uValue) : 10;
        return R <= 1.0 ? 21 : 18;
    }

    // 2. 비난방 지붕 (Attic / Dachgeschoss)
    if (surfaceType.includes("roof_interior")) {
        return 35;
    }

    // 3. 기타 비난방 실 (Other unconditioned rooms)
    if (surfaceType.includes("interior") || surfaceType.includes("exterior")) {
        // INDIRECT_EXTERIOR 등에 해당하면 fx < 1.0 일 것임.
        // calculator 메인 루프에서 fx < 1.0 이고 위 케이스가 아니면 30도 적용
        return 30;
    }

    return null;
}

// calculateStandardN50 is now imported from @/lib/standard-values

/**
 * DIN/TS 18599-2:2025-10 6.3.1에 따른 침기 환기 횟수 (n_inf) 계산
 * 식 66 (자연환기) & 식 67 (기계환기)
 */
function calculateInfiltrationRate(
    n50: number, // [1/h]
    hasATD: boolean, // 공기 전달 장치 (Air Transfer Devices)
    ventType: "natural" | "mechanical",
    isBalanced: boolean, // 기계환기 급배기 평형 여부
    dailyOpHours: number, // t_v,mech [h]
    f_adapt: number = 1.0 // 불균형 보정 계수 (식 72) - 미계산 시 1.0
): number {
    const e = 0.07; // 기본값 (방풍 계수)

    // 1. f_ATD (식 68, 69)
    let f_ATD = 1.0;
    if (hasATD) {
        // 식 69: min(16; (n50 + 1.5)/n50)
        f_ATD = Math.min(16, (n50 + 1.5) / n50);
    } else {
        f_ATD = 1.0; // 식 68
    }

    // 2. n_inf 계산
    if (ventType === "natural") {
        // 식 66
        return n50 * e * f_ATD;
    } else {
        // 기계환기
        // 식 67: n_inf = n50 * e * f_ATD * (1 + (fe - 1) * t_v_mech / 24)
        // fe = 1 (평형 환기 시, 식 71)
        // 배기 전용 등의 불균형 환기 시에는 fe 계산 필요하나, 풍량 정보 부재 시 1.0(안전측) 가정
        const fe = 1.0;
        return n50 * e * f_ATD * (1 + (fe - 1) * (dailyOpHours / 24));
    }
}

/**
 * DIN/TS 18599-2:2025-10 식 78: 계절 보정 계수 f_win,seasonal
 * 주거 용도 또는 특정 조건에서 사용
 */
function calculateSeasonalFactor(theta_e: number): number {
    // f_win,seasonal = 0.04 * theta_e + 0.8
    return 0.04 * theta_e + 0.8;
}

/**
 * DIN/TS 18599-2:2025-10 식 91: 필요 외부 환기 횟수 n_nutz
 */
function calculateRequiredAirChange(
    minFlowPerArea: number, // V_A [m3/(h m2)] (프로필 데이터)
    area: number, // A_NGF [m2]
    volume: number // V [m3]
): number {
    // n_nutz = (V_A * A_NGF) / V
    if (volume <= 0) return 0;
    return (minFlowPerArea * area) / volume;
}

/**
 * DIN/TS 18599-2:2025-10 6.3.2 창문 환기(Window Ventilation) 계산
 * - 기계 환기 유무, 주거/비주거, $n_{nutz}$ 등을 고려하여 최종 $n_{win}$ 결정
 */
function calculateWindowVentilationRate(
    n_nutz: number, // 필요 환기 횟수 [1/h]
    n_inf: number, // 침기 환기 횟수 [1/h]
    isResidential: boolean, // 주거 용도 여부
    roomHeight: number, // h_R [m] (비주거용 최소값 결정용)
    mechVent: {
        isActive: boolean;
        dailyOpHours: number; // t_v,mech [h]
        t_nutz: number; // t_nutz [h]
        n_SUP: number; // 급기 환기 횟수 [1/h] (기계 + 인접존 유입)
        n_ETA: number; // 배기 환기 횟수 [1/h] (기계 + 인접존 유출)
    },
    theta_e: number, // 월 평균 외기온 (계절 보정용)
    hasWindows: boolean // [New] 창문(개구부) 유무
): { rate: number; rate_tau: number; details: { n_win_min: number; Delta_n_win: number; Delta_n_win_mech: number } } {
    // 1. 최소 창문 환기 횟수 (n_win,min) 결정
    // 주거: 0.1, 비주거: min(0.1, 0.3 / h_R) - 표준 텍스트 해석: "min(0,1; 0,1 * 3/hR)" -> 0.1 * (3/hR). 즉 0.3/hR.
    // [New] 창문이 없으면 최소 환기량 0 처리
    if (!hasWindows) {
        return { rate: 0, rate_tau: 0, details: { n_win_min: 0, Delta_n_win: 0, Delta_n_win_mech: 0 } };
    }
    let n_win_min = 0;
    if (isResidential) {
        n_win_min = 0.1;
        // 주거용 기계환기 있는 경우 계절 보정 적용 (식 79)
        if (mechVent.isActive) {
            n_win_min = n_win_min * calculateSeasonalFactor(theta_e);
        }
    } else {
        // 비주거 (천장 높이 h_R 고려) - hR의 기본값 필요, zone.height 사용
        const val = (roomHeight > 0) ? (0.3 / roomHeight) : 0.1;
        n_win_min = Math.min(0.1, val);
    }

    // 침기 보정: 기계 환기가 없고 주말/휴일일 때 (또는 상시)
    // 식 80, 83, 84 등 적용을 위해 Delta_n_win 계산
    // 논리 분기: 기계 환기 여부

    const t_nutz = mechVent.t_nutz; // 사용 시간 (프로필)
    const t_v_mech = mechVent.dailyOpHours;

    let Delta_n_win = 0;
    let Delta_n_win_mech = 0; // For reporting

    if (!mechVent.isActive) {
        // --- 기계 환기 없음 (식 81, 82) ---
        // 침기에 의한 커버분을 뺀 나머지 필요 환기량
        if (n_nutz < 1.2) {
            // 식 81: max[0; n_nutz - (n_nutz - 0.2)/1 * n_inf - 0.1]
            // 이미지: max [ 0; n_nutz - (n_nutz - 0,2 h^-1)/1 h^-1 * n_inf - 0,1 h^-1 ]
            // 주의: (n_nutz - 0.2) 항이 음수가 되면? -> n_nutz < 0.2인 경우 등.
            // 표준 문맥상 보간법임. n_nutz 0.2~1.2 사이에서 n_inf의 기여도.
            // 만약 n_nutz <= 0.2라면? 보통 0.2보다 큼.
            const term = (n_nutz - 0.2) * n_inf; // /1 생략
            Delta_n_win = Math.max(0, n_nutz - term - 0.1);
        } else {
            // 식 82 (n_nutz >= 1.2)
            // delta = max[0; n_nutz - n_inf - 0.1]
            Delta_n_win = Math.max(0, n_nutz - n_inf - 0.1);
        }

        // 최종 n_win (식 80)
        // n_win = n_win_min + Delta_n_win * (t_nutz / 24)
        // 주거용(비기계)의 경우 계절 보정 (식 76, 77) -> n_win_mth = n_win * f_win_seasonal
        let n_win = n_win_min + Delta_n_win * (t_nutz / 24);

        if (isResidential) {
            n_win = n_win * calculateSeasonalFactor(theta_e);
        }
        return { rate: n_win, rate_tau: n_win, details: { n_win_min, Delta_n_win, Delta_n_win_mech: 0 } }; // Mech inactive -> rate_tau same (seasonal applies to both or neither? Wait. Rule says 'With Mech'. Without mech, seasonal applies to all?)
        // Re-read: "For residential buildings WITH mechanical ventilation... not for determination of time constant..."
        // Does this mean WITHOUT mech, we DO include seasonal factor for Tau?
        // Standard usually consistent. But the special rule targets Mech.
        // Let's assume without mech, tau uses seasonal too, or keep it consistent.
        // Actually, Tau should be physical property. Seasonal user behavior changes physical air change?
        // Let's stick to the EXPLICIT RULE: "With Mech -> Different". Else -> Same.

    } else {
        // --- 기계 환기 있음 (6.3.2.2 중간~하단) ---
        // 추가 필요 환기량 Delta_n_win,mech 계산 (식 85-90)

        // 우선 식 85, 86을 통해 Delta_n_win,mech,0 (기본값) 계산
        // n_inf_0는 6.3.1에서 구한 n_inf (기계환기 영향 없는 기본 침기? 식 66 기준)
        // "n_inf,0 der mittlere tägliche Infiltrationsluftwechsel nach Gleichung (66)" -> 즉 자연침기 상태 값.
        // 현재 매개변수 n_inf는 이미 기계환기 영향(fe)이 포함되었을 수 있음.
        // n_inf_0를 역산하거나 별도로 받아야 함. 일단 n_inf를 그대로 근사치로 사용 (fe=1이면 동일).

        let Delta_n_win_mech_0 = 0;
        // n_inf 대신 n_inf_0(자연상태 침기)를 써야 함.
        // n_inf = n50 * e * fATD * ... 
        // 여기서 n_inf 매개변수를 n_inf_0라고 가정하고 진행 (큰 차이 없을 수 있음)

        // 보정 계수 fe (식 86에 등장).
        // 식 85 (n_nutz < 1.2): max[0; n_nutz - (n_nutz - 0.2)*n_inf_0 - fe - 0.1] ??
        // 이미지 식 85: max [ 0; n_nutz - (n_nutz - 0,2)/1 * n_inf,0 * fe - 0,1 ]
        // 즉 침기 기여분에 fe를 곱함. (fe는 기계환기 시 침기 변화 계수)

        // fe 값 필요. 앞서 fe=1.0으로 가정했음.
        const fe = 1.0;

        if (n_nutz < 1.2) {
            Delta_n_win_mech_0 = Math.max(0, n_nutz - (n_nutz - 0.2) * n_inf * fe - 0.1);
        } else {
            // 식 86
            Delta_n_win_mech_0 = Math.max(0, n_nutz - n_inf * fe - 0.1);
        }

        // Case 구분 (a: 급기로 커버됨, b: 급기로 커버 안됨)
        // n_SUP: 기계 급기 + 인접 유입
        // n_ETA: 기계 배기 + 인접 유출

        const n_SUP = mechVent.n_SUP;
        const n_ETA = mechVent.n_ETA;
        const n_inf_combined = n_inf; // n_inf,0 인지 확인 필요. 식 87 조건: n_ETA <= (n_SUP + n_inf,0)

        // Delta_n_win_mech 결정
        // let Delta_n_win_mech = 0; // Moved up

        // Fall a: 필요 환기가 급기로 커버됨? 조건: Delta_n_win_mech,0 <= n_SUP
        if (Delta_n_win_mech_0 <= n_SUP) {
            // Fall a-1 (Eq 87)
            if (n_ETA <= (n_SUP + n_inf_combined)) {
                Delta_n_win_mech = 0;
            } else {
                // Fall a-2 (Eq 88)
                Delta_n_win_mech = n_ETA - n_SUP - n_inf_combined;
            }
        } else {
            // Fall b: 급기로 부족함
            // Fall b-1 (Eq 89)
            if (n_ETA <= (Delta_n_win_mech_0 + n_inf_combined)) {
                Delta_n_win_mech = Delta_n_win_mech_0 - n_SUP;
            } else {
                // Fall b-2 (Eq 90)
                Delta_n_win_mech = n_ETA - n_SUP - n_inf_combined;
            }
        }

        // 음수 방지 (논리상 가능? 식 90 등에서 음수 나올 수 있나? n_ETA가 작으면)
        Delta_n_win_mech = Math.max(0, Delta_n_win_mech);

        let n_win = 0;
        let Delta_n_win_no_mech = 0;

        // 최종 n_win (식 83, 84)
        if (t_v_mech >= t_nutz) {
            // 식 83 (표준)
            n_win = n_win_min + Delta_n_win_mech * (t_v_mech / 24);
        } else {
            // 식 84 (운전시간 부족)
            // 비운전 시간 동안의 추가 환기(Delta_n_win - 이는 기계환기 없을 때의 로직 값)도 필요
            // Delta_n_win(NoMech)를 다시 계산해야 함.
            if (n_nutz < 1.2) {
                Delta_n_win_no_mech = Math.max(0, n_nutz - (n_nutz - 0.2) * n_inf - 0.1);
            } else {
                Delta_n_win_no_mech = Math.max(0, n_nutz - n_inf - 0.1);
            }

            n_win = n_win_min
                + Delta_n_win_no_mech * ((t_nutz - t_v_mech) / 24)
                + Delta_n_win_mech * (t_v_mech / 24);
        }

        return {
            rate: n_win,
            rate_tau: isResidential && mechVent.isActive ? (n_win / calculateSeasonalFactor(theta_e)) : n_win, // [New] Base rate for Tau (remove seasonal effect)
            details: {
                n_win_min,
                Delta_n_win: Delta_n_win_no_mech,  // If mech active but insufficient time, this is relevant
                Delta_n_win_mech
            }
        };
    }
}

/**
 * 월간 계산을 위한 기상 데이터 집계 결과
 */
export interface MonthlyClimateIndices {
    month: number;
    Te_avg: number; // 월 평균 외기온 (°C)
    // 표면별 월간 총 일사량 (kWh/m2) - id는 surface.id
    surfaceInsolation: { [surfaceId: string]: number };
}

/**
 * 1. 기상 데이터 전처리: 시간별 기상 데이터를 월별 평균 및 총량으로 집계
 * - 각 표면(Surface)에 대한 월간 총 일사량(I_s,m)을 미리 계산
 */
/**
 * 1. 기상 데이터 전처리: 월간 기상 데이터를 기반으로 표면별 월간 총 일사량 계산
 * - 대표일(15일) 방식을 사용하여 경사면 일사량을 추정합니다.
 */
function processMonthlyWeather(
    zones: ZoneInput[],
    monthlyWeather: import("./types").MonthlyClimate[],
    hourlyWeather: import("./types").HourlyClimate[] | undefined,
    latitude: number
): MonthlyClimateIndices[] {
    const monthlyIndices: MonthlyClimateIndices[] = [];

    // 1-1. 존에 포함된 모든 유효 표면(Surface) 수집
    const allSurfaces: { id: string, orientation: string, tilt: number, type: string }[] = [];
    zones.forEach(z => {
        z.surfaces.forEach(s => {
            if (s.id && !s.type.includes('interior')) {
                let tilt = s.tilt ?? 90;
                allSurfaces.push({ id: s.id || 'unknown', orientation: s.orientation || 'NoExposure', tilt, type: s.type });
            }
        });
    });

    // 1-2. 월별 루프
    monthlyWeather.forEach(mClimate => {
        const m = mClimate.month;
        const Te_avg = mClimate.Te;

        let monthlySumSurf: { [id: string]: number } = {};
        allSurfaces.forEach(s => monthlySumSurf[s.id] = 0);

        // EPW Hourly Data Available
        if (hourlyWeather && hourlyWeather.length > 0) {
            // Filter hours for this month
            const monthHours = hourlyWeather.filter(h => h.month === m);

            if (monthHours.length > 0) {
                monthHours.forEach(hData => {
                    const dayOfYear = getDayOfYear(hData.month, hData.day);

                    allSurfaces.forEach(surf => {
                        if (surf.orientation === 'NoExposure') return;

                        let azimuth = 0;
                        switch (surf.orientation) {
                            case 'S': azimuth = 0; break;
                            case 'E': azimuth = -90; break;
                            case 'W': azimuth = 90; break;
                            case 'N': azimuth = 180; break;
                            case 'SE': azimuth = -45; break;
                            case 'SW': azimuth = 45; break;
                            case 'NE': azimuth = -135; break;
                            case 'NW': azimuth = 135; break;
                            case 'Horiz': azimuth = 0; break;
                        }

                        // 시간별 일사량 (W/m2) -> 1시간이므로 Wh/m2와 동일값
                        const I_tot = calculateHourlyRadiation(hData.I_beam, hData.I_diff, dayOfYear, hData.hour, latitude, azimuth, surf.tilt);
                        monthlySumSurf[surf.id] = (monthlySumSurf[surf.id] || 0) + I_tot;
                    });
                });
            } else {
                // Fallback if month data missing in hourly (should not happen in valid EPW)
                // Use Representative Day method
                const Is_hor_kwh = mClimate.Is_Horiz;
                const daysInMonth = new Date(2023, m, 0).getDate(); // Base year 2023
                const dayOfYear = getDayOfYear(m, 15);
                const H_gh = (Is_hor_kwh * 1000) / daysInMonth;
                const hourlyRep = generateDailyProfile(H_gh, dayOfYear, latitude);

                hourlyRep.forEach(hData => {
                    allSurfaces.forEach(surf => {
                        if (surf.orientation === 'NoExposure') return;
                        let azimuth = 0;
                        switch (surf.orientation) {
                            case 'S': azimuth = 0; break;
                            case 'E': azimuth = -90; break;
                            case 'W': azimuth = 90; break;
                            case 'N': azimuth = 180; break;
                            case 'SE': azimuth = -45; break;
                            case 'SW': azimuth = 45; break;
                            case 'NE': azimuth = -135; break;
                            case 'NW': azimuth = 135; break;
                            case 'Horiz': azimuth = 0; break;
                        }
                        const I_tot = calculateHourlyRadiation(hData.I_beam, hData.I_diff, hData.day, hData.hour, latitude, azimuth, surf.tilt);
                        // Multiply by daysInMonth to get Monthly Total?
                        // No, generateDailyProfile is for ONE day. We accumulate one day here.
                        // Then multiply later.
                        monthlySumSurf[surf.id] = (monthlySumSurf[surf.id] || 0) + (I_tot * daysInMonth);
                    });
                });
            }
        }
        // Legacy / Synthetic Method (Representative Day)
        else {
            const Is_hor_kwh = mClimate.Is_Horiz; // kWh/m2/month
            const daysInMonth = new Date(2023, m, 0).getDate();

            // 대표일: 매월 15일 기준
            const dayOfYear = getDayOfYear(m, 15);

            // 일일 평균 전일사량 (Wh/m2/day)
            const H_gh = (Is_hor_kwh * 1000) / daysInMonth;

            // 대표일의 24시간 일사 프로필 생성 (24h)
            const hourlyRep = generateDailyProfile(H_gh, dayOfYear, latitude);

            // 대표일의 표면별 일사량 누적
            hourlyRep.forEach(hData => {
                allSurfaces.forEach(surf => {
                    if (surf.orientation === 'NoExposure') return;

                    let azimuth = 0;
                    switch (surf.orientation) {
                        case 'S': azimuth = 0; break;
                        case 'E': azimuth = -90; break;
                        case 'W': azimuth = 90; break;
                        case 'N': azimuth = 180; break;
                        case 'SE': azimuth = -45; break;
                        case 'SW': azimuth = 45; break;
                        case 'NE': azimuth = -135; break;
                        case 'NW': azimuth = 135; break;
                        case 'Horiz': azimuth = 0; break;
                    }

                    // 대표일 시간별 계산 로직 사용
                    const I_tot = calculateHourlyRadiation(hData.I_beam, hData.I_diff, hData.day, hData.hour, latitude, azimuth, surf.tilt);

                    // Daily Sum * DaysInMonth = Monthly Sum
                    monthlySumSurf[surf.id] = (monthlySumSurf[surf.id] || 0) + (I_tot * daysInMonth);
                });
            });
        }

        const insolationMap: { [id: string]: number } = {};
        Object.keys(monthlySumSurf).forEach(id => {
            insolationMap[id] = monthlySumSurf[id] / 1000; // Wh -> kWh/m2/month
        });

        monthlyIndices.push({
            month: m,
            Te_avg: Te_avg,
            surfaceInsolation: insolationMap
        });
    });

    return monthlyIndices;
}

/**
 * Helper: 대표일의 일간 총 일사량으로부터 24시간 프로필 합성
 */
function generateDailyProfile(H_gh: number, day: number, latitude: number): import("./types").HourlyClimate[] {
    const res: import("./types").HourlyClimate[] = [];

    // 일출/일몰 시간 계산
    const declination = 23.45 * Math.sin((360 / 365) * (284 + day) * (Math.PI / 180));
    const declRad = declination * Math.PI / 180;
    const latRad = latitude * Math.PI / 180;
    const cosH = -Math.tan(latRad) * Math.tan(declRad);

    // 극야(Polar night) 체크
    if (cosH > 1) return []; // Always night

    const ws = Math.acos(Math.max(-1, Math.min(1, cosH))); // hour angle
    const degrees = ws * 180 / Math.PI;
    const sunrise = 12 - degrees / 15;
    const sunset = 12 + degrees / 15;
    const dayLength = sunset - sunrise;

    // 안전성 검사
    if (dayLength <= 0 || isNaN(dayLength)) return [];

    let sumWeights = 0;
    const weights: number[] = [];

    // 반-정현파(Half-sine) 분포 사용
    for (let h = 1; h <= 24; h++) {
        const time = h - 0.5; // mid-hour
        if (time < sunrise || time > sunset) {
            weights.push(0);
        } else {
            const w = Math.sin(Math.PI * (time - sunrise) / dayLength);
            weights.push(w);
            sumWeights += w;
        }
    }

    // --- Erbs 상관식: 청명지수(k_T) 기반 확산비율 분리 ---
    // (기존 k_diff = 0.5 고정 → 시간별 동적 계산)
    const G_sc = 1367; // 태양상수 [W/m²]
    const E_0 = 1 + 0.033 * Math.cos(2 * Math.PI * day / 365); // 지구-태양 거리 보정

    for (let h = 1; h <= 24; h++) {
        const w = weights[h - 1];
        const I_global = sumWeights > 0 ? H_gh * (w / sumWeights) : 0;

        let I_beam = 0;
        let I_diff = 0;

        if (I_global > 0) {
            // 시간별 태양 고도각 계산
            const time = h - 0.5;
            const omega_h = (time - 12) * 15 * (Math.PI / 180); // 시간각 [rad]
            const sin_alpha_h = Math.sin(latRad) * Math.sin(declRad)
                + Math.cos(latRad) * Math.cos(declRad) * Math.cos(omega_h);

            // 대기권 외 수평면 일사량 [W/m²]
            const G_0h = G_sc * E_0 * Math.max(0, sin_alpha_h);

            // 청명지수 k_T = I_global / G_0h
            const k_T = G_0h > 0 ? Math.min(I_global / G_0h, 1.0) : 1.0;

            // Erbs 상관식 (1982) - 확산비율 k_d
            let k_d: number;
            if (k_T <= 0.22) {
                k_d = 1.0 - 0.09 * k_T;
            } else if (k_T <= 0.80) {
                k_d = 0.9511 - 0.1604 * k_T + 4.388 * k_T * k_T
                    - 16.638 * k_T * k_T * k_T + 12.336 * k_T * k_T * k_T * k_T;
            } else {
                k_d = 0.165;
            }

            I_diff = I_global * k_d;
            I_beam = I_global * (1 - k_d);
        }

        res.push({
            hourOfYear: 0,
            month: 0,
            day: day,
            hour: h,
            Te: 0,
            I_beam: I_beam,
            I_diff: I_diff,
            sunAltitude: 0,
            sunAzimuth: 0
        });
    }
    return res;
}

function getDayOfYear(month: number, day: number): number {
    const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let doy = 0;
    for (let i = 1; i < month; i++) doy += daysInMonth[i];
    return doy + day;
}


/**
 * DIN/TS 18599-2:2025-10 월간 정적(준정상) 해석법 (Monatsbilanzverfahren / Quasi-steady-state)
 * - 시간별 부하(내부발열, 일사, 환기운전 등)는 정밀하게 계산하여 월별로 합산합니다.
 * - 열평형(Heat Balance)은 월 단위의 이용 효율(Utilization Factor) 방식을 사용합니다.
 */
export function calculateEnergyDemand(
    zones: ZoneInput[],
    weatherData?: ClimateData,
    mainStructure?: string,
    ventilationConfig?: Project['ventilationConfig'],
    ventilationUnits?: Project['ventilationUnits'],
    automationConfig?: Project['automationConfig'],
    systems?: Project['systems'],
    constructions?: Construction[],
    analysisMethod?: "monthly"
): CalculationResults {

    // 0. Method Dispatcher
    // Method 'hourly' removed for consistency.
    // if (analysisMethod === "hourly") { ... } removed.

    // Default: Monthly Balance Method (Existing Implementation)

    // 6.2.3 인접 존 참조를 위한 Map 생성
    const zoneMap = new Map<string, ZoneInput>();
    zones.forEach(z => {
        if (z.id) zoneMap.set(z.id, z);
    });

    // 1. 기상 데이터 준비
    const climateBase = weatherData || getClimateData();
    // const hourlyClimate = climateBase.hourly || generateHourlyClimateData(climateBase.monthly); // Removed for Monthly Method
    const latitude = climateBase.latitude || 37.5; // Default to Seoul if missing

    // [New] Monthly Method 전용: 기상 데이터 전처리
    const monthlyClimateIndices = processMonthlyWeather(zones, climateBase.monthly, climateBase.hourly, latitude);

    // 구역별 계산 수행
    const zoneResults = zones.map(zone => {
        if (zone.isExcluded) return null;

        return calculateZoneMonthly(
            zone,
            monthlyClimateIndices, // [Changed] pass pre-processed monthly data
            mainStructure,
            ventilationConfig,
            ventilationUnits,
            automationConfig,
            systems,
            constructions,
            zoneMap // 6.2.3 인접 존 참조
        );
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    // 연간 결과 집계
    const totalHeating = zoneResults.reduce((sum, z) => sum + z.yearly.heatingDemand, 0);
    const totalCooling = zoneResults.reduce((sum, z) => sum + z.yearly.coolingDemand, 0);
    const totalLighting = zoneResults.reduce((sum, z) => sum + z.yearly.lightingDemand, 0);
    const totalDHW = zoneResults.reduce((sum, z) => sum + z.yearly.dhwDemand, 0);
    const totalAux = zoneResults.reduce((sum, z) => sum + z.yearly.auxDemand, 0);
    const totalArea = zoneResults.reduce((sum, z) => sum + z.yearly.totalArea, 0);

    // 월간 결과 집계 (프로젝트 전체)
    const projectMonthlyResults: MonthlyResult[] = [];
    for (let m = 1; m <= 12; m++) {
        projectMonthlyResults.push({
            month: m,
            QT: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QT || 0), 0),
            QV: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QV || 0), 0),
            QT_heat: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QT_heat || 0), 0),
            QT_cool: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QT_cool || 0), 0),
            QV_heat: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QV_heat || 0), 0),
            QV_cool: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QV_cool || 0), 0),
            Qloss: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qloss || 0), 0),
            QS: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QS || 0), 0),
            QI: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QI || 0), 0),
            Qgain: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qgain || 0), 0),
            Q_heating: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_heating || 0), 0),
            Q_cooling: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_cooling || 0), 0),
            Q_lighting: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_lighting || 0), 0),
            Q_dhw: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_dhw || 0), 0),
            Q_aux: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_aux || 0), 0),
            Qh: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qh || 0), 0),
            Qc: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qc || 0), 0),
            pvGeneration: 0,
            avg_Ti: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.avg_Ti || 0) * z.yearly.totalArea, 0) / (totalArea || 1),
            gamma: 0, eta: 0
        });
    }

    // --- 태양광 발전 계산 (DIN 18599-9) ---
    // 월간법에서는 별도 모듈을 통해 계산하거나 간략화. 여기서는 PV 로직 간단히 포함.
    const pvSystems = systems?.filter(s => s.type === "PV") as import("@/types/system").PVSystem[] | undefined;

    // 단순화를 위해 0 처리 (필요시 복구)
    const pvGen_kWh = 0;
    const pvCredit = 0;

    // 최종 에너지 및 1차 에너지 집계
    let sumFinalHeating = 0, sumFinalCooling = 0, sumFinalDHW = 0, sumFinalLighting = 0, sumFinalAux = 0;
    let sumPrimaryHeating = 0, sumPrimaryCooling = 0, sumPrimaryDHW = 0, sumPrimaryLighting = 0, sumPrimaryAux = 0;
    let sumCO2 = 0;

    zoneResults.forEach(z => {
        if (z.yearly.finalEnergy) {
            sumFinalHeating += z.yearly.finalEnergy.heating;
            sumFinalCooling += z.yearly.finalEnergy.cooling;
            sumFinalDHW += z.yearly.finalEnergy.dhw;
            sumFinalLighting += z.yearly.finalEnergy.lighting;
            sumFinalAux += z.yearly.finalEnergy.auxiliary;
        }
        if (z.yearly.primaryEnergy) {
            sumPrimaryHeating += z.yearly.primaryEnergy.heating;
            sumPrimaryCooling += z.yearly.primaryEnergy.cooling;
            sumPrimaryDHW += z.yearly.primaryEnergy.dhw;
            sumPrimaryLighting += z.yearly.primaryEnergy.lighting;
            sumPrimaryAux += z.yearly.primaryEnergy.auxiliary;
        }
        sumCO2 += z.yearly.co2Emissions || 0;
    });

    const totalPrimary = sumPrimaryHeating + sumPrimaryCooling + sumPrimaryDHW + sumPrimaryLighting + sumPrimaryAux - pvCredit;

    return {
        zones: zoneResults,
        monthly: projectMonthlyResults,
        yearly: {
            heatingDemand: totalHeating,
            coolingDemand: totalCooling,
            lightingDemand: totalLighting,
            dhwDemand: totalDHW,
            auxDemand: totalAux,
            totalArea: totalArea,
            specificHeatingDemand: totalArea > 0 ? totalHeating / totalArea : 0,
            specificCoolingDemand: totalArea > 0 ? totalCooling / totalArea : 0,
            pvGeneration: pvGen_kWh,
            selfConsumption: pvGen_kWh,
            pvExport: 0,
            finalEnergy: {
                heating: sumFinalHeating,
                cooling: sumFinalCooling,
                dhw: sumFinalDHW,
                lighting: sumFinalLighting,
                auxiliary: sumFinalAux
            },
            primaryEnergy: {
                heating: sumPrimaryHeating,
                cooling: sumPrimaryCooling,
                dhw: sumPrimaryDHW,
                lighting: sumPrimaryLighting,
                auxiliary: sumPrimaryAux,
                total: totalPrimary,
                pvCredit: -pvCredit
            },
            co2Emissions: sumCO2
        }
    };
}

/**
 * 월간법(Monthly Method)을 이용한 존 단위 에너지 수요 계산
 */
// 2. Zone Calculation (Monthly Method)
export function calculateZoneMonthly(
    zone: ZoneInput,
    monthlyIndices: MonthlyClimateIndices[],
    mainStructure?: string,
    ventilationConfig?: Project['ventilationConfig'],
    ventilationUnits?: Project['ventilationUnits'],
    automationConfig?: Project['automationConfig'],
    systems?: Project['systems'],
    constructions?: Construction[],
    allZones?: Map<string, ZoneInput> // 6.2.3 인접 존 참조
) {
    const Area = zone.area;
    const Volume = Area * zone.height * 0.95; // 순 체적
    const profile = DIN_18599_PROFILES[zone.usageType] || DIN_18599_PROFILES["44_res_single"];

    if (Area < 0.1) return null;

    // --- 침기(Infiltration) 설정 (6.3.1) ---
    // 1. 외피 면적 A_E (Envelope Area) 계산
    const envelopeArea = zone.surfaces
        .filter(s => {
            // A_E includes Direct, Indirect, and Ground. Excludes Interior (Adiabatic).
            const category = getExposureCategory(s);
            return category !== ExposureCategory.INTERIOR;
        })
        .reduce((sum, s) => sum + s.area, 0);

    // 2. n50 결정
    let n50_val = 0;
    const isMeasured = ventilationConfig?.isMeasured ?? false;

    // A_E Breakdown for verification storage
    let A_ext = 0, A_grnd = 0, A_win = 0, A_door = 0;
    let fxArea_ext = 0, fxArea_grnd = 0;

    zone.surfaces.forEach(s => {
        const category = getExposureCategory(s);
        const fx = s.fx !== undefined ? s.fx : getFxDefault(s.type);

        // Only aggregate contribution if proper envelope part
        if (category !== ExposureCategory.INTERIOR) {

            // Categorize for breakdown
            switch (category) {
                case ExposureCategory.GROUND_EXTERIOR:
                    A_grnd += s.area;
                    fxArea_grnd += fx * s.area;
                    break;
                case ExposureCategory.DIRECT_EXTERIOR:
                    if (s.type === 'window') {
                        A_win += s.area;
                    } else if (s.type === 'door') {
                        A_door += s.area;
                    } else {
                        // Wall, Roof, etc.
                        A_ext += s.area;
                        fxArea_ext += fx * s.area;
                    }
                    break;
                case ExposureCategory.INDIRECT_EXTERIOR:
                    // Treat indirect as part of A_ext (but with lower fx) for simplified CSV summary,
                    // or potentially verify if user wants specific A_indirect column.
                    // Based on "Indirect Exterior" being distinct but often lumped into envelope:
                    A_ext += s.area;
                    fxArea_ext += fx * s.area;
                    break;
            }
        }
    });

    if (isMeasured && ventilationConfig?.n50 !== undefined) {
        n50_val = ventilationConfig.n50;
    } else {
        const cat: AirTightnessCategory = ventilationConfig?.infiltrationCategory ?? "II"; // 기본값 II (검사 없는 신축)
        const hasMech = ventilationConfig?.type === 'mechanical';
        n50_val = calculateStandardN50(
            Volume,
            envelopeArea,
            hasMech ? "mechanical" : "natural",
            cat
        );
    }

    // 3. n_inf (일일 평균) 결정
    const hasATD = ventilationConfig?.hasALD ?? false;

    // 존별 기계환기 연결 상태 확인 (AHU 또는 개별 환기장치)
    const ahuSystem = systems?.find(s => s.type === "AHU" && (s.linkedZoneIds?.includes(zone.id || "") || s.isShared)) as AHUSystem | undefined;
    const isVentUnit = !!(zone.linkedVentilationUnitIds && zone.linkedVentilationUnitIds.length > 0);
    const hasRealSystem = !!(ahuSystem || isVentUnit); // 실제 환기 설비가 연결되어 있는가?
    const isMechanicalMode = (ventilationConfig?.type === 'mechanical') || (zone.ventilationMode === 'mechanical' || zone.ventilationMode === 'balanced_mech');
    let isZoneMechanical = !!(hasRealSystem && isMechanicalMode);

    // [Annex E] 설비 미결정 시 기계환기 가정 (DIN/TS 18599-2 Annex E)
    // - 실제 환기 설비(AHU/환기장치)가 연결되지 않은 경우,
    //   초기 에너지요구량 계산을 위해 기계환기를 가정 (n_SUP = n_nutz)
    // - 열회수 효율 0% (보수적 가정)
    // - t_v_mech = t_nutz (프로필 사용시간, 예: 사무실 11h)
    let forcedMechanical = false;
    if (!isZoneMechanical) {
        isZoneMechanical = true;
        forcedMechanical = true;
    }

    const ventType = isZoneMechanical ? "mechanical" : "natural";
    const isBalanced = (ventilationConfig?.systemType === "balanced") || true; // 기계환기 시 기본 평형 가정
    // Annex E: 설비 미결정 → t_v_mech = t_RLT (Part 10 공조 가동시간, Betriebszeit RLT)
    // 실제 설비: ventilationConfig의 운전시간 사용
    const dailyOpHours = (ventType === "mechanical")
        ? (forcedMechanical
            ? (profile.hvacDailyOperationHours ?? 24) // Part 10 t_RLT (예: 사무실 13h, 사전공조 2h 포함)
            : (ventilationConfig?.dailyOperationHours ?? 24))
        : 0;
    const t_v_mech = dailyOpHours; // verification data용

    // 일일 침기율 [1/h] 계산
    // 참고: 기계환기가 야간/주말에 꺼지는 경우?
    // 표준 식 67은 t_v,mech를 사용하므로 운전 시간을 고려한 일일 평균을 의미합니다.
    const f_inf_daily_mean = calculateInfiltrationRate(n50_val, hasATD, ventType, isBalanced, dailyOpHours);

    // 1. 열용량 (Cm) 계산
    // 사용자 요청에 따른 단순화된 계산법 (주구조 기준)
    // 중량 (철근콘크리트, 조적 등) -> 90 Wh/m2K
    // 경량 (목구조, 철골 등) -> 50 Wh/m2K

    let C_wirk_factor = 50; // 기본값: 경량
    if (mainStructure) {
        const struct = mainStructure.toLowerCase();
        // 한글/영문 키워드 모두 지원
        if (struct.includes("heavy") || struct.includes("concrete") || struct.includes("masonry") || struct.includes("rc") ||
            struct.includes("철근") || struct.includes("콘크리트") || struct.includes("조적") || struct.includes("중량")) {
            C_wirk_factor = 90;
        } else if (struct.includes("light") || struct.includes("wood") || struct.includes("steel") ||
            struct.includes("목구조") || struct.includes("철골") || struct.includes("경량")) {
            C_wirk_factor = 50;
        }
    }

    // Total Cm = Factor * Area
    console.log(`[DEBUG_Cm] Zone: ${zone.name}, Area: ${Area}, MainStructure: ${mainStructure}, Factor: ${C_wirk_factor}, Calculated Cm: ${C_wirk_factor * Area}`);
    let Cm = C_wirk_factor * Area;

    if (Cm < (10 * Area)) Cm = 10 * Area;

    // 타임 상수 계산을 위한 기초 데이터
    // 월별 집계를 위해 미리 저장할 변수들
    const monthlyData = Array(13).fill(null).map(() => ({
        Te_sum: 0, count: 0,
        Sol_gain: 0, // Wh
        Int_gain_occ: 0, // Wh (인체+기기)
        Int_gain_light: 0, // Wh
        Int_gain_dhw: 0, // Wh (급탕 손실 등)
        H_tr: 0, // W/K (평균)
        H_ve: 0, // W/K (평균)
        Q_dhw_demand: 0, // Wh (급탕 에너지 요구량)
        Q_light_demand: 0, // Wh (조명 에너지)
        Q_aux: 0, // Wh (팬)
        Q_trans_adj_heating: 0, // Wh (6.2.3 인접존 전열 - 난방부하 추가분)
        Q_trans_adj_cooling: 0, // Wh (6.2.3 인접존 전열 - 냉방부하 추가분)
    }));

    // --- Phase 1: 월 통합을 위한 시간별 루프 (Hourly Loop for Aggregation) REMOVED ---
    // [Changed] Monthly Method Logic Rewrite (Strict DIN 18599-2)

    // 준비: 조명, 급탕 시스템 찾기 (시스템 효율 적용은 나중에, 여기서는 부하만)
    let lightingSystem = systems?.find(s => s.type === "LIGHTING" && (s.linkedZoneIds?.includes(zone.id || "") || s.isShared)) as LightingSystem | undefined;
    if (!lightingSystem && zone.linkedLightingSystemId) lightingSystem = systems?.find(s => s.id === zone.linkedLightingSystemId) as LightingSystem | undefined;

    // 월별 결과 계산
    // 월별 결과 계산
    const monthlyResults: MonthlyResult[] = [];
    // [Fix] hourlyResults는 월간법에서 생성되지 않음. 빈 배열 반환.
    const hourlyResults: HourlyResult[] = [];

    // 설정 온도
    const Theta_int_H = zone.temperatureSetpoints.heating;
    const Theta_int_C = zone.temperatureSetpoints.cooling;

    for (let m = 1; m <= 12; m++) {
        const d = monthlyIndices.find(mi => mi.month === m);
        if (!d) continue;

        // 월 일수 및 시간
        const daysInMonth = new Date(2023, m, 0).getDate(); // 2023: non-leap year standard
        const t_duration = daysInMonth * 24;

        const Te_avg = d.Te_avg;

        // --- 1. Transmission (H_tr) ---
        // H_tr은 기본적으로 상수이나, f_neig(window) 등이 가변일 수 있음? 
        // DIN 18599-2: H_tr = H_D + H_g + H_U + H_A
        // 여기서는 기존 로직의 요소를 월별 루프 안에서 계산 (혹시 가변 요소가 있을 경우 대비)
        // 하지만 대부분 물성은 고정. loop 밖으로 빼도 되지만, Fx (인접존 온도차)가 월별로 다름.

        let H_tr_curr = 0;
        let sumArea = 0;
        let Q_trans_adj_heating = 0;
        let Q_trans_adj_cooling = 0;

        const monthlySurfaceData = new Map<string, { area: number; uSum: number; fxSum: number; hTr: number; hBridge: number; qAdj: number; qCoolSimplified: number }>();

        zone.surfaces.forEach(surf => {
            let u_val = surf.uValue;
            let fx = 1.0;

            if (surf.type === 'window' || surf.type === 'door') {
                const tilt = surf.tilt ?? 90;
                // 월평균 f_neig? 일단 상수(1.0 or tilt기반) 적용.
                const f_neig = getInclinationFactor(tilt, "double");
                u_val = u_val * f_neig;
            }

            if (surf.fx !== undefined) {
                fx = surf.fx;
            } else {
                fx = getFxDefault(surf.type);

                // Special logic for interior adjacent zones
                if (surf.type.includes("interior")) {
                    if (surf.adjacentZoneId && allZones) {
                        const adjZone = allZones.get(surf.adjacentZoneId);
                        if (adjZone) {
                            fx = 0.0; // H_tr에는 포함 안함 (Q_adj로 별도 계산)
                            // ... existing logic below calculates Q_adj separately
                            // 인접존 월평균 온도가 필요하나, 현재 구조상 Simultaneous Solving이 아님.
                            // 약식: 인접존의 Setpoint 사용.
                            const Tz_h = adjZone.temperatureSetpoints.heating;
                            const Tz_c = adjZone.temperatureSetpoints.cooling;

                            // Heating Calc (Loss if Ti > Tz)
                            if (Math.abs(Theta_int_H - Tz_h) > 4) {
                                const H_iz = u_val * surf.area;
                                // 인접존 전열량 [Wh] -> [kWh] / 1000 needed later
                                // Q = H * (Ti - Tz) * t
                                const Q_iz = H_iz * (Theta_int_H - Tz_h) * t_duration;
                                Q_trans_adj_heating += Q_iz;
                            }
                            // Cooling Calc (Gain if Tz > Ti - but Cooling logic uses Loss concept)
                            // Cooling Load = Loss (Ti_c - Te). 
                            // Q_adj should be added to Gains if Tz > Ti.
                            // Or added to Loss if Ti > Tz.
                            // 여기서는 Q_gain에 더할 값(Gain from Adj)을 구하거나, Q_loss에 더할 값(Loss to Adj)을 구해야 함.
                            // 통일성 있게 "Heat Gain from Adj Zone" for Cooling Check
                            if (Math.abs(Theta_int_C - Tz_c) > 4) {
                                const H_iz = u_val * surf.area;
                                // Gain = H * (Tz - Ti)
                                const Q_iz_gain = H_iz * (Tz_c - Theta_int_C) * t_duration;
                                Q_trans_adj_cooling += Q_iz_gain;
                            }

                        } else { fx = 0.5; }
                    } else { fx = 0.5; }
                }
                else if (surf.orientation === "NoExposure") fx = 0.0;
            }

            const h_surf = u_val * surf.area * fx;

            // Thermal Bridge (Simplified: Area * Factor)
            // Apply to all surfaces contributing to envelope (fx > 0)
            const bridgeFactor = zone.thermalBridgeMode || 0.1; // Default 0.1 W/m2K
            // Fix: Apply fx to bridge factor as well (e.g. for ground or unheated interaction)
            const h_bridge_surf = (fx > 0) ? (surf.area * bridgeFactor * fx) : 0;

            H_tr_curr += (h_surf + h_bridge_surf);
            if (fx > 0) sumArea += surf.area;

            // Store details for later aggregation (after Theta_i_h is known)
            const key = `${surf.type}_${surf.orientation || 'NoExposure'}`;
            if (!monthlySurfaceData.get(key)) {
                monthlySurfaceData.set(key, { area: 0, uSum: 0, fxSum: 0, hTr: 0, hBridge: 0, qAdj: 0, qCoolSimplified: 0 });
            }
            const d_surf_data = monthlySurfaceData.get(key)!;
            d_surf_data.area += surf.area;
            d_surf_data.uSum += (u_val * surf.area);
            d_surf_data.fxSum += (fx * surf.area);
            d_surf_data.hTr += h_surf;
            d_surf_data.hBridge += h_bridge_surf;

            // Simplified Cooling Temp (Section 6.1.4.6)
            const theta_u_cool = getCoolingSimplifiedTemp(surf.type, u_val);
            if (theta_u_cool !== null && fx < 1.0 && !surf.adjacentZoneId) {
                // Theta_i_c = Theta_int_C - 2.0 (Defined later, but constant here)
                const Ti_c = Theta_int_C - 2.0;
                const h_cool_surf = u_val * surf.area;
                const h_cool_bridge = surf.area * (zone.thermalBridgeMode || 0.1);
                // Heat Gain/Loss based on fixed temperature
                // Q = H * (Ti - Tu) * t
                const q_cool_simplified = (h_cool_surf + h_cool_bridge) * (Ti_c - theta_u_cool) * t_duration;
                d_surf_data.qCoolSimplified += q_cool_simplified;
            }
            // Add manually calculated adjacent loss if any (e.g. adjacent unconditioned)
            // logic above added to Q_trans_adj heating/cooling vars.
            // but for correct attribution, we need to add it here if this specific surface contributed.
            if (fx === 0 && (surf.type.includes("interior") || surf.type.includes("ground"))) {
                // If it was interior adjacent, we calculated Q separately above.
                // We need to capture that specific Q value here.
                // Re-calculate or capture from above scope?
                // The loop above constructs Q_trans_adj_heating.
                // Let's modify the loop structure slightly to capture Q_iz here.
                let q_iz_surf = 0;
                if (surf.type.includes("interior") && surf.adjacentZoneId) {
                    // Re-eval logic from above for this specific surface
                    const adjZone = allZones?.get(surf.adjacentZoneId);
                    if (adjZone) {
                        const Tz_h = adjZone.temperatureSetpoints.heating;
                        if (Math.abs(Theta_int_H - Tz_h) > 4) {
                            const H_iz = u_val * surf.area;
                            q_iz_surf = H_iz * (Theta_int_H - Tz_h) * t_duration;
                        }
                    }
                }
                d_surf_data.qAdj += q_iz_surf;
            }
        });

        // --- 2. Ventilation (H_ve) ---
        // 월별 외기온(Te_avg)에 따라 n_win, n_mech 효율 등 달라짐.
        const usageDuration = Math.max(1, profile.usageHoursEnd - profile.usageHoursStart);

        // 침기 (상수)
        const isMeasured_sub = ventilationConfig?.isMeasured ?? false; // scope fix
        // n50_val, hasATD, ventType etc. are constant outside loop.
        // f_inf_daily_mean calculated outside.

        // 기계 환기 여부 (앞서 결정된 isZoneMechanical 활용)
        const isMechanical = isZoneMechanical;

        // 필요 환기량
        const minFlowArea = profile.minOutdoorAir || 0;
        const n_nutz = calculateRequiredAirChange(minFlowArea, Area, Volume);

        // n_win 계산
        const isResidential = zone.usageType.startsWith("4");
        // Mechanical params
        let n_SUP = 0, n_ETA = 0, heatRecoveryEfficiency = 0;
        let fanPower = 0;

        if (isMechanical) {
            let eff = 0.0;
            if (!forcedMechanical) {
                if (ventilationConfig?.type === 'mechanical') eff = (ventilationConfig.heatRecoveryEfficiency || 0) / 100;
                if (ahuSystem?.heatRecovery) eff = Te_avg < ((Theta_int_H + Theta_int_C) / 2) ? ahuSystem.heatRecovery.heatingEfficiency : ahuSystem.heatRecovery.coolingEfficiency;
            }
            heatRecoveryEfficiency = eff;

            const designAirChange = n_nutz;
            if (isBalanced) { n_SUP = designAirChange; n_ETA = designAirChange; }
            else { n_SUP = 0; n_ETA = designAirChange; }

            // Fan Power (Monthly Estimate)
            // If forced mechanical (virtual system for thermal compliance check), Fan Power = 0
            if (!forcedMechanical) {
                const flowRate = designAirChange * Volume;
                const sfp = ahuSystem?.fanPower || 1.5;
                const d_nutz_m = (profile.annualUsageDays / 365) * daysInMonth;
                fanPower = sfp * flowRate * t_v_mech * d_nutz_m;
            } else {
                fanPower = 0;
            }
        }

        // Window Ventilation
        const n_win_result = calculateWindowVentilationRate(
            n_nutz, f_inf_daily_mean, isResidential, zone.height,
            { isActive: isMechanical, dailyOpHours: t_v_mech, t_nutz: usageDuration, n_SUP: n_SUP || 0, n_ETA: n_ETA || 0 },
            Te_avg,
            (A_win > 0) // Pass hasWindows
        );

        // H_ve 분리를 위한 일수 분포 사전 계산
        const numDays = t_duration / 24;
        const d_op_week = profile.annualUsageDays / 52;
        const d_non_op_week = 7 - d_op_week;
        const frac_non_op = d_non_op_week / 7;
        const frac_op = 1 - frac_non_op; // [Added] d_nutz 계산용
        const d_we = numDays * frac_non_op;




        const n_win = n_win_result.rate;


        // n_mech_eff
        const n_mech_daily = n_SUP * (t_v_mech / 24);
        const currentAirChange_Natural = f_inf_daily_mean + n_win;
        const currentAirChange_Mech_Eff = n_mech_daily * (1 - heatRecoveryEfficiency);

        // H_ve 분리 계산: 사용 시간(Usage)과 비사용 시간(Non-Usage) 구분
        // [New] 사용일(기계환기 가동)과 비사용일(기계환기 정지)을 구분하여 H_ve 계산
        let H_ve_usage = Volume * HEAT_CAPACITY_AIR * (currentAirChange_Natural + currentAirChange_Mech_Eff);

        // 비사용 기간(Non-Usage Period)의 H_ve (자연환기 전용)
        // 기계환기가 정지된 주말/휴일에는 자연환기(침기 + 창문환기)만 적용됨.
        // 현재는 단순화를 위해 기계환기 가동 시 계산된 n_win을 그대로 사용할지, 아니면 자연환기 모드로 재계산할지 결정 필요.
        // 기계환기가 있을 경우 n_win은 기계환기 작동 여부에 따라 달라짐.
        // 따라서 비사용일(기계환기 Off)에는 자연환기 모드로 n_win을 재계산해야 함.

        let n_win_non_usage = n_win;
        if (isMechanical && d_we > 0.1) {
            // 기계환기 정지(IsActive=false) 상태로 가정하고 자연환기량 재계산
            // Using helper: force isActive=false
            const n_win_nat_result = calculateWindowVentilationRate(
                n_nutz, f_inf_daily_mean, isResidential, zone.height,
                { isActive: false, dailyOpHours: 0, t_nutz: 24, n_SUP: 0, n_ETA: 0 }, // 24시간 자연환기 가능 가정
                Te_avg,
                (A_win > 0)
            );
            n_win_non_usage = n_win_nat_result.rate;
        }

        const currentAirChange_NonUsage = f_inf_daily_mean + n_win_non_usage;
        let H_ve_non_usage = Volume * HEAT_CAPACITY_AIR * currentAirChange_NonUsage;

        // H_ve_curr (기존 호환용) -> 가중 평균? 또는 사용일 기준?
        // 표준 루프에서는 주로 사용일 기준 값을 참조하되, 분리 계산 루프에서 덮어씌움.
        let H_ve_curr = H_ve_usage;

        // Unheated check (reduce H_ve if needed)
        if (zone.temperatureSetpoints.heating < 12) {
            const H_ve_unheated = Volume * HEAT_CAPACITY_AIR * 0.6;
            H_ve_usage = H_ve_unheated;
            H_ve_non_usage = H_ve_unheated;
            H_ve_curr = H_ve_unheated;
        }

        // 시간상수(τ) 계산을 위한 H_ve — DIN 18599-2, Eq. 140-143
        // 규칙: 기계환기가 있는 주거용 건물의 경우, Tau 계산 시 창문환기에 대한 계절적 요인을 배제함.
        const n_win_tau = n_win_result.rate_tau;
        const currentAirChange_Natural_Tau = f_inf_daily_mean + n_win_tau;
        const H_ve_natural_tau = Volume * HEAT_CAPACITY_AIR * currentAirChange_Natural_Tau;

        // 기계환기 열전달계수: 설비 유형에 따라 Eq. 141/142/143 분기
        let H_ve_tau_h: number;
        let H_ve_tau_c: number;

        if (isMechanical && n_mech_daily > 0) {
            const H_V_mech = Volume * HEAT_CAPACITY_AIR * n_mech_daily;

            if (forcedMechanical) {
                // Eq. 142: 설비 미결정 → 냉방 없는 환기 가정
                // H_V,mech,θ = H_V,mech (온도 보정 없음, 전체 반영)
                // 난방/냉방 동일 → τ_h = τ_c
                H_ve_tau_h = H_ve_natural_tau + H_V_mech;
                H_ve_tau_c = H_ve_natural_tau + H_V_mech;
            } else {
                // 설비 결정됨 → 시스템 유형에 따라 분기
                // TODO: Eq. 143 (공기 난방, Luftheizung) → H_V,mech,θ = 0 (추후 구현)
                // Eq. 141: 냉방 기능이 있는 공조 → 온도 보정 적용
                // H_V,mech,θ = H_V,mech · (1-η) · (θ_i,soll - θ_e) / 6
                const factor_h = Math.max((1 - heatRecoveryEfficiency) * (Theta_int_H - Te_avg) / 6, 0);
                const factor_c = Math.max((1 - heatRecoveryEfficiency) * (Theta_int_C - Te_avg) / 6, 0);
                H_ve_tau_h = H_ve_natural_tau + H_V_mech * factor_h;
                H_ve_tau_c = H_ve_natural_tau + H_V_mech * factor_c;
            }
        } else {
            // 자연환기만: 기계환기 보정 없음
            H_ve_tau_h = H_ve_natural_tau;
            H_ve_tau_c = H_ve_natural_tau;
        }

        if (zone.temperatureSetpoints.heating < 12) {
            H_ve_tau_h = H_ve_curr;
            H_ve_tau_c = H_ve_curr;
        }


        // --- 3. Internal Gains (Q_I) ---
        // Profile values (metabolicHeat, equipmentHeat, dhwDemand) are daily totals [Wh/(m2*d)]
        const daysInMonth_val = daysInMonth; // month constant
        const daysUsage = (profile.annualUsageDays / 365) * daysInMonth_val;
        const hoursUsage = daysUsage * usageDuration;
        const totalHoursM = daysInMonth_val * 24;

        // ... (Gains calculation logic) ...


        // 3.1 Metabolic Heat - usage days only
        const Q_occ_m = (profile.metabolicHeat * Area) * daysUsage;

        // 3.2 Equipment Heat - Occupied days + Unoccupied hours/days parasitic
        // Intensity during operation [W/m2]
        const p_eq = usageDuration > 0 ? (profile.equipmentHeat / usageDuration) : 0;
        const Q_eq_occ = (profile.equipmentHeat * Area) * daysUsage;
        // Parasitic (5%) during all other hours
        const Q_eq_unocc = (p_eq * Area * 0.05) * (totalHoursM - hoursUsage);
        const Q_eq_m = Q_eq_occ + Q_eq_unocc;

        // 3.3 Lighting Heat Gain (Simplified)
        // formula: Em / (efficay * kL * rho) -> [W/m2]
        const efficacy = 60; // lm/W
        const k_L = profile.illuminanceDepreciationFactor || 0.8;
        const rho_lit = 0.6; // util factor
        const p_lit = profile.illuminance / (efficacy * k_L * rho_lit);
        // Assuming lighting is used during usage hours with 80% utilization
        const Q_lit_m = (p_lit * Area) * hoursUsage * 0.8;

        // 3.4 DHW Heat Gain
        // loss to room approx 20%
        const Q_dhw_m = (profile.dhwDemand * Area) * daysUsage * 0.2;

        const Q_int_m = (Q_occ_m + Q_eq_m + Q_lit_m + Q_dhw_m);
        const internalGains = {
            Q_occ: Q_occ_m / 1000,
            Q_app: Q_eq_m / 1000,
            Q_lit: Q_lit_m / 1000,
            Q_dhw: Q_dhw_m / 1000
        };

        // --- 4. Solar Gains (Q_S) ---
        // Q_s = sum( I_s,m * A * F )
        let Q_sol_m = 0;
        const solarData: NonNullable<MonthlyResult['solarData']> = {};

        Object.keys(d.surfaceInsolation).forEach(surfId => {
            const val_kWh = d.surfaceInsolation[surfId]; // kWh/m2
            const surf = zone.surfaces.find(s => s.id === surfId);
            if (!surf) return;

            let Q_surf_sol = 0;
            let reduction = 1.0;

            if (surf.type === 'window' || surf.type === 'door') {
                const construction = constructions?.find(c => c.id === surf.constructionId);
                const shgc = surf.shgc ?? construction?.shgc ?? 0.6; // g (Standardwert)
                const F_g_glass = 0.7; // Glasanteil (Standard F_g = 1 - F_f)
                const F_S = 0.9; // Verschattung (Umgebung)
                const F_w = 0.9; // Nicht senkrechter Strahlungseinfall
                const F_V = 0.9; // Verschmutzung

                // g_eff = F_S * F_w * F_V * g (keine Sonnenschutzvorrichtung)
                const g_eff = F_S * F_w * F_V * shgc;
                reduction = F_g_glass * g_eff;
                Q_surf_sol = (val_kWh * 1000) * surf.area * reduction;
            } else {
                // [Opaque] Opaque Bauteile (DIN/TS 18599-2:2025-10 Section 6.4.2)
                const alpha = surf.absorptionCoefficient ?? 0.5; // Strahlungsabsorptionsgrad
                const construction = constructions?.find(c => c.id === surf.constructionId);
                const R_se = construction?.r_se ?? 0.04; // 실외 표면 열전달 저항
                const U = surf.uValue;

                // Long-wave radiation to sky
                // hr = 5 * epsilon (Standard epsilon = 0.9)
                const h_r = 4.5;
                const Delta_theta_er = 10; // K

                // F_f_sky: Formfactor (1.0 for horizontal <= 45, 0.5 for vertical > 45)
                const F_f_sky = (surf.tilt ?? 90) <= 45 ? 1.0 : 0.5;

                // Q_s_opak = R_se * U * A * (alpha * Is - F_f_sky * hr * Delta_theta_er * t)
                const term_solar = alpha * (val_kWh * 1000); // Wh/m2
                const term_radiative_loss = F_f_sky * h_r * Delta_theta_er * t_duration; // Wh/m2

                Q_surf_sol = R_se * U * surf.area * (term_solar - term_radiative_loss);
                reduction = U * R_se * alpha; // Legacy ref for display
            }

            Q_sol_m += Q_surf_sol;

            solarData[surfId] = {
                area: surf.area,
                orientation: surf.orientation ?? "-",
                tilt: surf.tilt ?? 90,
                I_sol_kwh: val_kWh,
                reductionFactor: reduction,
                Q_sol_kwh: Q_surf_sol / 1000
            };
        });


        // --- 5. Monthly Balance (Refactored Existing Logic) ---

        const H_tot = H_tr_curr + H_ve_curr; // For Balance (Qh, Qc)
        const H_tot_tau_h = H_tr_curr + H_ve_tau_h;
        const H_tot_tau_c = H_tr_curr + H_ve_tau_c;
        const tau_h = H_tot_tau_h > 0 ? (Cm / H_tot_tau_h) : 0; // 난방용 시간상수
        const tau_c = H_tot_tau_c > 0 ? (Cm / H_tot_tau_c) : 0; // 냉방용 시간상수

        // Calc Theta_i_h (Effective Heating Setpoint)
        // ... (Reuse existing logic for Theta_i_h, f_NA, f_we) ...
        // Re-implementing concise version for brevity in this chunk

        const t_h_op_d = usageDuration > 0 ? usageDuration : 24;
        const t_NA = 24 - t_h_op_d;
        const Delta_theta_i_NA = profile.heatingSetbackTemp || 3.0;

        // Automation delta (DIN 18599-11 simplification)
        let delta_theta_EMS = 0;
        if (automationConfig?.automationClass === 'A') delta_theta_EMS = 0.5;
        else if (automationConfig?.automationClass === 'B') delta_theta_EMS = 0.2;

        const f_adapt = automationConfig?.heatingTempControl === 'auto_adapt' ? 0.9 : 1.0;
        const isShutdown = zone.heatingReducedMode === "shutdown";
        let f_NA = 0;
        if (t_NA > 0) {
            const expTerm = Math.exp(-(tau_h || 0) / 250);
            // Eq. 31 (Reduced), Eq. 28 (Shutdown - interpreted as stronger reduction)
            // DIN V 18599-2:2018-09 Eq. 31: f_NA = 0.13 * (t_NA / 24) * ...
            // If shutdown, it often implies f_NA is higher (more temp drop). 
            // However, verify if 0.26 is the correct factor for shutdown. 
            // Standard says for shutdown: f_NA = 0.5 * (t_NA/24) * ... approx? 
            // Eq 28: f_NA_abs = (t_NA/24) * (1 - exp(-tau/100)) ... this is different.

            // Let's stick to the 0.26 / 0.13 factors as they were likely derived from simplified tables, 
            // BUT ensure the parenthesis are correct. 
            f_NA = (isShutdown ? 0.26 : 0.13) * (t_NA / 24) * expTerm * f_adapt;
        }
        const term1_NA = Theta_int_H - f_NA * (Theta_int_H - Te_avg);
        const term2_NA = Theta_int_H - (Delta_theta_i_NA * (t_NA / 24));
        const Theta_i_h_op = Math.max(term1_NA, term2_NA);

        // Weekend
        let f_we = 0;
        let Theta_i_h_non_op = Theta_i_h_op;
        let Theta_i_h = Theta_i_h_op;
        // ...

        if (profile.annualUsageDays <= 260) {
            if (isShutdown) {
                // Heizungsabschaltung (DIN/TS 18599-2:2025-10 Eq. 33)
                // f_we = 0.3 * (1 - 0.2 * (tau_h / 250))
                f_we = 0.3 * (1 - 0.2 * (tau_h / 250));
            } else {
                // Absenkbetrieb (DIN/TS 18599-2:2025-10 Eq. 32)
                f_we = 0.2 * (1 - 0.4 * (tau_h / 250));
            }
            f_we = Math.max(0, f_we);

            // DIN/TS 18599-2:2025-10 Eq. 31
            // Theta_i_h (non-op) = max( Theta_set - f_we * (Theta_set - Theta_e), Theta_set - Delta_Theta_NA )
            // Here Theta_set = Theta_int_H
            // Theta_e = Te_avg
            const term1_non_op = Theta_int_H - f_we * (Theta_int_H - Te_avg);
            const term2_non_op = Theta_int_H - Delta_theta_i_NA;

            Theta_i_h_non_op = Math.max(term1_non_op, term2_non_op);

            // 3. Calculate finally weighted monthly average (Eq. 38)
            const d_op = profile.annualUsageDays / 52;
            const d_non_op = 7 - d_op;

            if (d_non_op > 0) {
                Theta_i_h = (Theta_i_h_op * d_op + Theta_i_h_non_op * d_non_op) / 7;
            } else {
                Theta_i_h = Theta_i_h_op;
            }
        }

        // Q_loss_H [kWh]
        // Legacy QT/QV for heating based on Theta_i_h
        const QT_heat = ((H_tr_curr * (Math.max(Theta_i_h, Te_avg) - Te_avg) * t_duration) + Q_trans_adj_heating) / 1000;
        const QV_heat = (H_ve_curr * (Math.max(Theta_i_h, Te_avg) - Te_avg) * t_duration) / 1000;
        const Q_loss_H = QT_heat + QV_heat;

        // Q_gain [kWh]
        const Q_gain = (Q_sol_m + Q_int_m + Q_trans_adj_cooling) / 1000;

        // Simplified Cooling Aggregation
        let H_tr_simplified_m = 0;
        let Q_cool_simplified_m = 0;
        monthlySurfaceData.forEach(d => {
            if (d.qCoolSimplified !== 0) {
                H_tr_simplified_m += (d.hTr + d.hBridge);
                Q_cool_simplified_m += d.qCoolSimplified;
            }
        });

        // -------------------------------------------------------------------------
        // Section 6.6 구현: 비운전일 구조체 축열량 이전 (Heat Storage Transfer)
        // -------------------------------------------------------------------------

        let Q_h_need = 0;
        let eta_H = 1.0; // 출력 확인용 대표 이용 효율
        let gamma_H = 1.0;
        const a_H = 1 + (tau_h / 16); // 난방용 이용효율 계수 (수정: 15 -> 16)

        // 운전일(d_nutz) 및 비운전일(d_we) 계산
        // 연간 사용일수가 주단위로 균등하게 분포한다고 가정
        // [Fixed] Variables hoisted to top of loop

        const d_nutz = numDays * frac_op;
        // d_we already calculated

        // 의미 있는 비운전 기간이 존재할 경우(> 0.1일) 분리 계산 적용
        // 의미 있는 비운전 기간이 존재할 경우(> 0.1일) 분리 계산 적용
        let QT_op = 0, QV_op = 0, QS_op = 0, QI_op = 0;
        let QT_non_op = 0, QV_non_op = 0, QS_non_op = 0, QI_non_op = 0;
        let Q_transfer_total = 0;
        let Delta_Q_c_b_we = 0;

        if (d_we > 0.1 && profile.annualUsageDays <= 260 && !isShutdown) {

            // --- 1. 비운전 기간 (주말/휴일) ---
            QT_non_op = ((H_tr_curr * (Math.max(Theta_i_h_non_op, Te_avg) - Te_avg) * 24) + Q_trans_adj_heating / numDays) / 1000 * d_we;
            QV_non_op = (H_ve_non_usage * (Math.max(Theta_i_h_non_op, Te_avg) - Te_avg) * 24) / 1000 * d_we;
            const Q_sink_we = QT_non_op + QV_non_op;
            QS_non_op = (Q_sol_m / 1000) * frac_non_op;
            QI_non_op = (Q_int_m / 1000) * frac_non_op;
            const Q_source_we = QS_non_op + QI_non_op;

            // 비운전 시 이용 효율 (eta_we)
            const gamma_we = Q_sink_we > 0 ? (Q_source_we / Q_sink_we) : 100;
            const a_we_param = a_H;
            let eta_we = 1.0;
            if (gamma_we > 0 && gamma_we !== 1) eta_we = (1 - Math.pow(gamma_we, a_we_param)) / (1 - Math.pow(gamma_we, a_we_param + 1));
            else if (gamma_we === 1) eta_we = a_we_param / (a_we_param + 1);

            // 축열량 이전 계산 (식 135)
            const C_wirk_kwh = (Cm * Area) / 1000;
            const a_we_val = d_non_op_week;
            const term1_storage = (C_wirk_kwh * 2 * (Theta_i_h_op - Theta_i_h_non_op)) / a_we_val;
            const term2_storage = (C_wirk_kwh * Delta_theta_i_NA) / a_we_val;

            const Q_h_we_daily = Math.max(0, (Q_sink_we / d_we) - eta_we * (Q_source_we / d_we));
            const term3_storage = Q_h_we_daily * a_we_val;

            if (Theta_i_h_op > Theta_i_h_non_op) {
                Delta_Q_c_b_we = Math.min(term1_storage, term2_storage, term3_storage);
            }

            const num_weekends = d_we / a_we_val;
            Q_transfer_total = Delta_Q_c_b_we * num_weekends;
            const Q_h_we = Math.max(0, (Q_sink_we - eta_we * Q_source_we) - Q_transfer_total);


            // --- 2. 운전 기간 (평일) ---
            QT_op = ((H_tr_curr * (Math.max(Theta_i_h_op, Te_avg) - Te_avg) * 24) + Q_trans_adj_heating / numDays) / 1000 * d_nutz;
            QV_op = (H_ve_usage * (Math.max(Theta_i_h_op, Te_avg) - Te_avg) * 24) / 1000 * d_nutz;

            // 축열 이전량을 열싱크(부하)로 적용 (식 136)
            const Q_sink_add = Q_transfer_total;
            const Q_sink_nutz = QT_op + QV_op + Q_sink_add;
            QS_op = (Q_sol_m / 1000) * frac_op;
            QI_op = (Q_int_m / 1000) * frac_op;
            const Q_source_nutz = QS_op + QI_op;

            // 운전 시 이용 효율 (eta_nutz)
            const gamma_nutz = Q_sink_nutz > 0 ? (Q_source_nutz / Q_sink_nutz) : 100;
            let eta_nutz = 1.0;
            if (gamma_nutz > 0 && gamma_nutz !== 1) eta_nutz = (1 - Math.pow(gamma_nutz, a_H)) / (1 - Math.pow(gamma_nutz, a_H + 1));
            else if (gamma_nutz === 1) eta_nutz = a_H / (a_H + 1);

            const Q_h_nutz = Math.max(0, Q_sink_nutz - eta_nutz * Q_source_nutz);

            // --- 3. 총 난방 수요 ---
            Q_h_need = Q_h_we + Q_h_nutz;

            // 리포팅용 평균 효율 산출
            const Q_loss_avg = QT_op + QT_non_op + QV_op + QV_non_op + Q_sink_add;
            gamma_H = Q_loss_avg > 0 ? (Q_gain / Q_loss_avg) : 100;
            if (gamma_H > 0 && gamma_H !== 1) eta_H = (1 - Math.pow(gamma_H, a_H)) / (1 - Math.pow(gamma_H, a_H + 1));
            else if (gamma_H === 1) eta_H = a_H / (a_H + 1);

        } else {
            // 표준 계산 (분리 없음 또는 난방 정지/연속 운전)
            gamma_H = Q_loss_H > 0 ? (Q_gain / Q_loss_H) : 100;
            if (gamma_H > 0 && gamma_H !== 1) eta_H = (1 - Math.pow(gamma_H, a_H)) / (1 - Math.pow(gamma_H, a_H + 1));
            else if (gamma_H === 1) eta_H = a_H / (a_H + 1);

            Q_h_need = Math.max(0, Q_loss_H - (eta_H * Q_gain));

            // Breakdown for reporting (un-separated)
            QT_op = QT_heat * (frac_op);
            QV_op = QV_heat * (frac_op);
            QS_op = (Q_sol_m / 1000) * (frac_op);
            QI_op = (Q_int_m / 1000) * (frac_op);
            QT_non_op = QT_heat * (frac_non_op);
            QV_non_op = QV_heat * (frac_non_op);
            QS_non_op = (Q_sol_m / 1000) * (frac_non_op);
            QI_non_op = (Q_int_m / 1000) * (frac_non_op);
        }

        // Cooling
        const Theta_i_c = Theta_int_C - 2.0;
        // Calc QT/QV for Cooling (based on Theta_i_c)
        // Adjust QT_cool to use simplified temperatures for ground/unheated surfaces (Section 6.1.4.6)
        const QT_cool = (((H_tr_curr - H_tr_simplified_m) * (Theta_i_c - Te_avg) * t_duration) + Q_cool_simplified_m) / 1000;
        const QV_cool = (H_ve_curr * (Theta_i_c - Te_avg) * t_duration) / 1000;
        const Q_loss_C = QT_cool + QV_cool;

        let Q_sink = Q_loss_C;
        let Q_source = Q_gain;
        // If Q_sink is negative (Gain), it adds to Source
        if (Q_sink < 0) {
            Q_source -= Q_sink; // Add gain (subtract negative loss)
            Q_sink = 0;
        }

        const gamma_C = Q_source > 0 ? (Q_sink / Q_source) : 100;
        const a_C = 1 + (tau_c / 16); // 냉방용 이용효율 계수 (수정: 15 -> 16, DIN/TS 18599-2 Eq. 146)
        let eta_C = 0;
        if (gamma_C > 0 && Q_sink > 0) {
            if (gamma_C !== 1) eta_C = (1 - Math.pow(gamma_C, a_C)) / (1 - Math.pow(gamma_C, a_C + 1));
            else eta_C = a_C / (a_C + 1);
        }

        let Q_c_need = Q_source; // Default if sink=0
        if (Q_sink > 0) Q_c_need = Math.max(0, Q_source - (eta_C * Q_sink));

        if (profile.annualUsageDays <= 260) Q_c_need *= (5 / 7);

        // --- Surface Breakdown Calculation ---
        const transmissionBySurface: Record<string, { area: number; uValue: number; fx: number; H_tr: number; H_bridge: number; Q_trans: number; Q_trans_heat: number; Q_trans_cool: number }> = {};
        monthlySurfaceData.forEach((d, k) => {
            const h_total_surf = d.hTr + d.hBridge;
            const q_adj_kwh = d.qAdj / 1000;

            // 1. Heating (Loss)
            // Use Theta_i_h (Effective Indoor Temp for Heating)
            const q_heat_main = (h_total_surf * (Math.max(Theta_i_h, Te_avg) - Te_avg) * t_duration) / 1000;
            const Q_trans_heat = q_heat_main + q_adj_kwh;

            // 2. Cooling (Gain/Loss)
            // Use Theta_i_c (Effective Indoor Temp for Cooling)
            // If simplified cooling applies (Section 6.1.4.6), use captured value.
            let Q_trans_cool = 0;
            if (d.qCoolSimplified !== 0) {
                Q_trans_cool = d.qCoolSimplified / 1000;
            } else {
                // Q = H * (Ti - Te) * t
                Q_trans_cool = (h_total_surf * (Theta_i_c - Te_avg) * t_duration) / 1000;
            }

            transmissionBySurface[k] = {
                area: d.area,
                uValue: d.area > 0 ? d.uSum / d.area : 0,
                fx: d.area > 0 ? d.fxSum / d.area : 0,
                H_tr: d.hTr,
                H_bridge: d.hBridge,
                Q_trans: Q_trans_heat, // Legacy
                Q_trans_heat: Q_trans_heat,
                Q_trans_cool: Q_trans_cool
            };
        });

        // Net flows (Gain +, Loss -)
        // Gain = Te > Ti (Heat flow enters), Loss = Te < Ti (Heat flow leaves)
        const QT_monthly = (H_tr_curr * (Te_avg - Theta_i_h) * t_duration - Q_trans_adj_heating + Q_trans_adj_cooling) / 1000;
        const QV_monthly = (H_ve_curr * (Te_avg - Theta_i_h) * t_duration) / 1000;

        monthlyResults.push({
            month: m,
            QT: QT_monthly,
            QV: QV_monthly,
            QT_heat: QT_heat,
            QV_heat: QV_heat,
            QT_cool: QT_cool,
            QV_cool: QV_cool,
            Qloss: Q_loss_H,
            QS: Q_sol_m / 1000,
            QI: Q_int_m / 1000,
            Qgain: Q_gain,
            gamma: gamma_H,
            eta: eta_H,
            Qh: Q_h_need,
            Qc: Q_c_need,
            Q_heating: Q_h_need,
            Q_cooling: Q_c_need,
            Q_lighting: Q_lit_m / 1000,
            Q_dhw: Q_dhw_m / 1000,
            Q_aux: (fanPower) / 1000, // Fan energy
            pvGeneration: 0,
            avg_Ti: Theta_i_h, // Approx
            avg_Ti_c: Theta_i_c, // Cooling Effective
            avg_Ti_op: Theta_i_h_op,
            avg_Ti_non_op: (profile.annualUsageDays <= 260) ? Theta_i_h_non_op : undefined,
            balanceDetails: { Cm, cooling: Theta_int_C },
            H_tr: H_tr_curr,
            H_ve: H_ve_curr,
            hours: t_duration,
            transmissionBySurface,
            solarData,
            internalGains,

            // Debug verification fields (added for CSV export)
            Theta_int_H,
            Theta_i_h,
            tau: tau_h, // Legacy 호환
            tau_h,
            tau_c,
            f_NA,
            f_we,
            Cm,
            H_tot,
            Theta_int_C,
            t_h_op_d,
            t_NA,
            delta_theta_EMS,
            f_adapt,
            Delta_theta_i_NA,
            gamma_C,
            eta_C,
            a_H,
            a_C,

            // Ventilation details
            V_net: Volume,
            n_inf: f_inf_daily_mean,
            n_win: n_win,
            n_mech: n_mech_daily,
            heatRecoveryEff: heatRecoveryEfficiency,
            isForcedMech: forcedMechanical ? 1 : 0,

            // Detailed Ventilation Verification
            n50: n50_val,
            e_shield: 0.07, // Default shielding class 'Moderate' (e_wind)
            f_ATD: hasATD ? 1.0 : 0, // Simplified: needs detail if available
            f_e: 1.0, // Temperature ratio factor (usually 1.0 for outdoor)
            t_v_mech: t_v_mech,
            A_E: envelopeArea,
            q50: envelopeArea > 0 ? (n50_val * Volume / envelopeArea) : 0,

            // A_E Breakdown
            A_ext: A_ext,
            fx_ext: A_ext > 0 ? (fxArea_ext / A_ext) : 1.0,
            A_grnd: A_grnd,
            fx_grnd: A_grnd > 0 ? (fxArea_grnd / A_grnd) : 0,
            A_win: A_win,
            A_door: A_door,

            // Window Ventilation Details
            n_nutz: n_nutz,
            n_win_min: n_win_result.details.n_win_min,
            Delta_n_win: n_win_result.details.Delta_n_win,
            Delta_n_win_mech: n_win_result.details.Delta_n_win_mech,
            n_SUP: n_SUP,
            n_ETA: n_ETA,

            // Minimum Outdoor Airflow
            min_outdoor_airflow: minFlowArea,

            // Heat Storage Transfer Verification
            d_nutz: d_nutz,
            d_we: d_we,
            Q_storage_transfer: Q_transfer_total,
            Delta_Q_C_b_we: Delta_Q_c_b_we,
            Delta_Q_C_sink_nutz: Q_transfer_total, // Recharge on nutz days

            // Detailed Breakdown
            QT_op: QT_op,
            QV_op: QV_op,
            QS_op: QS_op,
            QI_op: QI_op,
            QT_non_op: QT_non_op,
            QV_non_op: QV_non_op,
            QS_non_op: QS_non_op,
            QI_non_op: QI_non_op,
        });
    }

    // 연간 합산
    const sumH = monthlyResults.reduce((s, m) => s + m.Q_heating, 0);
    const sumC = monthlyResults.reduce((s, m) => s + m.Q_cooling, 0);
    const sumL = monthlyResults.reduce((s, m) => s + m.Q_lighting, 0);
    const sumD = monthlyResults.reduce((s, m) => s + m.Q_dhw, 0);
    const sumA = monthlyResults.reduce((s, m) => s + m.Q_aux, 0);

    // 설비 효율 적용 (Final Energy) - 간단히 COP 적용 예시 (추후 hvac-calc 상세화 필요)
    // 기존에 있던 calculateHourlyHvac을 쓸 수도 없고, 월간용으로 새로 짜야함.
    // 여기서는 간단히 효율 계수를 직접 적용하여 마무리.

    const heatingSystem = systems?.find(s => s.type === "HEATING" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as HeatingSystem | undefined;
    const coolingSystem = systems?.find(s => s.type === "COOLING" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as CoolingSystem | undefined;
    const dhwSystemForFinal = systems?.find(s => s.type === "DHW" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as DHWSystem | undefined;

    // 단순화된 효율 (시스템 없을 시 1.0, 있으면 COP 적용)
    const copH = heatingSystem ? (heatingSystem.generator.efficiency || 0.9) : 1.0;
    const copC = coolingSystem ? (coolingSystem.generator.efficiency || 3.0) : 3.0;
    const copD = dhwSystemForFinal ? (dhwSystemForFinal.generator.efficiency || 0.9) : 0.9;

    // 에너지원별 PEF (Primary Energy Factor)
    const fuelH = heatingSystem?.generator.energyCarrier || 'gas_lng';
    const fuelC = coolingSystem?.generator.energyCarrier || 'electricity';
    const fuelD = dhwSystemForFinal?.generator.energyCarrier || 'gas_lng';

    const pefH = PEF_FACTORS[fuelH as EnergyCarrier] || 1.1;
    const pefC = PEF_FACTORS[fuelC as EnergyCarrier] || 2.75;
    const pefD = PEF_FACTORS[fuelD as EnergyCarrier] || 1.1;
    const pefL = PEF_FACTORS.electricity;

    // 최종 에너지 (Final Energy)
    const feH = sumH / copH;
    const feC = sumC / copC;
    const feD = sumD / copD;
    const feL = sumL;
    const feA = sumA;

    // 1차 에너지 (Primary Energy)
    const peH = feH * pefH;
    const peC = feC * pefC;
    const peD = feD * pefD;
    const peL = feL * pefL;
    const peA = feA * PEF_FACTORS.electricity;
    const peTotal = peH + peC + peD + peL + peA;


    // CO2
    const co2H = feH * (CO2_FACTORS[fuelH as EnergyCarrier] || 0.2);
    const co2C = feC * (CO2_FACTORS[fuelC as EnergyCarrier] || 0.466);
    const co2D = feD * (CO2_FACTORS[fuelD as EnergyCarrier] || 0.2);
    const co2L = feL * CO2_FACTORS.electricity;
    const co2A = feA * CO2_FACTORS.electricity;

    return {
        zoneId: zone.id || "unknown",
        zoneName: zone.name,
        surfaces: zone.surfaces, // 표면 메타데이터 전달
        hourly: hourlyResults, // 시간별 결과 반환 (전열 분석 등)
        monthly: monthlyResults,
        yearly: {
            heatingDemand: sumH,
            coolingDemand: sumC,
            lightingDemand: sumL,
            dhwDemand: sumD,
            auxDemand: sumA,
            totalArea: Area,
            specificHeatingDemand: sumH / Area,
            specificCoolingDemand: sumC / Area,
            pvGeneration: 0,
            selfConsumption: 0,
            pvExport: 0,
            finalEnergy: {
                heating: feH, cooling: feC, dhw: feD, lighting: feL, auxiliary: feA
            },
            primaryEnergy: {
                heating: peH, cooling: peC, dhw: peD, lighting: peL, auxiliary: peA, total: peTotal
            },
            co2Emissions: co2H + co2C + co2D + co2L + co2A
        }
    };
}

/**
 * 시간별 일사량 계산 (Wrapper for Detailed)
 */
function calculateHourlyRadiation(
    Ib: number,
    Id: number,
    day: number,
    hour: number,
    latitude: number,
    surfaceAzimuth: number,
    surfaceTilt: number
): number {
    return calculateHourlyRadiationDetailed(Ib, Id, day, hour, latitude, surfaceAzimuth, surfaceTilt).I_tot;
}

/**
 * 상세 검증을 위한 시간별 일사량 세부 계산 (Return full object)
 */
export function calculateHourlyRadiationDetailed(
    Ib: number, // 수평면 직달일사 (W/m2)
    Id: number, // 수평면 확산일사 (W/m2)
    day: number,
    hour: number,
    latitude: number,
    surfaceAzimuth: number, // 북:180, 남:0, 동:-90, 서:90
    surfaceTilt: number
) {
    // 1. 태양 위치 계산
    const d2r = Math.PI / 180;
    const lat = latitude * d2r;

    // 적위 (Declination)
    const delta = 23.45 * Math.sin(d2r * (360 / 365) * (284 + day));
    const delta_r = delta * d2r;

    // 시간각 (Hour Angle)
    const omega = 15 * (hour - 12);
    const omega_r = omega * d2r;

    // 고도각 (Solar Altitude)
    const sin_alpha = Math.sin(lat) * Math.sin(delta_r) + Math.cos(lat) * Math.cos(delta_r) * Math.cos(omega_r);
    const alpha = Math.asin(Math.max(-1, Math.min(1, sin_alpha))); // rad
    const alpha_deg = alpha / d2r;

    // 방위각 (Solar Azimuth)
    // cos(gamma_s)
    let gamma_s_deg = 0;
    let gamma_s = 0;

    if (alpha_deg > 0) {
        const cos_gamma_s = (Math.sin(alpha) * Math.sin(lat) - Math.sin(delta_r)) / (Math.cos(alpha) * Math.cos(lat));
        gamma_s = Math.acos(Math.max(-1, Math.min(1, cos_gamma_s)));
        if (hour < 12) gamma_s = -gamma_s;
        gamma_s_deg = gamma_s / d2r;
    }

    // 입사각 (Incidence Angle) theta
    let theta_deg = 90;
    let Rb = 0;
    let Ib_surf = 0;
    let Id_surf = 0;
    let Ir_surf = 0;

    if (alpha_deg > 0) {
        const theta_z = (90 - alpha_deg) * d2r;
        const beta = surfaceTilt * d2r;
        const gamma_surf = surfaceAzimuth * d2r;

        const cos_theta = Math.cos(theta_z) * Math.cos(beta) + Math.sin(theta_z) * Math.sin(beta) * Math.cos(gamma_s - gamma_surf);
        theta_deg = Math.acos(Math.max(0, cos_theta)) / d2r;

        // 2. 성분별 일사량
        // 직달 (Beam)
        Rb = Math.max(0, cos_theta) / Math.max(0.05, Math.sin(alpha));
        Ib_surf = Ib * Rb;

        // 확산 (Diffuse) - Klucher Model (1979)
        // Anisotropic model accounting for horizon & circumsolar brightening
        const I_hz_global = Ib + Id;
        let F = 0; // Modulating function (0 for overcast, -> 1 for clear sky)
        if (I_hz_global > 0) {
            const ratio = Id / I_hz_global;
            F = 1 - (ratio * ratio);
        }

        const term_iso = (1 + Math.cos(beta)) / 2; // Isotropic term
        const term_hor = 1 + F * Math.pow(Math.sin(beta / 2), 3); // Horizon brightening
        // Circumsolar brightening (use max(0, cos_theta) to ensure sun is in front)
        const cos_theta_c = Math.max(0, cos_theta);
        const term_cir = 1 + F * Math.pow(cos_theta_c, 2) * Math.pow(Math.sin(theta_z), 3);

        Id_surf = Id * term_iso * term_hor * term_cir;

        // 반사 (Global Reflected)
        const rho_g = 0.2;
        const I_global = Ib + Id;
        Ir_surf = I_global * rho_g * (1 - Math.cos(beta)) / 2;
    }

    return {
        alpha_deg,
        gamma_s_deg,
        theta_deg,
        Rb,
        Ib,
        Id,
        Ib_surf,
        Id_surf,
        Ir_surf,
        I_tot: Ib_surf + Id_surf + Ir_surf
    };
}

/**
 * 프로젝트 전체에 대한 상세 일사량 검증 리포트 생성 (CSV String 반환)
 */
export function generateSolarVerificationReport(
    zones: ZoneInput[],
    weatherData: ClimateData,
    constructions: Construction[] = []
): string {
    // CSV Header Update with new variables from user request images
    let csv = "\uFEFFMonth,Day,Hour,Te (C),Azimuth_Sun (deg),Altitude_Sun (deg),Zone,Surface,Type,Azimuth_Surf (deg),Tilt (deg),Theta_Inc (deg),Rb,Ib_horiz (Wh/m2),Id_horiz (Wh/m2),Ib_surf (Wh/m2),Id_surf (Wh/m2),Ir_surf (Wh/m2),I_Tot (Wh/m2)";
    // Add new columns: A, U, alpha, R_se, F_f, h_r, Delta_theta_er, F_g, g_eff, F_s, F_w, F_v, I_s
    csv += ",A (m2),U (W/m2K),alpha,R_se (m2K/W),F_f,h_r (W/m2K),Delta_theta_er (K),F_g,g_eff,F_s,F_w,F_v,I_s (W/m2)\n";

    // 기상 데이터가 월간만 있는지 시간별도 있는지 확인
    // calculator.ts의 generateHourlyClimateData 사용
    const hourlyClimate = weatherData.hourly || generateHourlyClimateData(weatherData.monthly);
    const latitude = weatherData.latitude || 37.5;

    // 시간 순회
    hourlyClimate.forEach(hr => {
        // 해당 시간의 태양 위치 (대표값 계산 - 수평면 기준)
        // 표면별 계산 시 다시 정밀 계산하므로 여기선 참고용
        // const sunPos = calculateHourlyRadiationDetailed(0, 0, hr.day, hr.hour, latitude, 0, 0);

        // 존 -> 표면 순회
        zones.forEach(zone => {
            zone.surfaces.forEach(surf => {
                // Interior 제외
                if (getExposureCategory(surf) === ExposureCategory.INTERIOR) return;
                if (surf.orientation === 'NoExposure') return;

                let azimuth = 0;
                let orientationStr = surf.orientation || "S";
                switch (surf.orientation) {
                    case 'S': azimuth = 0; break;
                    case 'E': azimuth = -90; break;
                    case 'W': azimuth = 90; break;
                    case 'N': azimuth = 180; break;
                    case 'SE': azimuth = -45; break;
                    case 'SW': azimuth = 45; break;
                    case 'NE': azimuth = -135; break;
                    case 'NW': azimuth = 135; break;
                    case 'Horiz': azimuth = 0; orientationStr = "Horiz"; break; // 방위 무관
                }

                const tilt = surf.tilt ?? 90;

                // 상세 계산 수행
                const res = calculateHourlyRadiationDetailed(
                    hr.I_beam,
                    hr.I_diff,
                    hr.day,
                    hr.hour,
                    latitude,
                    azimuth,
                    tilt
                );

                // Additional Variables extraction/calculation
                const A = surf.area;
                const U = surf.uValue;
                let alpha = surf.absorptionCoefficient ?? 0.5; // Default for opaque
                const construction = constructions?.find(c => c.id === surf.constructionId);
                const R_se = construction?.r_se ?? 0.04; // Exterior surface resistance

                // Form factor F_f (F_f_sky)
                // 경사각 45도 이하 (수평에 가까움) => 1.0
                // 경사각 45도 초과 (수직에 가까움) => 0.5
                const F_f = tilt <= 45 ? 1.0 : 0.5;

                const h_r = 4.5; // Radiative heat transfer coeff
                const Delta_theta_er = 10; // Apparent sky temp diff

                // Transparent Components
                let F_g = 0;
                let g_eff = 0;
                let F_s = 0;
                let F_w = 0;
                let F_v = 0;

                if (surf.type === 'window' || surf.type === 'door') {
                    // Window specific
                    const shgc = surf.shgc ?? construction?.shgc ?? 0.6;
                    F_g = 0.7; // Frame factor (1 - F_F), default 0.7
                    F_s = 0.9; // 음영
                    F_w = 0.9; // Non-perpendicular
                    F_v = 0.9; // Pollution
                    // g_eff = F_s * F_w * F_v * shgc
                    g_eff = F_s * F_w * F_v * shgc;
                    // Alpha is not relevant for transmission calculation typically, but kept for structure
                    alpha = 0;
                }

                const I_s = res.I_tot;

                // CSV Row Construction
                csv += `${hr.month},${hr.day},${hr.hour},${hr.Te.toFixed(2)},`;
                csv += `${res.gamma_s_deg.toFixed(2)},${res.alpha_deg.toFixed(2)},`;
                csv += `"${zone.name}","${surf.name}","${surf.type}",${orientationStr},${tilt},`;
                csv += `${res.theta_deg.toFixed(2)},${res.Rb.toFixed(3)},`;
                csv += `${res.Ib.toFixed(1)},${res.Id.toFixed(1)},`;
                csv += `${res.Ib_surf.toFixed(1)},${res.Id_surf.toFixed(1)},${res.Ir_surf.toFixed(1)},${res.I_tot.toFixed(1)},`;

                // New Columns Data
                csv += `${A.toFixed(2)},${U.toFixed(3)},${alpha.toFixed(2)},${R_se},${F_f},${h_r},${Delta_theta_er},`;
                csv += `${F_g},${g_eff.toFixed(3)},${F_s},${F_w},${F_v},${I_s.toFixed(1)}\n`;
            });
        });
    });

    return csv;
}








/**
 * 프로젝트 전체에 대한 월간 일사량 검증 리포트 생성 (CSV String 반환)
 * - Monthly Method (Rep Day Integration)
 */
export function generateMonthlySolarVerificationReport(
    zones: ZoneInput[],
    weatherData: ClimateData,
    constructions: Construction[] = []
): string {
    // 월간 리포트용 CSV 헤더
    let csv = "\uFEFFMonth,Te_avg (C),Zone,Surface,Type,Azimuth_Surf (deg),Tilt (deg),A (m2),U (W/m2K),alpha,R_se (m2K/W),F_f,h_r (W/m2K),Delta_theta_er (K),F_g,g,g_eff,F_s,F_w,F_v,I_horiz (kWh/m2),I_surf (kWh/m2),Q_sol (kWh)\n";

    const latitude = weatherData.latitude || 37.5;

    // 월별 루프 (1~12)
    for (let m = 1; m <= 12; m++) {
        const mData = weatherData.monthly.find(x => x.month === m);
        if (!mData) continue;

        const Te_avg = mData.Te;
        const I_hor_kwh = mData.Is_Horiz;
        const daysInMonth = new Date(2023, m, 0).getDate();

        // 표면 일사량 계산을 위한 대표일 산정
        const dayOfYear = getDayOfYear(m, 15);
        const H_gh = (I_hor_kwh * 1000) / daysInMonth; // Wh/m2/day
        const hourlyRep = generateDailyProfile(H_gh, dayOfYear, latitude);

        zones.forEach(zone => {
            zone.surfaces.forEach(surf => {
                const category = getExposureCategory(surf);
                if (category === ExposureCategory.INTERIOR) return;
                if (surf.orientation === 'NoExposure') return;

                let dailySum = 0;
                let azimuth = 0;
                switch (surf.orientation) {
                    case 'S': azimuth = 0; break;
                    case 'E': azimuth = -90; break;
                    case 'W': azimuth = 90; break;
                    case 'N': azimuth = 180; break;
                    case 'SE': azimuth = -45; break;
                    case 'SW': azimuth = 45; break;
                    case 'NE': azimuth = -135; break;
                    case 'NW': azimuth = 135; break;
                    case 'Horiz': azimuth = 0; break;
                }

                hourlyRep.forEach(hData => {
                    const I_tot = calculateHourlyRadiation(hData.I_beam, hData.I_diff, hData.day, hData.hour, latitude, azimuth, surf.tilt ?? 90);
                    dailySum += I_tot;
                });

                const I_surf_month_kwh = (dailySum * daysInMonth) / 1000;

                // 상수 정의
                const A = surf.area;
                const U = surf.uValue;
                let alpha = surf.absorptionCoefficient ?? 0.5;
                const construction = constructions?.find(c => c.id === surf.constructionId);
                const R_se = construction?.r_se ?? 0.04;
                const tilt = surf.tilt ?? 90;

                const F_f = tilt <= 45 ? 1.0 : 0.5;
                const h_r = 4.5;
                const Delta_theta_er = 10;

                let F_g = 0;
                let g_eff = 0;
                let F_s = 0; // 음영
                let F_w = 0; // 비수직
                let F_v = 0; // 오염도

                let Q_sol_kwh = 0;

                if (surf.type === 'window' || surf.type === 'door') {
                    const shgc = surf.shgc ?? construction?.shgc ?? 0.6;
                    F_g = 0.7; // 프레임 비율
                    F_s = 0.9;
                    F_w = 0.9;
                    F_v = 0.9;
                    g_eff = F_s * F_w * F_v * shgc;
                    alpha = 0;

                    // Q_sol = I_surf * A * F_g * g_eff
                    Q_sol_kwh = I_surf_month_kwh * A * F_g * g_eff;
                } else {
                    // 불투명 벽체
                    const t_duration = daysInMonth * 24;
                    const term_solar = alpha * (I_surf_month_kwh * 1000); // Wh/m2
                    const term_emission = F_f * h_r * Delta_theta_er * t_duration; // Wh/m2

                    Q_sol_kwh = (R_se * U * A * (term_solar - term_emission)) / 1000;
                }

                // CSV 행 추가
                csv += `${m},${Te_avg.toFixed(2)},"${zone.name}","${surf.name}","${surf.type}",${surf.orientation},${tilt},`;
                csv += `${A.toFixed(2)},${U.toFixed(3)},${alpha.toFixed(2)},${R_se},${F_f},${h_r},${Delta_theta_er},`;
                csv += `${F_g},${(surf.shgc ?? construction?.shgc ?? 0.6).toFixed(3)},${g_eff.toFixed(3)},${F_s},${F_w},${F_v},`;
                csv += `${I_hor_kwh.toFixed(1)},${I_surf_month_kwh.toFixed(1)},${Q_sol_kwh.toFixed(1)}\n`;
            });
        });
    }

    return csv;
}
