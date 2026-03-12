import { BuildingSystem, EnergyCarrier } from "@/types/system";
import { ZoneInput, CalculationResults, MonthlyResult, HourlyResult, ZoneResult, SurfaceHourlyResult, ClimateData } from "./types";
import { Project, Construction } from "@/types/project";
import { getClimateData, generateHourlyClimateData } from "./climate-data";
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
    // 유효 두께(d_eff)는 10cm 또는 단열층까지로 제한됩니다.
    // 단순화: 실내측에서 100mm까지 고려 (layers[0]이 보통 실외? 순서 확인 필요. 관례: 0=실외, 마지막=실내).
    // beatPlus 관례: 레이어 순서는 실외 -> 실내 ? project.ts 또는 UI 확인 필요.
    // 표준 UI는 보통 상단=실외.
    // 레이어 순서를 0=실외, N=실내로 가정.
    // 실내측에서 역순으로 반복.

    let totalCm = 0;
    let d_accumulated = 0;
    const d_max = 0.1; // 10cm 제한

    // 실내측에서 반복하기 위해 레이어 배열 역순 복사
    const layers = [...construction.layers].reverse();

    for (const layer of layers) {
        if (d_accumulated >= d_max) break;

        const d_eff = Math.min(layer.thickness, d_max - d_accumulated);
        const density = layer.density || 0;
        const specificHeat = layer.specificHeat || 0; // J/kgK

        // 단열재(lambda < ?)인 경우 중단?
        // DIN 18599: 단열층에서 중단.
        if ((layer.thermalConductivity || 100) < 0.1) { // 단열재 확인
            // 이 단열층을 포함할 것인가? 보통 열용량 산정에는 포함하지 않음.
            // 여기서 중단.
            break;
        }

        totalCm += (density * specificHeat * d_eff); // J/m2K
        d_accumulated += d_eff;
    }

    return totalCm / 3600; // J/m2K -> Wh/m2K
}

/**
 * DIN/TS 18599-2:2025-10 표 7 - 경사 보정 계수 (f_neig)
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
 * 투명 부재에 대한 경사 보정 계수(f_neig)를 계산합니다.
 * 중간 각도에 대해서는 선형 보간법을 사용합니다.
 * 명시되지 않은 경우 기본적으로 복층 유리를 가정합니다.
 */
function getInclinationFactor(tilt: number, glazingType: "single" | "double" | "triple" = "double"): number {
    // 경사각을 0~90도로 제한
    const angle = Math.max(0, Math.min(90, tilt));

    // 하한 및 상한 인덱스 찾기
    const lowerIndex = F_NEIG_TABLE.findIndex((entry, i) => {
        const next = F_NEIG_TABLE[i + 1];
        return angle >= entry.angle && (!next || angle <= next.angle);
    });

    if (lowerIndex === -1) return 1.0; // 제한(clamp)으로 인해 발생하지 않아야 함

    const lower = F_NEIG_TABLE[lowerIndex];
    const upper = F_NEIG_TABLE[lowerIndex + 1] || lower;

    if (lower.angle === upper.angle) return lower[glazingType];

    // 선형 보간
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
        // 총 열저항 R_total = 1 / U
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
    n_SUP: number = 0, // 급기 환기 횟수 [1/h]
    n_ETA: number = 0, // 배기 환기 횟수 [1/h]
    f_adapt: number = 1.0 // 불균형 보정 계수 (식 72) - 미계산 시 1.0
): { rate: number; details: { n50: number; e_shield: number; f_wind: number; f_ATD: number; fe: number } } {
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
    let rate = 0;
    let fe = 1.0;
    const f_wind = 15.0; // 풍압 계수 (Wind exposure, 기본값 15)
    let f_system_factor = 1.0; // 시스템 동작 유무에 따른 보정

    if (ventType === "natural") {
        // 식 66 (자연환기)
        fe = 1.0;
        f_system_factor = 1.0;
        rate = n50 * e * f_ATD * f_system_factor;
    } else {
        // 식 67 (기계환기)
        if (isBalanced && n_SUP === n_ETA) {
            fe = 1.0; // 식 71
        } else {
            // 식 72: fe = 1 / (1 + (f/e) * ((n_ETA - n_SUP) / (n50 * f_ATD))^2)
            const diff = (n_ETA - n_SUP) / (n50 * f_ATD);
            fe = 1 / (1 + (f_wind / e) * Math.pow(diff, 2));
        }
        f_system_factor = 1 + (dailyOpHours / 24) * (fe - 1);
        rate = n50 * e * f_ATD * f_system_factor;
    }
    return { rate, details: { n50, e_shield: e, f_wind, f_ATD, fe } };
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
export function calculateRequiredAirChange(
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
    hasWindows: boolean, // [New] 창문(개구부) 유무
    infiltrationParams?: { n50: number; e: number; f_ATD: number; fe: number } // [New] for Mech Vent calc
): { rate: number; rate_tau: number; details: { n_win_min: number; Delta_n_win: number; Delta_n_win_mech: number; Delta_n_win_mech_0: number } } {
    // 1. 최소 창문 환기 횟수 (n_win,min) 및 계절 보정된 최소 횟수 (n_win_min_mth) 결정
    // 주거: 0.1, 비주거: min(0.1, 0.3 / h_R)
    if (!hasWindows) {
        return { rate: 0, rate_tau: 0, details: { n_win_min: 0, Delta_n_win: 0, Delta_n_win_mech: 0, Delta_n_win_mech_0: 0 } };
    }

    let n_win_min = 0; // 시상수(tau) 계산용, 계절 보정 없는 순수 기본값
    if (isResidential) {
        n_win_min = 0.1;
    } else {
        const val = (roomHeight > 0) ? (0.3 / roomHeight) : 0.1;
        n_win_min = Math.min(0.1, val);
    }

    // 월별 사용을 위한 계절 보정 최소 환기 횟수 (식 79 등 파생)
    let n_win_min_mth = n_win_min;
    if (isResidential) {
        n_win_min_mth = n_win_min * calculateSeasonalFactor(theta_e);
    }

    // 침기 보정: 기계 환기가 없고 주말/휴일일 때 (또는 상시)
    // 식 80, 83, 84 등 적용을 위해 Delta_n_win 계산
    // 논리 분기: 기계 환기 여부

    const t_nutz = mechVent.t_nutz; // 사용 시간 (프로필)
    const t_v_mech = mechVent.dailyOpHours;

    let Delta_n_win = 0;
    let Delta_n_win_mech = 0; // 보고용

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

        // --- rate: 계절별 열수지 계산용 ---
        // 최종 n_win_mth (식 80 기반 월간 보정)
        // 공식적으로 n_win_min_mth를 기반에 두고, 비주거의 경우 계절보정이 없으므로 n_win_min = n_win_min_mth임
        // 주거의 경우 전체 식에 계절보정(calculateSeasonalFactor)을 곱함 (식 76, 77)
        let n_win_mth = n_win_min + Delta_n_win * (t_nutz / 24);
        if (isResidential) {
            n_win_mth = n_win_mth * calculateSeasonalFactor(theta_e);
        }

        // --- rate_tau: 계절 보정 배제(Zeitkonstante) ---
        // 시상수 계산에는 엄밀하게 f_win,seasonal를 적용하지 않은 식 80 그대로 사용
        const n_win_tau = n_win_min + Delta_n_win * (t_nutz / 24);

        return { rate: n_win_mth, rate_tau: n_win_tau, details: { n_win_min, Delta_n_win, Delta_n_win_mech: 0, Delta_n_win_mech_0: 0 } };

    } else {
        // --- 기계 환기 있음 (6.3.2.2 중간~하단) ---
        // 추가 필요 환기량 Delta_n_win,mech 계산 (식 85-90)

        // 우선 식 85, 86을 통해 Delta_n_win,mech,0 (기본값) 계산
        // n_inf_0는 6.3.1에서 구한 n_inf (기계환기 영향 없는 기본 침기? 식 66 기준)
        // "n_inf,0 der mittlere tägliche Infiltrationsluftwechsel nach Gleichung (66)" -> 즉 자연침기 상태 값.
        // 현재 매개변수 n_inf는 이미 기계환기 영향(fe)이 포함되었을 수 있음.
        // n_inf_0를 역산하거나 별도로 받아야 함. 일단 n_inf를 그대로 근사치로 사용 (fe=1이면 동일).

        // n_inf 대신 n_inf_0(자연상태 침기)를 써야 함.
        // n_inf_0 = n50 * e * f_ATD

        let Delta_n_win_mech_0 = 0; // Restore declaration
        let n_inf_0 = n_inf; // Fallback
        let fe = 1.0;

        if (infiltrationParams) {
            n_inf_0 = infiltrationParams.n50 * infiltrationParams.e * infiltrationParams.f_ATD;
            fe = infiltrationParams.fe;
        }

        if (n_nutz < 1.2) {
            // 식 85: n_inf_0 사용
            Delta_n_win_mech_0 = Math.max(0, n_nutz - (n_nutz - 0.2) * n_inf_0 * fe - 0.1);
        } else {
            // 식 86: n_inf_0 사용
            Delta_n_win_mech_0 = Math.max(0, n_nutz - n_inf_0 * fe - 0.1);
        }

        // Case 구분 (a: 급기로 커버됨, b: 급기로 커버 안됨)
        // n_SUP: 기계 급기 + 인접 유입
        // n_ETA: 기계 배기 + 인접 유출

        const n_SUP = mechVent.n_SUP;
        const n_ETA = mechVent.n_ETA;
        const n_inf_combined = n_inf_0; // According to strict interpretation of Eq 87-90, n_inf_0 (natural) is used?
        // NotebookLM says "n_inf,0 der mittlere tägliche Infiltrationsluftwechsel".
        // And checks n_ETA <= (n_SUP + n_inf,0).
        // So use n_inf_0 here.

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

        // 최종 n_win 결정 논리
        let n_win_mth = 0; // 계절 보정 반영(열수지용)
        let n_win_tau = 0; // 계절 보정 배제(시상수용)
        let Delta_n_win_no_mech = 0;

        // 최종 합산 로직
        if (t_v_mech >= t_nutz) {
            // 식 83 (표준 가동 시간 확보)
            n_win_mth = n_win_min_mth + Delta_n_win_mech * (t_v_mech / 24);
            n_win_tau = n_win_min + Delta_n_win_mech * (t_v_mech / 24);
        } else {
            // 식 84 (운전시간 부족) 추가 환기분은 기계 환기 없을 때의 로직으로
            if (n_nutz < 1.2) {
                Delta_n_win_no_mech = Math.max(0, n_nutz - (n_nutz - 0.2) * n_inf - 0.1);
            } else {
                Delta_n_win_no_mech = Math.max(0, n_nutz - n_inf - 0.1);
            }

            // 열수지용(mth) 공식: (이 부분도 보통 계절보정은 n_win_min_mth에 분리 곱합)
            n_win_mth = n_win_min_mth
                + Delta_n_win_no_mech * ((t_nutz - t_v_mech) / 24)
                + Delta_n_win_mech * (t_v_mech / 24);

            // 시상수용(tau) 공식: 오직 n_win_min 베이스
            n_win_tau = n_win_min
                + Delta_n_win_no_mech * ((t_nutz - t_v_mech) / 24)
                + Delta_n_win_mech * (t_v_mech / 24);
        }

        return {
            rate: n_win_mth,
            rate_tau: n_win_tau, // [수정] 시상수(Tau) 계산용 기본 환기율 (안정적, 보정 배제)
            details: {
                n_win_min,
                Delta_n_win: Delta_n_win_no_mech,  // If mech active but insufficient time, this is relevant
                Delta_n_win_mech,
                Delta_n_win_mech_0
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
export function processMonthlyWeather(
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

        // EPW 시간별 데이터 사용 가능
        if (hourlyWeather && hourlyWeather.length > 0) {
            // 해당 월의 시간 데이터 필터링
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
                // 시간별 데이터에 해당 월 데이터가 없는 경우 대체 (유효한 EPW에서는 발생하지 않아야 함)
                // 대표일 방식 사용
                const Is_hor_kwh = mClimate.Is_Horiz;
                const daysInMonth = new Date(2023, m, 0).getDate(); // 기준 연도 2023
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
                        // 월간 총량을 구하기 위해 월 일수를 곱함?
                        // 아님, generateDailyProfile은 1일분임. 여기서 1일분을 누적함.
                        // 나중에 곱함.
                        monthlySumSurf[surf.id] = (monthlySumSurf[surf.id] || 0) + (I_tot * daysInMonth);
                    });
                });
            }
        }
        // 레거시 / 합성 방식 (대표일)
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
    if (cosH > 1) return []; // 항상 밤

    const ws = Math.acos(Math.max(-1, Math.min(1, cosH))); // 시간각 (hour angle)
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
        const time = h - 0.5; // 중간 시간
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

    // 0. 계산 방식 분기
    // 일관성을 위해 'hourly' 방식 제거됨.
    // if (analysisMethod === "hourly") { ... } 제거됨.

    // 기본값: 월간 수지 계산법 (기존 구현)

    // 6.2.3 인접 존 참조를 위한 Map 생성
    const zoneMap = new Map<string, ZoneInput>();
    zones.forEach(z => {
        if (z.id) zoneMap.set(z.id, z);
    });

    // 1. 기상 데이터 준비
    const climateBase = weatherData || getClimateData();
    console.log("DEBUG: climateBase keys:", Object.keys(climateBase));
    console.log("DEBUG: climateBase.monthly type:", Array.isArray(climateBase.monthly));
    // const hourlyClimate = climateBase.hourly || generateHourlyClimateData(climateBase.monthly); // 월간법을 위해 제거됨
    const latitude = climateBase.latitude || 37.5; // 누락 시 기본값: 서울

    // [신규] 설계 외기 온도(Te_min) 산출
    let Te_min = -12.0; // 기본값
    if (climateBase.hourly && climateBase.hourly.length > 0) {
        let minT = climateBase.hourly[0].Te;
        for (let i = 1; i < climateBase.hourly.length; i++) {
            if (climateBase.hourly[i].Te < minT) minT = climateBase.hourly[i].Te;
        }
        Te_min = minT;
    } else if (climateBase.monthly && climateBase.monthly.length > 0) {
        const minMonthT = Math.min(...climateBase.monthly.map(m => m.Te));
        Te_min = minMonthT - 8.0; // 추정값
    }

    // [신규] 월간 계산법 전용: 기상 데이터 전처리
    const monthlyClimateIndices = processMonthlyWeather(zones, climateBase.monthly, climateBase.hourly, latitude);

    // 구역별 계산 수행
    const zoneResults = zones.map(zone => {
        if (zone.isExcluded) return null;

        return calculateZoneMonthly(
            zone,
            monthlyClimateIndices, // [변경] 전처리된 월간 데이터 전달
            mainStructure,
            ventilationConfig,
            ventilationUnits,
            automationConfig,
            systems,
            constructions,
            zoneMap, // 6.2.3 인접 존 참조
            Te_min // [신규] 설계 외기 온도 전달
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
    // 월간 결과 집계 (프로젝트 전체)
    const projectMonthlyResults: MonthlyResult[] = [];
    for (let m = 1; m <= 12; m++) {
        // 해당 월의 유효한 존 결과 수집
        const activeZoneResults = zoneResults
            .map(z => ({
                data: z.monthly.find(zm => zm.month === m),
                area: z.yearly.totalArea
            }))
            .filter(item => item.data !== undefined) as { data: MonthlyResult, area: number }[];

        // 합계 헬퍼
        const sumField = (field: keyof MonthlyResult) => activeZoneResults.reduce((s, z) => s + ((z.data[field] as number) || 0), 0);

        // 가중 평균 헬퍼
        const weightedAvg = (field: keyof MonthlyResult) => {
            if (totalArea === 0) return 0;
            const sumProduct = activeZoneResults.reduce((s, z) => s + ((z.data[field] as number) || 0) * z.area, 0);
            return sumProduct / totalArea;
        };

        // 중첩 필드 집계 헬퍼
        const sumFieldNested = (parent: keyof MonthlyResult, field: string) =>
            activeZoneResults.reduce((s, z) => s + ((z.data[parent] as any)?.[field] || 0), 0);

        const weightedAvgNested = (parent: keyof MonthlyResult, field: string) => {
            if (totalArea === 0) return 0;
            const sumProduct = activeZoneResults.reduce((s, z) => s + ((z.data[parent] as any)?.[field] || 0) * z.area, 0);
            return sumProduct / totalArea;
        };

        projectMonthlyResults.push({
            month: m,
            QT: sumField('QT'),
            QV: sumField('QV'),
            QT_heat: sumField('QT_heat'),
            QT_cool: sumField('QT_cool'),
            QV_heat: sumField('QV_heat'),
            QV_cool: sumField('QV_cool'),
            Qloss: sumField('Qloss'),
            QS: sumField('QS'),
            QI: sumField('QI'),
            Qgain: sumField('Qgain'),
            Q_h_b: sumField('Q_h_b'),
            Q_c_b: sumField('Q_c_b'),
            Q_l_b: sumField('Q_l_b'),
            Q_w_b: sumField('Q_w_b'),
            Q_aux: sumField('Q_aux'),
            pvGeneration: 0,
            avg_Ti: weightedAvg('avg_Ti'),

            // 상세 검증 데이터 합산 (검증 추적)
            // 에너지/동력/용량 -> 합계
            // 온도/계수 -> 가중 평균
            C_wirk: sumField('C_wirk'),
            H_tr_sys: sumField('H_tr_sys'),
            H_ve_sys: sumField('H_ve_sys'),
            H_ve_mech_0: sumField('H_ve_mech_0'),

            Theta_e: activeZoneResults.length > 0 ? (activeZoneResults[0].data.Theta_e || 0) : 0, // 외기온은 동일
            Theta_i_h_soll: weightedAvg('Theta_i_h_soll'),
            Theta_i_c_soll: weightedAvg('Theta_i_c_soll'),
            Theta_i_h: weightedAvg('Theta_i_h'),
            avg_Ti_c: weightedAvg('avg_Ti_c'),

            tau: weightedAvg('tau'),
            tau_h: weightedAvg('tau_h'),
            a_H: weightedAvg('a_H'),
            gamma: weightedAvg('gamma'),
            eta: weightedAvg('eta'), // [수정] 필수 필드 누락
            eta_h: weightedAvg('eta_h'),
            eta_c: weightedAvg('eta_c'),

            Q_source: sumField('Q_source'),

            // 환기 계수 필드 추가 (누락분) - 계수(H)는 면적 가중 평균이 아닌 단순 합계(Sum)로 집계해야 프로젝트 전체의 열적 반응 특성이 맞음
            H_ve: sumField('H_ve'),
            H_ve_total: sumField('H_ve_total'),
            H_ve_inf: sumField('H_ve_inf'),
            H_ve_win: sumField('H_ve_win'),
            H_ve_mech: sumField('H_ve_mech'),
            H_ve_gross: sumField('H_ve_gross'),
            H_ve_tau_h: sumField('H_ve_tau_h'),
            H_ve_tau_c: sumField('H_ve_tau_c'),

            // [상세 검증] 사용 / 비사용 집계
            // 온도 -> 가중 평균
            tau_op: weightedAvg('tau_op'),
            tau_non_op: weightedAvg('tau_non_op'),
            alpha_op: weightedAvg('alpha_op'),
            alpha_non_op: weightedAvg('alpha_non_op'),
            eta_h_op: weightedAvg('eta_h_op'),
            eta_h_non_op: weightedAvg('eta_h_non_op'),
            Theta_i_h_op: weightedAvg('Theta_i_h_op'),
            Theta_i_h_non_op: weightedAvg('Theta_i_h_non_op'),

            // 에너지 -> 합계
            Q_source_op: sumField('Q_source_op'),
            Q_source_non_op: sumField('Q_source_non_op'),
            Q_sink_op: sumField('Q_sink_op'),
            Q_sink_non_op: sumField('Q_sink_non_op'),
            Q_h_b_op: sumField('Q_h_b_op'),
            Q_h_b_non_op: sumField('Q_h_b_non_op'),

            // 냉방
            Q_c_b_op: sumField('Q_c_b_op'),
            Q_c_b_non_op: sumField('Q_c_b_non_op'),

            // 환기 세부 내역
            QV_op: sumField('QV_op'),
            QV_non_op: sumField('QV_non_op'),

            // 사용 시간 (검증용 가중 평균)
            lighting_usage_hours: weightedAvg('lighting_usage_hours'),
            dhw_usage_days: weightedAvg('dhw_usage_days'),
            // 방열 손실 집계 (추가)
            Q_h_ce: sumField('Q_h_ce'),
            delta_theta_ce: weightedAvg('delta_theta_ce'),
            delta_theta_str: weightedAvg('delta_theta_str'),
            delta_theta_ctr: weightedAvg('delta_theta_ctr'),
            delta_theta_emb: weightedAvg('delta_theta_emb'),
            delta_theta_rad: weightedAvg('delta_theta_rad'),
            delta_theta_im: weightedAvg('delta_theta_im'),
            delta_theta_hydr: weightedAvg('delta_theta_hydr'),
            delta_theta_roomaut: weightedAvg('delta_theta_roomaut'),
            f_hydr: weightedAvg('f_hydr'),
            emissionLabels: activeZoneResults.length > 0 
                ? (activeZoneResults.find(z => z.data.Q_h_b > 0)?.data.emissionLabels || activeZoneResults[0].data.emissionLabels)
                : undefined,

            storageTransferDetails: activeZoneResults.length > 0 ? {
                Cm: weightedAvgNested('storageTransferDetails', 'Cm'),
                Area: totalArea,
                a_we: weightedAvgNested('storageTransferDetails', 'a_we'),
                theta_i_op: weightedAvgNested('storageTransferDetails', 'theta_i_op'),
                theta_i_non_op: weightedAvgNested('storageTransferDetails', 'theta_i_non_op'),
                delta_theta_i_NA: weightedAvgNested('storageTransferDetails', 'delta_theta_i_NA'),
                Q_h_we_daily: sumFieldNested('storageTransferDetails', 'Q_h_we_daily'),
                term1: sumFieldNested('storageTransferDetails', 'term1'),
                term2: sumFieldNested('storageTransferDetails', 'term2'),
                term3: sumFieldNested('storageTransferDetails', 'term3'),
            } : undefined,
        });
    }

    // --- 태양광 발전 계산 (DIN 18599-9) ---
    // 월간법에서는 별도 모듈을 통해 계산하거나 간략화. 여기서는 PV 로직 간단히 포함.
    const pvSystems = systems?.filter(s => s.type === "PV") as any[] | undefined;

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
            monthly: projectMonthlyResults, // 필수 필드 추가
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
// 2. 존 계산 (월간법)
export function calculateZoneMonthly(
    zone: ZoneInput,
    monthlyIndices: MonthlyClimateIndices[],
    mainStructure?: string,
    ventilationConfig?: Project['ventilationConfig'],
    ventilationUnits?: Project['ventilationUnits'],
    automationConfig?: Project['automationConfig'],
    systems?: Project['systems'],
    constructions?: Construction[],
    allZones?: Map<string, ZoneInput>, // 6.2.3 인접 존 참조
    Te_min: number = -12.0 // [신규] 설계 외기 온도
) {
    const Area = zone.area;
    const Volume = Area * zone.height * 0.95; // 순 체적
    const baseProfile = DIN_18599_PROFILES[zone.usageType] || DIN_18599_PROFILES["44_res_single"];
    let profile = { ...baseProfile };

    // [신규] 상위 존 상속 로직
    // 6.2.3 (3) "종속 공간은 상위 공간의 운영 시간을 따른다"
    if (zone.linkedParentZoneId && allZones) {
        const parentZone = allZones.get(zone.linkedParentZoneId);
        if (parentZone) {
            const parentProfile = DIN_18599_PROFILES[parentZone.usageType];
            if (parentProfile) {
                profile = {
                    ...profile,
                    // 상속 필드: 운영 시간, 일수
                    usageHoursStart: parentProfile.usageHoursStart,
                    usageHoursEnd: parentProfile.usageHoursEnd,
                    dailyUsageHours: parentProfile.dailyUsageHours,
                    annualUsageDays: parentProfile.annualUsageDays,
                    usageHoursDay: parentProfile.usageHoursDay,
                    usageHoursNight: parentProfile.usageHoursNight,
                    // 상속 필드: HVAC/난방 시간
                    hvacDailyOperationHours: parentProfile.hvacDailyOperationHours,
                    hvacAnnualOperationDays: parentProfile.hvacAnnualOperationDays,
                    heatingDailyOperationHours: parentProfile.heatingDailyOperationHours,
                };
            }
        }
    }

    if (zone.profileOverride) {
        profile = { ...profile, ...zone.profileOverride };
    }

    if (Area < 0.1) return null;

    // --- 침기(Infiltration) 설정 (6.3.1) ---
    // 1. 외피 면적 A_E (Envelope Area) 계산
    const envelopeArea = zone.surfaces
        .filter(s => {
            // A_E는 직접/간접 외기 및 지반 접촉 포함. 실내(단열) 제외.
            const category = getExposureCategory(s);
            return category !== ExposureCategory.INTERIOR;
        })
        .reduce((sum, s) => sum + s.area, 0);

    // 2. n50 결정
    let n50_val = 0;
    const isMeasured = ventilationConfig?.isMeasured ?? false;

    // 검증 저장을 위한 A_E 내역
    let A_ext = 0, A_grnd = 0, A_win = 0, A_door = 0;
    let fxArea_ext = 0, fxArea_grnd = 0;

    zone.surfaces.forEach(s => {
        const category = getExposureCategory(s);
        const fx = s.fx !== undefined ? s.fx : getFxDefault(s.type);

        // 적절한 외피 부분인 경우에만 기여도 합산
        if (category !== ExposureCategory.INTERIOR) {

            // 내역 분류
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
                        // 벽체, 지붕 등
                        A_ext += s.area;
                        fxArea_ext += fx * s.area;
                    }
                    break;
                case ExposureCategory.INDIRECT_EXTERIOR:
                    // 간소화된 CSV 요약을 위해 간접 외기를 A_ext의 일부로 취급 (낮은 fx 적용),
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
    const dhwSystem = systems?.find(s => s.type === "DHW" && (s.linkedZoneIds?.includes(zone.id || "") || s.isShared)) as any | undefined;
    const ahuSystem = systems?.find(s => s.type === "AHU" && (s.linkedZoneIds?.includes(zone.id || "") || s.isShared)) as any | undefined;
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
    const isBalanced = forcedMechanical ||
        zone.ventilationMode === "balanced_mech" ||
        (ventilationConfig?.systemType === "balanced"); // Annex E 또는 balanced_mech 모드인 경우 평형으로 간주
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
    // [신규] 침기(f_e) 계산을 위해 n_nutz, n_SUP, n_ETA 미리 계산
    const isMechanical = isZoneMechanical;
    const minFlowArea = profile.minOutdoorAir || 0;
    const n_nutz_design = calculateRequiredAirChange(minFlowArea, Area * 0.95, Volume); // n_nutz 계산 시 순바닥면적(0.95 * A_NGF) 적용 (V와 일치)

    let n_SUP_design = 0;
    let n_ETA_design = 0;

    if (isMechanical) {
        const designAirChange = n_nutz_design;
        if (isBalanced) { n_SUP_design = designAirChange; n_ETA_design = designAirChange; }
        else { n_SUP_design = 0; n_ETA_design = designAirChange; }
    }

    const f_inf_result = calculateInfiltrationRate(n50_val, hasATD, ventType, isBalanced, dailyOpHours, n_SUP_design, n_ETA_design);
    const f_inf_daily_mean = f_inf_result.rate;

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

    // 총 Cm = 계수 * 면적
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

    // --- Phase 1: 월 통합을 위한 시간별 루프 제거됨 ---
    // [변경] 월간법 로직 재작성 (엄격한 DIN 18599-2 준수)

    // 준비: 조명, 급탕 시스템 찾기 (시스템 효율 적용은 나중에, 여기서는 부하만)
    let lightingSystem = systems?.find(s => s.type === "LIGHTING" && (s.linkedZoneIds?.includes(zone.id || "") || s.isShared)) as any | undefined;
    if (!lightingSystem) lightingSystem = systems?.find(s => s.type === "LIGHTING") as any | undefined;

    // [이동] 월간 루프에서 사용하기 위해 시스템 정의 미리 수행 (시스템 손실 계산용)
    const heatingSystem = systems?.find(s => s.type === "HEATING" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as any | undefined;
    const coolingSystem = systems?.find(s => s.type === "COOLING" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as any | undefined;
    const dhwSystemForFinal = systems?.find(s => s.type === "DHW" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as any | undefined;


    // 월별 결과 계산
    // 월별 결과 계산
    const monthlyResults: MonthlyResult[] = [];
    const warnings: any[] = []; // 경고 배열 초기화

    // [Fix] hourlyResults는 월간법에서 생성되지 않음. 빈 배열 반환.
    const hourlyResults: HourlyResult[] = [];

    // 설정 온도
    const Theta_int_H = zone.temperatureSetpoints.heating;
    const Theta_int_C = zone.temperatureSetpoints.cooling;

    for (let m = 1; m <= 12; m++) {
        const d = monthlyIndices.find(mi => mi.month === m);
        if (!d) continue;

        // 월 일수 및 시간
        const daysInMonth = new Date(2023, m, 0).getDate(); // 2023: 평년 기준
        const t_duration = daysInMonth * 24;

        const Te_avg = d.Te_avg;

        // --- 1. 전열 (H_tr) ---
        // H_tr은 기본적으로 상수이나, f_neig(window) 등이 가변일 수 있음? 
        // DIN 18599-2: H_tr = H_D + H_g + H_U + H_A
        // 여기서는 기존 로직의 요소를 월별 루프 안에서 계산 (혹시 가변 요소가 있을 경우 대비)
        // 하지만 대부분 물성은 고정. loop 밖으로 빼도 되지만, Fx (인접존 온도차)가 월별로 다름.

        let H_tr_curr = 0;
        // H_tr 상세 구성요소 추적
        let H_tr_D_curr = 0;
        let H_tr_g_curr = 0;
        let H_tr_u_curr = 0;
        let H_tr_WB_curr = 0;
        let H_tr_A_curr = 0; // H_tr_curr에 추가되지 않음 (Q_adj로 처리), 검증용 추적

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

                // 실내 인접 존에 대한 특수 로직
                if (surf.type.includes("interior")) {
                    if (surf.adjacentZoneId && allZones) {
                        const adjZone = allZones.get(surf.adjacentZoneId);
                        if (adjZone) {
                            fx = 0.0; // H_tr에는 포함 안함 (Q_adj로 별도 계산)

                            // 검증용 H_tr_A (U * A) 추적
                            H_tr_A_curr += (u_val * surf.area);

                            // ... 아래 기존 로직에서 Q_adj 별도 계산
                            // 인접존 월평균 온도가 필요하나, 현재 구조상 Simultaneous Solving이 아님.
                            // 약식: 인접존의 Setpoint 사용.
                            const Tz_h = adjZone.temperatureSetpoints.heating;
                            const Tz_c = adjZone.temperatureSetpoints.cooling;

                            // 난방 계산 (Ti > Tz 이면 손실)
                            if (Math.abs(Theta_int_H - Tz_h) > 4) {
                                const H_iz = u_val * surf.area;
                                // 인접존 전열량 [Wh] -> 나중에 [kWh] / 1000 필요
                                // Q = H * (Ti - Tz) * t
                                const Q_iz = H_iz * (Theta_int_H - Tz_h) * t_duration;
                                Q_trans_adj_heating += Q_iz;
                            }
                            // 냉방 계산 (Tz > Ti 이면 취득 - 그러나 냉방 로직은 손실 개념 사용)
                            if (Math.abs(Theta_int_C - Tz_c) > 4) {
                                const H_iz = u_val * surf.area;
                                // Gain = H * (Tz - Ti)
                                const Q_iz_gain = H_iz * (Tz_c - Theta_int_C) * t_duration;
                                Q_trans_adj_cooling += Q_iz_gain;
                            }

                        } else { fx = 0.5; } // 존을 찾지 못한 경우 기본값?
                    } else { fx = 0.5; }
                }
                else if (surf.orientation === "NoExposure") fx = 0.0;
            }

            const h_surf = u_val * surf.area * fx;

            // 열교 (단순화: 면적 * 계수)
            // 외피에 기여하는 모든 표면에 적용 (fx > 0)
            const bridgeFactor = zone.thermalBridgeMode || 0.1; // 기본값 0.1 W/m2K
            // 수정: 열교 계수에도 fx 적용 (예: 지반 또는 비난방 상호작용)
            const h_bridge_surf = (fx > 0) ? (surf.area * bridgeFactor * fx) : 0;

            H_tr_curr += (h_surf + h_bridge_surf);
            H_tr_WB_curr += h_bridge_surf;

            // H 구성요소 분류
            if (fx > 0) {
                if (surf.type.includes("ground") || surf.type === "floor_ground" || surf.type === "wall_ground") {
                    H_tr_g_curr += h_surf;
                } else if (surf.type.includes("interior") || fx < 0.8) {
                    // 비난방 또는 실내 인접 (fx>0이면 완전히 인접한 공조 공간이 아님을 의미)
                    H_tr_u_curr += h_surf;
                } else {
                    // 직접 외기 (fx ~ 1.0)
                    H_tr_D_curr += h_surf;
                }
            }

            if (fx > 0) sumArea += surf.area;

            // 나중에 집계를 위해 상세 내역 저장 (Theta_i_h가 알려진 후)
            // [Modified] Key를 surf.id로 변경하여 개별 부재별(Assembly Name) 출력이 가능하도록 함 (Step 2 Solar Gain과 동일한 방식)
            // Old: const key = `${surf.type}_${surf.orientation || 'NoExposure'}`;
            const key = surf.id || `unknown_${Math.random().toString(36).substr(2, 9)}`;
            if (!monthlySurfaceData.get(key)) {
                monthlySurfaceData.set(key, { area: 0, uSum: 0, fxSum: 0, hTr: 0, hBridge: 0, qAdj: 0, qCoolSimplified: 0 });
            }
            const d_surf_data = monthlySurfaceData.get(key)!;
            d_surf_data.area += surf.area;
            d_surf_data.uSum += (u_val * surf.area);
            d_surf_data.fxSum += (fx * surf.area);
            d_surf_data.hTr += h_surf;
            d_surf_data.hBridge += h_bridge_surf;

            // 단순화된 냉방 온도 (섹션 6.1.4.6)
            const theta_u_cool = getCoolingSimplifiedTemp(surf.type, u_val);
            if (theta_u_cool !== null && fx < 1.0 && !surf.adjacentZoneId) {
                // Theta_i_c = Theta_int_C - 2.0 (나중에 정의되지만 여기서는 상수)
                const Ti_c = Theta_int_C - 2.0;
                const h_cool_surf = u_val * surf.area;
                const h_cool_bridge = surf.area * (zone.thermalBridgeMode || 0.1);
                // 고정 온도 기반 열 취득/손실
                // Q = H * (Ti - Tu) * t
                const q_cool_simplified = (h_cool_surf + h_cool_bridge) * (Ti_c - theta_u_cool) * t_duration;
                d_surf_data.qCoolSimplified += q_cool_simplified;
            }
            // 인접 손실이 있는 경우 수동으로 추가 (예: 인접 비난방)
            // 위 로직은 Q_trans_adj 난방/냉방 변수에 추가됨.
            // 그러나 정확한 귀속을 위해, 이 특정 표면이 기여했다면 여기서 추가해야 함.
            if (fx === 0 && (surf.type.includes("interior") || surf.type.includes("ground"))) {
                // 실내 인접인 경우 위에서 Q를 별도로 계산했음.
                // 여기서 그 특정 Q 값을 캡처해야 함.
                // 재계산 또는 위 범위에서 캡처?
                // 위 루프는 Q_trans_adj_heating을 구성함.
                // Q_iz를 캡처하도록 루프 구조를 약간 수정.
                let q_iz_surf = 0;
                if (surf.type.includes("interior") && surf.adjacentZoneId) {
                    // 이 특정 표면에 대해 위 로직 재평가
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
        // n50_val, hasATD, ventType 등은 루프 외부에서 상수.
        // f_inf_daily_mean은 외부에서 계산됨.

        // 기계 환기 여부 (앞서 결정된 isZoneMechanical 활용)
        const isMechanical = isZoneMechanical;

        // 필요 환기량
        const minFlowArea = profile.minOutdoorAir || 0;
        const n_nutz = n_nutz_design;        // 미리 계산된 값 사용

        // n_win 계산
        const isResidential = zone.usageType.startsWith("4");
        // 기계환기 매개변수
        let n_SUP = n_SUP_design, n_ETA = n_ETA_design, heatRecoveryEfficiency = 0;
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
            // n_SUP/n_ETA가 설계 값과 일치하는지 확인 (동일해야 함)

            // 팬 동력 (월간 추정)
            // 강제 기계환기(열적 준수 확인을 위한 가상 시스템)인 경우 팬 동력 = 0
            if (!forcedMechanical) {
                const flowRate = designAirChange * Volume;
                const sfp = ahuSystem?.fanPower || 1.5;
                const d_nutz_m = (profile.annualUsageDays / 365) * daysInMonth;
                fanPower = sfp * flowRate * t_v_mech * d_nutz_m;
            } else {
                fanPower = 0;
            }
        }

        // 창문 환기
        const n_win_result = calculateWindowVentilationRate(
            n_nutz, f_inf_daily_mean, isResidential, zone.height,
            { isActive: isMechanical, dailyOpHours: t_v_mech, t_nutz: usageDuration, n_SUP: n_SUP || 0, n_ETA: n_ETA || 0 },
            Te_avg,
            (A_win > 0), // hasWindows 전달
            isMechanical ? { ...f_inf_result.details, e: f_inf_result.details.e_shield } : undefined // f_inf_result를 사용하여 infiltrationParams 전달
        );

        // H_ve 분리를 위한 일수 분포 사전 계산
        const numDays = t_duration / 24;
        // [수정] 52주(364일) 대신 365일을 사용하여 정확한 연간 사용 비율 계산
        // 구: const d_op_week = profile.annualUsageDays / 52;
        const d_op_week = (profile.annualUsageDays / 365) * 7;
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
            // 헬퍼 사용: isActive=false 강제
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

        // 시상수(Tau) H_ve 계산 - DIN 18599-2:2018-09 섹션 6.1.4.2
        // Tau의 경우, 열회수 장치가 있는 기계환기 시 H_ve가 다르게 계산됨.
        // H_ve,mech,tau != H_ve,mech,balance (이는 Q = H * dT에서 온도차를 직접 사용함)

        // 1. Tau용 자연환기 부분 (침기 + 창문)
        // 참고: Tau의 창문 환기는 조절 가능한 경우 특정 제어 계수 없이 표준 값을 사용해야 하나?
        // DIN 18599-2 식 140: ...
        // 별도 명시가 없는 한, 자연환기 부분에 대해 수지와 동일한 n_win 및 n_inf 사용.
        const H_ve_nat_tau = Volume * HEAT_CAPACITY_AIR * (f_inf_daily_mean + n_win);

        // 2. Tau용 기계환기 부분
        let H_ve_mech_tau_h = 0;
        let H_ve_mech_tau_c = 0;

        if (isMechanical) {
            // 물리적 기계 H_ve (효율 보정 전)
            const H_ve_mech_phys = Volume * HEAT_CAPACITY_AIR * n_mech_daily;

            // 열회수 효율 (eta_WRG)
            const eta_WRG = heatRecoveryEfficiency;

            if (eta_WRG > 0) {
                // 1. 난방 (Heating) Time Constant
                // DIN 18599-2:2025-10, Eq. (142): 주거용 환기 및 냉방 기능 없는 RLT는 물리적 H 사용
                H_ve_mech_tau_h = H_ve_mech_phys;

                // 2. 냉방 (Cooling) Time Constant
                // "6K rule" (Eq. 141) applies to Non-Residential with Cooling function.
                const isResidentialProfile = zone.usageType.startsWith('17_') || zone.usageType.startsWith('18_') || zone.usageType.startsWith('17.') || zone.usageType.startsWith('18.');

                // 냉방 기능을 가진시스템 여부 확인 (ahuSystem 존재 유무 또는 coolingSystem 존재를 통해 추정 가능, 원칙적으로 AHU Supply Temp 필요)
                // 단순화를 위해 현재 ahuSystem이 있고 zone에 냉방 설정이 있다면 냉방 기능이 있는 것으로 간주함
                const hasCooling = !!coolingSystem || (ahuSystem && ahuSystem.heatRecovery && ahuSystem.heatRecovery.coolingEfficiency > 0);

                if (!isResidentialProfile && hasCooling) {
                    // Non-Residential: Apply 6K Rule (Eq. 141)
                    // 실제 기계 환기 시스템의 최소 급기 온도 (사전 공조 또는 기본 임계값 가정)
                    const theta_v_mech = ahuSystem?.supplyAirTempCooling ?? 16.0;

                    // 냉방 목표 실내 온도 (시상수용 보정 2K 차감)
                    const theta_i_soll_c = Theta_int_C - 2.0;

                    if (theta_i_soll_c < theta_v_mech) {
                        // 급기온이 목표온도보다 높으면 강제 0 처리
                        H_ve_mech_tau_c = 0;
                    } else {
                        const correction_c = 6.0 / (theta_i_soll_c - theta_v_mech);
                        H_ve_mech_tau_c = H_ve_mech_phys * correction_c;
                    }
                } else {
                    // Residential or no cooling function: Physical value (Eq. 142)
                    H_ve_mech_tau_c = H_ve_mech_phys;
                }
            } else {
                // 열회수 없으면 물리적 환기량 그대로 사용
                H_ve_mech_tau_h = H_ve_mech_phys;
                H_ve_mech_tau_c = H_ve_mech_phys;
            }
        }

        let H_ve_tau_h = H_ve_nat_tau + H_ve_mech_tau_h;
        let H_ve_tau_c = H_ve_nat_tau + H_ve_mech_tau_c;
        if (m === 1 && H_ve_tau_h !== H_ve_curr) {
            // console.log(`[DEBUG] Month ${m}: H_ve_curr=${H_ve_curr}, H_ve_tau_h=${H_ve_tau_h}, H_mech_phys=${H_ve_mech_tau_h}, corrections=${H_ve_mech_tau_h/Volume}`);
        }

        // Tau (시상수) 계산
        // tau = Cm / (H_tr + H_ve)
        // 위에서 계산된 H_ve_tau (난방/냉방 전용) 사용

        // H_tr_curr는 해당 존의 총 전열 계수
        const H_tr_tau = H_tr_curr;

        const tau_h_val = (H_tr_tau + H_ve_tau_h) > 0 ? (Cm / (H_tr_tau + H_ve_tau_h)) : 0;
        const tau_c_val = (H_tr_tau + H_ve_tau_c) > 0 ? (Cm / (H_tr_tau + H_ve_tau_c)) : 0;


        if (zone.temperatureSetpoints.heating < 12) {
            H_ve_tau_h = H_ve_curr;
            H_ve_tau_c = H_ve_curr;
        }


        // --- 3. 내부 발열 (Q_I) ---
        // 프로필 값 (인체, 기기, 급탕)은 일일 총합 [Wh/(m2*d)]
        const daysInMonth_val = daysInMonth; // 월 상수
        const daysUsage = (profile.annualUsageDays / 365) * daysInMonth_val;
        const hoursUsage = daysUsage * usageDuration;
        const totalHoursM = daysInMonth_val * 24;

        // ... (취득 계산 로직) ...


        // 3.1 인체 발열
        // DIN 18599-10 프로필 값(q_I,p)은 365일의 비사용 시간 평균이 모두 반영된 '평균 일일 발열량'입니다.
        // 따라서 연간 가동 비율(daysUsage) 대신 월 총 일수(daysInMonth_val)를 그대로 곱합니다.
        const Q_occ_m = (profile.metabolicHeat * Area) * daysInMonth_val;

        // 3.2 기기 발열
        // 기기 발열(q_I,app) 역시 비사용 시간이 포함된 365일 평균값입니다.
        const Q_eq_m = (profile.equipmentHeat * Area) * daysInMonth_val;
        // UI에 작동/비작동 시 분리하여 표시하기 위해, 전체 월간 시간 대비 가동 시간 비율로 안분합니다.
        const usageTimeRatio = totalHoursM > 0 ? (hoursUsage / totalHoursM) : 0;
        const Q_eq_occ = Q_eq_m * usageTimeRatio;
        const Q_eq_unocc = Q_eq_m - Q_eq_occ;

        // 3.3 조명 열 획득 (간이법)
        // 공식: P_eff = (Em / (efficacy * k_L * rho)) * k_A -> [W/m2]
        const efficacy = 60; // lm/W (기광효율 가정)
        const k_L = profile.maintenanceFactor || 0.8; // 보수율 (Maintenance Factor, 기본값 0.8)
        const k_A = profile.reductionFactorTaskArea || 1.0; // 작업 영역 감소 계수 (Table 6 Col 14)
        const rho_lit = 0.6; // 조명 이용률 (추후 roomIndex k를 사용하여 정밀 계산 가능)

        // 설치 전력 밀도 (Installed Power Density)
        const p_inst = profile.illuminance / (efficacy * k_L * rho_lit);
        // 유효 전력 밀도 (Effective Power Density)
        const p_lit = p_inst * k_A;

        // 조명 전체 에너지 소비량 [Wh] (100% 전력 소비)
        const Q_light_demand_m = (p_lit * Area) * hoursUsage;
        // 조명 열 획득 (DIN/TS 18599-2: 일반 등기구의 경우 100% 실내 유입)
        const Q_lit_gain_m = Q_light_demand_m * 1.0;

        // 3.4 급탕 열 획득 — dhw-system-loss.ts 공유 모듈 사용
        // 전체 급탕 유효 에너지 요구량 [Wh]
        const Q_w_b_m = (profile.dhwDemand * Area) * daysUsage;

        // [Gap 2] 공유 모듈 호출 — DIN/TS 18599-8 식(30), 표 10, 표 12 기반
        const Q_w_d_op_m = 0;
        const Q_w_s_op_m = 0;
        const Q_w_s_non_op_m = 0;
        const Q_w_s_total_m = 0;
        const Q_I_w_m = 0;

        const L_w_d = 0, U_l_w_d = 0, dT_pipe = 0, theta_w_av = 0, V_s = 0, q_w_s_day_Wh = 0;
        const theta_i = Theta_int_H;

        const Q_I_p_m = Q_occ_m;
        const Q_I_fac_m = Q_eq_m;
        const Q_I_l_m = Q_lit_gain_m;

        const Q_int_m = (Q_I_p_m + Q_I_fac_m + Q_I_l_m + Q_I_w_m);
        const internalGains = {
            Q_I_p: Q_I_p_m / 1000,
            Q_I_fac: Q_I_fac_m / 1000,
            Q_I_l: Q_I_l_m / 1000,
            Q_I_w: Q_I_w_m / 1000,

            // 상세 기호 (하위 호환성 또는 내부 참조)
            Q_l_source_p: Q_I_p_m / 1000,
            Q_l_source_l: Q_I_l_m / 1000,
            Q_l_source_app: Q_I_fac_m / 1000,
            Q_l_source_goods: 0,
            Q_l_source_h: Q_I_w_m / 1000,

            // 운전 상태별 내역
            op: {
                Q_I_p: Q_occ_m / 1000,
                Q_I_l: Q_lit_gain_m / 1000,
                Q_I_fac: Q_eq_occ / 1000,
                Q_I_goods: 0,
                Q_I_w: (Q_w_d_op_m + Q_w_s_op_m) / 1000,
                // UI용 분리 데이터 (kWh/월)
                Q_l_b: Q_light_demand_m / 1000,
                Q_w_b: Q_w_b_m / 1000,
                Q_w_d: Q_w_d_op_m / 1000,
                Q_w_s: Q_w_s_op_m / 1000
            },
            non_op: {
                Q_I_p: 0,
                Q_I_l: 0,
                Q_I_fac: Q_eq_unocc / 1000,
                Q_I_goods: 0,
                Q_I_w: Q_w_s_non_op_m / 1000,
                // UI용 분리 데이터 (kWh/월)
                Q_l_b: 0,
                Q_w_b: 0,
                Q_w_d: 0,
                Q_w_s: Q_w_s_non_op_m / 1000
            },

            // 검증 메타데이터
            metadata: {
                q_p: profile.metabolicHeat,
                t_usage: usageDuration,
                d_nutz: daysUsage,
                q_app: profile.equipmentHeat,
                t_non: 24,
                d_non: daysInMonth_val - daysUsage,
                p_j: p_inst,
                k_A: k_A,
                k_L: profile.maintenanceFactor || 0.8,
                q_dhw: profile.dhwDemand,
                // 급탕 상세 메타데이터 [kWh/월] - 표준 기호 (DIN/TS 18599-8)
                A_NGF: Area,
                q_w_b_day: profile.dhwDemand,
                L_w_d,
                U_l_w_d,
                theta_w_av,
                theta_i,
                dT_pipe,
                V_storage: V_s,
                q_w_s_day: q_w_s_day_Wh,
                Q_w_d: (Q_w_d_op_m) / 1000,
                Q_w_s: (Q_w_s_total_m) / 1000,
                // 레거시 지원
                L_pipe: L_w_d,
                U_pipe: U_l_w_d,
                Q_sb_day: q_w_s_day_Wh
            }
        };

        // --- 4. 일사 획득 (Q_S) ---
        // Q_s = sum( I_s,m * A * F )
        let Q_sol_m = 0;
        let Q_sol_m_transparent = 0;
        let Q_sol_m_opaque = 0;
        const solarData: NonNullable<MonthlyResult['solarData']> = {};

        Object.keys(d.surfaceInsolation).forEach(surfId => {
            const val_kWh = d.surfaceInsolation[surfId]; // kWh/m2
            const surf = zone.surfaces.find(s => s.id === surfId);
            if (!surf) return;

            let Q_surf_sol = 0;
            let reduction = 1.0;

            if (surf.type === 'window' || surf.type === 'door') {
                const construction = constructions?.find(c => c.id === surf.constructionId);
                const shgc = surf.shgc ?? construction?.shgc ?? 0.6; // g (표준값)
                const F_g_glass = 0.7; // 유리 비율 (표준 F_g = 1 - F_f)
                const F_S = 0.9; // 차폐 (주변)
                const F_w = 0.9; // 비수직 입사
                const F_V = 0.9; // 오염

                // 차양 장치 활성화 파라미터 (a) 적용 (DIN/TS 18599-2 표 A.4/A.5 간소화)
                // 현재 데이터 모델에 별도 차양 제어 정보가 없으므로 일반적인 블라인드 존재로 가정
                const hasShadingDevice = true; // 임시 기본값
                let g_eff_base = shgc;
                let a_param = 0;

                if (hasShadingDevice) {
                    const g_tot = construction?.shgc_tot ?? (shgc * 0.25); // 차양 활성화 시의 총 투과율 가정 (기본값 25% 수준)
                    const isSummer = (m >= 4 && m <= 9); // 여름철 (4~9월)

                    // 단순화된 활성화 비율: 여름철에는 일사 차단을 위해 닫혀 있는 비율 높음, 겨울철에는 낮음
                    // 추후 방위(orientation) 및 일사량 연동 컨트롤에 따라 세분화 가능
                    a_param = isSummer ? 0.8 : 0.2;
                    g_eff_base = a_param * g_tot + (1 - a_param) * shgc;
                }

                // g_eff = F_S * F_w * F_V * [ a*g_tot + (1-a)*g ]
                const g_eff = F_S * F_w * F_V * g_eff_base;
                reduction = F_g_glass * g_eff;
                Q_surf_sol = (val_kWh * 1000) * surf.area * reduction;
            } else {
                // [불투명] 불투명 부재 (DIN/TS 18599-2:2025-10 섹션 6.4.2)
                const alpha = surf.absorptionCoefficient ?? 0.5; // 복사 흡수율
                const construction = constructions?.find(c => c.id === surf.constructionId);
                const R_se = construction?.r_se ?? 0.04; // 실외 표면 열전달 저항
                const U = surf.uValue;

                // 장파 야간 복사
                // hr = 5 * epsilon (표준 epsilon = 0.9)
                const h_r = 4.5;
                const Delta_theta_er = 10; // K

                // F_f_sky: 형태 계수 (수평 <= 45도: 1.0, 수직 > 45도: 0.5)
                const F_f_sky = (surf.tilt ?? 90) <= 45 ? 1.0 : 0.5;

                // Q_s_opak = R_se * U * A * (alpha * Is - F_f_sky * hr * Delta_theta_er * t)
                const term_solar = alpha * (val_kWh * 1000); // Wh/m2
                const term_radiative_loss = F_f_sky * h_r * Delta_theta_er * t_duration; // Wh/m2

                Q_surf_sol = R_se * U * surf.area * (term_solar - term_radiative_loss);
                reduction = U * R_se * alpha; // 표시용 레거시 참조
            }

            Q_sol_m += Q_surf_sol;
            if (surf.type === 'window' || surf.type === 'door') {
                Q_sol_m_transparent += Q_surf_sol;
            } else {
                Q_sol_m_opaque += Q_surf_sol;
            }

            const orient = surf.orientation as string | undefined;

            // 외피 유형 이름(Assembly Name)이 있으면 그것을 우선 사용 (Use Assembly Name if available, e.g., W01, R01)
            const construction = constructions?.find(c => c.id === surf.constructionId);
            let displayName = construction?.name || surf.name || surfId;

            // 방위 정보가 유효하고 이름에 이미 포함되어 있지 않은 경우에만 추가 (Add only if valid and not already in name)
            if (orient && orient !== 'NoExposure' && orient !== '-') {
                if (!displayName.includes(`(${orient})`)) {
                    displayName = `${displayName}(${orient})`;
                }
            }

            solarData[surfId] = {
                name: displayName,
                area: surf.area,
                orientation: surf.orientation ?? "-",
                tilt: surf.tilt ?? 90,
                I_sol_kwh: val_kWh,
                reductionFactor: reduction,
                Q_sol_kwh: Q_surf_sol / 1000,

                isTransparent: surf.type === 'window' || surf.type === 'door',
                ...(surf.type === 'window' || surf.type === 'door' ? {
                    shgc: surf.shgc ?? (constructions?.find(c => c.id === surf.constructionId)?.shgc ?? 0.6),
                    f_g: 0.7,
                    f_s: 0.9,
                    f_w: 0.9,
                    f_v: 0.9
                } : {
                    alpha: surf.absorptionCoefficient ?? 0.5,
                    r_se: constructions?.find(c => c.id === surf.constructionId)?.r_se ?? 0.04,
                    u_value: surf.uValue,
                    f_f_sky: (surf.tilt ?? 90) <= 45 ? 1.0 : 0.5,
                    h_r: 4.5,
                    delta_theta_er: 10
                })
            };
        });


        // --- 5. 월간 수지 (리팩토링된 기존 로직) ---

        // [신규] 반복 계산 루프 (DIN 18599-1 5.2.4)
        let Q_h_b_prev = 0;
        let Q_c_b_prev = 0;
        let Q_I_sys_heating = 0; // Wh (누적 시스템 손실 -> 내부 발열)
        let Q_I_sys_cooling = 0; // Wh (누적 시스템 손실 -> 내부 히트싱크)
        const currentMonthLogs: MonthlyResult['iterationLogs'] = [];
        // H_ve_tau_h, H_ve_tau_c는 이미 위(1525-1526)에서 정의됨

        for (let iter = 1; iter <= 10; iter++) {

            const H_tot = H_tr_curr + H_ve_curr; // 수지용 (Qh, Qc)
            const H_tot_tau_h = H_tr_curr + H_ve_tau_h;
            const H_tot_tau_c = H_tr_curr + H_ve_tau_c;
            const tau_h = H_tot_tau_h > 0 ? (Cm / H_tot_tau_h) : 0; // 난방용 시간상수
            const tau_c = H_tot_tau_c > 0 ? (Cm / H_tot_tau_c) : 0; // 냉방용 시간상수

            // Theta_i_h (유효 난방 설정온도) 계산
            // ... (Theta_i_h, f_NA, f_we에 대한 기존 로직 재사용) ...
            // 이 청크의 간결함을 위해 간소화된 버전 재구현

            // DIN 18599-10 Table 6 Col 11: t_h,op,d (난방 일일 사용 시간)
            const t_h_op_d = profile.heatingDailyOperationHours || (usageDuration > 0 ? usageDuration : 24);
            const t_NA = 24 - t_h_op_d;
            const Delta_theta_i_NA = profile.heatingSetbackTemp || 3.0;

            // 자동화 온도 보정 (DIN 18599-11 / DIN 18599-2 Eq. 28)
            // 저감 효과를 위해 음수 값으로 산정 (Class A: -0.5K, Class B: -0.2K)
            let delta_theta_EMS = 0;
            if (automationConfig?.automationClass === 'A') delta_theta_EMS = -0.5;
            else if (automationConfig?.automationClass === 'B') delta_theta_EMS = -0.2;

            const f_adapt = automationConfig?.heatingTempControl === 'auto_adapt' ? 0.9 : 1.0;

            const isShutdown = zone.heatingReducedMode === "shutdown";
            let f_NA = 0;
            if (t_NA > 0) {
                const expTerm = Math.exp(-(tau_h || 0) / 250);
                // 식 31 (완화), 식 28 (중단 - 더 강한 감소로 해석됨)
                // DIN V 18599-2:2018-09 Eq. 31: f_NA = 0.13 * (t_NA / 24) * ...
                // 중단인 경우, 보통 f_NA가 더 높음을 의미함 (더 큰 온도 하강).
                // 그러나 중단에 대해 0.26이 올바른 계수인지 확인 필요.
                // 표준에서는 중단에 대해: f_NA = 0.5 * (t_NA/24) * ... 근사?
                // 식 28: f_NA_abs = (t_NA/24) * (1 - exp(-tau/100)) ... 이는 다름.

                // 단순화된 표에서 유래되었을 가능성이 높은 0.26 / 0.13 계수를 유지하되,
                // 괄호가 올바른지 확인.
                f_NA = (isShutdown ? 0.26 : 0.13) * (t_NA / 24) * expTerm * f_adapt;
            }
            // DIN V 18599-2:2018-09 Eq. 28
            const term1_NA = Theta_int_H + delta_theta_EMS - f_NA * (Theta_int_H - Te_avg);
            const term2_NA = Theta_int_H - (Delta_theta_i_NA * (t_NA / 24));
            const Theta_i_h_op = Math.max(term1_NA, term2_NA);

            // 주말
            let f_we = 0;
            let Theta_i_h_non_op = Theta_i_h_op;
            let Theta_i_h = Theta_i_h_op;
            // ...

            if (profile.annualUsageDays <= 260) {
                if (isShutdown) {
                    // 난방 중단 (Heizungsabschaltung) (DIN/TS 18599-2:2025-10 식 33)
                    // f_we = 0.3 * (1 - 0.2 * (tau_h / 250))
                    f_we = 0.3 * (1 - 0.2 * (tau_h / 250));
                } else {
                    // 완화 운전 (Absenkbetrieb) (DIN/TS 18599-2:2025-10 식 32)
                    f_we = 0.2 * (1 - 0.4 * (tau_h / 250));
                }
                f_we = Math.max(0, f_we);

                // DIN/TS 18599-2:2025-10 Eq. 31
                // Theta_i_h (비사용일) = max( Theta_set - f_we * (Theta_set - Theta_e), Theta_set - Delta_Theta_NA )
                // 여기서 Theta_set = Theta_int_H
                // Theta_e = Te_avg
                // DIN/TS 18599-2:2025-10 식 31 (간소화된 감경 사용 시 EMS 보정 없음 가정)
                const term1_non_op = Theta_int_H - f_we * (Theta_int_H - Te_avg);
                const term2_non_op = Theta_int_H - Delta_theta_i_NA;

                Theta_i_h_non_op = Math.max(term1_non_op, term2_non_op);

                // 3. 최종 가중 월평균 계산 (식 38)
                // [수정] 일관성을 위해 365일 사용
                // 구: const d_op = profile.annualUsageDays / 52;
                const d_op = (profile.annualUsageDays / 365) * 7;
                const d_non_op = 7 - d_op;

                if (d_non_op > 0) {
                    Theta_i_h = (Theta_i_h_op * d_op + Theta_i_h_non_op * d_non_op) / 7;
                } else {
                    Theta_i_h = Theta_i_h_op;
                }
            }

            // Q_loss_H [kWh]
            // Theta_i_h 기반 난방용 레거시 QT/QV
            const QT_heat = ((H_tr_curr * (Math.max(Theta_i_h, Te_avg) - Te_avg) * t_duration) + Q_trans_adj_heating) / 1000;
            const QV_heat = (H_ve_curr * (Math.max(Theta_i_h, Te_avg) - Te_avg) * t_duration) / 1000;
            const Q_loss_H = QT_heat + QV_heat;

            // Q_gain [kWh] - 시스템 난방 손실을 내부 발열로 포함
            const Q_gain = (Q_sol_m + Q_int_m + Q_trans_adj_cooling + Q_I_sys_heating) / 1000;

            // 단순화된 냉방 집계
            let H_tr_simplified_m = 0;
            let Q_cool_simplified_m = 0;
            monthlySurfaceData.forEach(d => {
                if (d.qCoolSimplified !== 0) {
                    H_tr_simplified_m += (d.hTr + d.hBridge);
                    Q_cool_simplified_m += d.qCoolSimplified;
                }
            });

            // -------------------------------------------------------------------------
            // Section 6.6 구현: 비사용일 구조체 축열량 이전 (Heat Storage Transfer)
            // -------------------------------------------------------------------------

            let Q_h_need = 0;
            let eta_H = 1.0; // 출력 확인용 대표 이용 효율
            let gamma_H = 1.0;
            const a_H = 1 + (tau_h / 16); // 난방용 이용효율 계수 (수정: 15 -> 16)

            // [상세 검증 변수 - 호이스팅됨]
            let eta_we = 0;
            let eta_nutz = 0;
            let Q_h_b_op = 0;
            let Q_h_b_non_op = 0;


            // 사용일(d_nutz) 및 비사용일(d_we) 계산
            // 연간 사용일수가 주단위로 균등하게 분포한다고 가정
            // [수정] 변수들이 루프 상단으로 호이스팅됨

            const d_nutz = numDays * frac_op;
            // d_we는 이미 계산됨

            // 의미 있는 비사용 기간이 존재할 경우(> 0.1일) 분리 계산 적용
            // 의미 있는 비사용 기간이 존재할 경우(> 0.1일) 분리 계산 적용
            let QT_op = 0, QV_op = 0, QS_op = 0, QI_op = 0;
            let QS_op_transparent = 0, QS_op_opaque = 0;
            let QT_non_op = 0, QV_non_op = 0, QS_non_op = 0, QI_non_op = 0;
            let QS_non_op_transparent = 0, QS_non_op_opaque = 0;
            let Q_transfer_total = 0;
            let Delta_Q_c_b_we = 0;
            let storageTransferDetails = {
                Cm,
                Area,
                a_we: d_non_op_week,
                theta_i_op: Theta_i_h_op,
                theta_i_non_op: Theta_i_h_non_op,
                delta_theta_i_NA: Delta_theta_i_NA,
                Q_h_we_daily: 0,
                term1: 0,
                term2: 0,
                term3: 0,
            };

            if (d_we > 0.1 && profile.annualUsageDays <= 260 && !isShutdown) {

                // --- 1. 비사용 기간 (주말/휴일) ---
                QT_non_op = ((H_tr_curr * (Math.max(Theta_i_h_non_op, Te_avg) - Te_avg) * 24) + Q_trans_adj_heating / numDays) / 1000 * d_we;
                QV_non_op = (H_ve_non_usage * (Math.max(Theta_i_h_non_op, Te_avg) - Te_avg) * 24) / 1000 * d_we;
                const Q_sink_we = QT_non_op + QV_non_op;
                QS_non_op = (Q_sol_m / 1000) * frac_non_op;
                QS_non_op_transparent = (Q_sol_m_transparent / 1000) * frac_non_op;
                QS_non_op_opaque = (Q_sol_m_opaque / 1000) * frac_non_op;
                QI_non_op = (internalGains.non_op?.Q_I_p || 0) + (internalGains.non_op?.Q_I_l || 0) + (internalGains.non_op?.Q_I_fac || 0) + (internalGains.non_op?.Q_I_goods || 0) + (internalGains.non_op?.Q_I_w || 0);
                const Q_source_we = QS_non_op + QI_non_op;

                // 비사용 시 이용 효율 (eta_we)
                const gamma_we = Q_sink_we > 0 ? (Q_source_we / Q_sink_we) : 100;
                const a_we_param = a_H;

                if (gamma_we > 0 && gamma_we !== 1) eta_we = (1 - Math.pow(gamma_we, a_we_param)) / (1 - Math.pow(gamma_we, a_we_param + 1));
                else if (gamma_we === 1) eta_we = a_we_param / (a_we_param + 1);

                // 축열량 이전 계산 (DIN/TS 18599-2:2025-10 식 135)
                // 모든 항을 '일일(Daily)' 기준으로 통일하여 비교 (a_we로 나누어 일평균 값 산출)
                const C_wirk_kwh = (Cm * Area) / 1000;
                const a_we_val = d_non_op_week; // 비사용 기간 일수 (약 2.0일)

                // Term 1: 구조체 열용량 한계 (Capacity Limit) - 일일 방출 가능량
                const term1_storage = (C_wirk_kwh * 2 * (Theta_i_h_op - Theta_i_h_non_op)) / a_we_val;

                // Term 2: 설정온도 한계 (Setback Limit) - 안전장치 (표준 식에는 없으나 유지)
                const term2_storage = (C_wirk_kwh * Delta_theta_i_NA) / a_we_val;

                // Term 3: 가용 열량 한계 (Energy Balance Limit) - 비사용 기간 순수 난방 필요량 (일평균)
                // [Fixed] 이전 코드에서 a_we_val을 곱해 전체 에너지를 구하던 오류 수정 -> 일평균 부하로 통일
                const Q_h_we_daily = Math.max(0, (Q_sink_we / d_we) - eta_we * (Q_source_we / d_we));
                const term3_storage = Q_h_we_daily;

                if (Theta_i_h_op > Theta_i_h_non_op) {
                    // 식 135: 세 한계치 중 최소값을 일일 절감량으로 결정
                    Delta_Q_c_b_we = Math.min(term1_storage, term2_storage, term3_storage);
                }

                storageTransferDetails = {
                    Cm,
                    Area,
                    a_we: a_we_val,
                    theta_i_op: Theta_i_h_op,
                    theta_i_non_op: Theta_i_h_non_op,
                    delta_theta_i_NA: Delta_theta_i_NA,
                    Q_h_we_daily,
                    term1: term1_storage,
                    term2: term2_storage,
                    term3: term3_storage,
                };

                // 식 136: 주말 전체 절감량을 구하여 평일(사용 기간)로 배분
                // 주말 전체 절감량 = 일일 절감량 * 실제 비사용일수(d_we)
                Q_transfer_total = Delta_Q_c_b_we * d_we;
                const Q_h_we = Math.max(0, (Q_sink_we - eta_we * Q_source_we) - Q_transfer_total);

                // [상세 검증]
                Q_h_b_non_op = Q_h_we;


                // --- 2. 사용 기간 (평일) ---
                QT_op = ((H_tr_curr * (Math.max(Theta_i_h_op, Te_avg) - Te_avg) * 24) + Q_trans_adj_heating / numDays) / 1000 * d_nutz;
                QV_op = (H_ve_usage * (Math.max(Theta_i_h_op, Te_avg) - Te_avg) * 24) / 1000 * d_nutz;

                // 축열 이전량을 열싱크(부하)로 적용 (식 136)
                const Q_sink_add = Q_transfer_total;
                const Q_sink_nutz = QT_op + QV_op + Q_sink_add;
                QS_op = (Q_sol_m / 1000) * frac_op;
                QS_op_transparent = (Q_sol_m_transparent / 1000) * frac_op;
                QS_op_opaque = (Q_sol_m_opaque / 1000) * frac_op;
                QI_op = (internalGains.op?.Q_I_p || 0) + (internalGains.op?.Q_I_l || 0) + (internalGains.op?.Q_I_fac || 0) + (internalGains.op?.Q_I_goods || 0) + (internalGains.op?.Q_I_w || 0);
                const Q_source_nutz = QS_op + QI_op;

                // 운전 시 이용 효율 (eta_nutz)
                const gamma_nutz = Q_sink_nutz > 0 ? (Q_source_nutz / Q_sink_nutz) : 100;

                if (gamma_nutz > 0 && gamma_nutz !== 1) eta_nutz = (1 - Math.pow(gamma_nutz, a_H)) / (1 - Math.pow(gamma_nutz, a_H + 1));
                else if (gamma_nutz === 1) eta_nutz = a_H / (a_H + 1);

                const Q_h_nutz = Math.max(0, Q_sink_nutz - eta_nutz * Q_source_nutz);

                // [상세 검증]
                Q_h_b_op = Q_h_nutz;


                // --- 3. 총 난방 수요 ---
                Q_h_need = Q_h_we + Q_h_nutz;

                // 리포팅용 평균 효율 산출
                const Q_loss_avg = QT_op + QT_non_op + QV_op + QV_non_op + Q_sink_add;
                gamma_H = Q_loss_avg > 0 ? (Q_gain / Q_loss_avg) : 100;
                if (gamma_H > 0 && gamma_H !== 1) eta_H = (1 - Math.pow(gamma_H, a_H)) / (1 - Math.pow(gamma_H, a_H + 1));
                else if (gamma_H === 1) eta_H = a_H / (a_H + 1);

                // [상세 검증] 내역 데이터 채우기
                // 마지막에 monthlyResults.push를 사용하지만, 중간값을 저장해야 함
                // 로컬 객체를 생성하여 저장하고 나중에 전개할까?
                // 사실 필요하면 임시 변수에 할당하거나, calculateZoneMonthly가 객체를 직접 반환하는 것이 더 좋음.
                // 최종 객체 생성에 이 값들을 추가할 것임.
                // 현재로서는 변수들이 스코프 내에 있는지 확인 (있음).

            } else {
                // 표준 계산 (분리 없음 또는 난방 정지/연속 사용)
                gamma_H = Q_loss_H > 0 ? (Q_gain / Q_loss_H) : 100;
                if (gamma_H > 0 && gamma_H !== 1) eta_H = (1 - Math.pow(gamma_H, a_H)) / (1 - Math.pow(gamma_H, a_H + 1));
                else if (gamma_H === 1) eta_H = a_H / (a_H + 1);

                Q_h_need = Math.max(0, Q_loss_H - (eta_H * Q_gain));

                QI_non_op = (Q_int_m / 1000) * (frac_non_op);

                // [수정] UI용 내역 값 할당
                if (isShutdown) {
                    Q_h_b_op = Q_h_need;
                    Q_h_b_non_op = 0;
                } else {
                    Q_h_b_op = Q_h_need * frac_op;
                    Q_h_b_non_op = Q_h_need * frac_non_op;
                }
            }

            // 냉방
            const Theta_i_c = Theta_int_C - 2.0;
            // 냉방용 QT/QV 계산 (Theta_i_c 기반)
            // 지반/비난방 표면에 대해 단순화된 온도를 사용하도록 QT_cool 조정 (섹션 6.1.4.6)
            const QT_cool = (((H_tr_curr - H_tr_simplified_m) * (Theta_i_c - Te_avg) * t_duration) + Q_cool_simplified_m) / 1000;
            const QV_cool = (H_ve_curr * (Theta_i_c - Te_avg) * t_duration) / 1000;
            const Q_loss_C = QT_cool + QV_cool + (Q_I_sys_cooling / 1000);

            let Q_sink = Q_loss_C;
            let Q_source = Q_gain;
            // Q_sink가 음수(획득)이면 Source에 추가
            if (Q_sink < 0) {
                Q_source -= Q_sink; // 획득 추가 (음수 손실 차감)
                Q_sink = 0;
            }

            // DIN V 18599-2:2025-10 Eq. 147: gamma = Q_source / Q_sink (Gain/Loss)
            const gamma_C = Q_sink > 0 ? (Q_source / Q_sink) : 100;
            const a_C = 1 + (tau_c / 16);

            let eta_C = 1.0;
            if (gamma_C > 0 && gamma_C !== 1) {
                // 식 144: 난방과 동일한 공식
                eta_C = (1 - Math.pow(gamma_C, a_C)) / (1 - Math.pow(gamma_C, a_C + 1));
            } else if (gamma_C === 1) {
                eta_C = a_C / (a_C + 1);
            }

            // DIN V 18599-2 냉방 수요 계산
            // gamma > 1 (Source > Sink)일 때, eta_C는 작아짐 (~ Sink/Source).
            // 이용된 열손실은 (eta_C * Q_source)로 표현됨?
            // NotebookLM에 따르면: Q_c = (1 - eta_C) * Q_source
            // 검증: 만약 eta ~ Sink/Source이면, (1 - Sink/Source)*Source = Source - Sink.
            // 이는 물리 법칙(부하 = 획득 - 손실)과 일치함.

            let Q_c_need = 0;
            if (Q_source > 0) {
                Q_c_need = Q_source * (1 - eta_C);
            }

            // [수정] 하드코딩된 5/7 대신 정확한 연간 사용 비율 사용
            if (profile.annualUsageDays <= 260) Q_c_need *= (profile.annualUsageDays / 365);

            // --- 표면별 내역 계산 ---
            const transmissionBySurface: Record<string, { name: string; area: number; uValue: number; fx: number; H_tr: number; H_bridge: number; delta_U_WB?: number; Q_trans: number; Q_trans_heat: number; Q_trans_cool: number }> = {};
            const bridgeFactor = zone.thermalBridgeMode || 0.1;
            monthlySurfaceData.forEach((d, k) => {
                const h_total_surf = d.hTr + d.hBridge;
                const q_adj_kwh = d.qAdj / 1000;

                // 1. 난방 (손실)
                // Theta_i_h (유효 난방 실내 온도) 사용
                const q_heat_main = (h_total_surf * (Math.max(Theta_i_h, Te_avg) - Te_avg) * t_duration) / 1000;
                const Q_trans_heat = q_heat_main + q_adj_kwh;

                // 2. 냉방 (획득/손실)
                // Theta_i_c (유효 냉방 실내 온도) 사용
                // 단순화된 냉방이 적용되는 경우 (섹션 6.1.4.6), 캡처된 값 사용.
                let Q_trans_cool = 0;
                if (d.qCoolSimplified !== 0) {
                    Q_trans_cool = d.qCoolSimplified / 1000;
                } else {
                    // Q = H * (Ti - Te) * t
                    Q_trans_cool = (h_total_surf * (Theta_i_c - Te_avg) * t_duration) / 1000;
                }

                // 관류 부위 이름 생성 (Assembly Name 우선, 중복 방위 방지)
                const surf = zone.surfaces.find(s => s.id === k);
                const orient = surf?.orientation as string | undefined;
                const construction = constructions?.find(c => c.id === surf?.constructionId);

                let displayName = construction?.name || surf?.name || k;

                if (orient && orient !== 'NoExposure' && orient !== '-') {
                    if (!displayName.includes(`(${orient})`)) {
                        displayName = `${displayName}(${orient})`;
                    }
                }

                transmissionBySurface[k] = {
                    name: displayName,
                    area: d.area,
                    uValue: d.area > 0 ? d.uSum / d.area : 0,
                    fx: d.area > 0 ? d.fxSum / d.area : 0,
                    H_tr: d.hTr,
                    H_bridge: d.hBridge,
                    delta_U_WB: bridgeFactor,
                    Q_trans: Q_trans_heat, // 레거시
                    Q_trans_heat: Q_trans_heat,
                    Q_trans_cool: Q_trans_cool
                };
            });

            // 순 흐름 (획득 +, 손실 -)
            // 획득 = Te > Ti (열 유입), 손실 = Te < Ti (열 유출)
            const QT_monthly = (H_tr_curr * (Te_avg - Theta_i_h) * t_duration - Q_trans_adj_heating + Q_trans_adj_cooling) / 1000;
            const QV_monthly = (H_ve_curr * (Te_avg - Theta_i_h) * t_duration) / 1000;

            // 상세 H_ve 구성요소 계산 (가중 평균)
            // H = V * c * n
            const Vol_c = Volume * HEAT_CAPACITY_AIR;
            // 침기는 상수 (단순화: 일일 평균 사용)
            const H_ve_inf_calc = Vol_c * f_inf_daily_mean;
            // 창문: 사용 vs 비사용
            const H_ve_win_calc = Vol_c * (n_win * frac_op + n_win_non_usage * frac_non_op);
            // 기계환기: 사용 (n_mech_eff) vs 비사용 (0)
            // 참고: n_mech_daily는 사용 시간 동안의 유효율인가? 아니오, 일일 평균임.
            // n_mech_daily = n_SUP * (t_v/24). 이미 일일 평균임!
            // 따라서 사용일에 적용:
            const currentAirChange_Mech_Eff_Daily = n_mech_daily * (1 - heatRecoveryEfficiency);
            // 시스템이 사용일에만 가동되는 경우:
            const H_ve_mech_calc = Vol_c * (currentAirChange_Mech_Eff_Daily * frac_op);
            const H_ve_mech_gross_calc = Vol_c * (n_mech_daily * frac_op);

            const H_ve_total_calc = H_ve_inf_calc + H_ve_win_calc + H_ve_mech_calc;
            const H_ve_gross_calc = H_ve_inf_calc + H_ve_win_calc + H_ve_mech_gross_calc;

            // --- 시스템 손실 업데이트 및 수렴 확인 ---
            let Q_h_sys_loss_new = 0;
            let distDetailsH: any = null;
            let storageDetailsH: any = null;
            let distDetailsC: any = null;
            let storageDetailsC: any = null;

            // 설비 시스템 로직 삭제됨 (초기화 상태)
            const Q_h_ce = 0;
            const Q_h_need_with_ce = Q_h_need;
            
            const opConditions = {
                beta: 0,
                temperature: { theta_VL: 0, theta_RL: 0, theta_HK_av: 0 },
                time: { t_h_rL: 0, t_op: 0, t_non_op: 0 },
            };
            const emissionResult: any = null;
            let Q_c_sys_loss_new = 0;

            const convergence = (Q_h_b_prev + Q_c_b_prev) > 0
                ? Math.abs((Q_h_need + Q_c_need) - (Q_h_b_prev + Q_c_b_prev)) / (Q_h_b_prev + Q_c_b_prev)
                : 1.0;

            currentMonthLogs.push({
                step: iter,
                Q_h_b: Q_h_need,
                Q_c_b: Q_c_need,
                Q_I_sys_heating: Q_I_sys_heating / 1000,
                Q_I_sys_cooling: Q_I_sys_cooling / 1000,
                Q_I_sys_dhw: 0,
                convergence: convergence * 100,
                details: {
                    QT: QT_heat,
                    QV: QV_heat,
                    QS: Q_sol_m / 1000,
                    QI: (Q_int_m + Q_trans_adj_cooling + Q_I_sys_heating) / 1000,
                    Q_h_b: Q_h_need,
                    Q_c_b: Q_c_need,
                    eta_h: eta_H,
                    eta_c: eta_C,
                    gamma_h: gamma_H,
                    gamma_c: gamma_C
                }
            });

            Q_h_b_prev = Q_h_need;
            Q_c_b_prev = Q_c_need;
            Q_I_sys_cooling = Q_c_sys_loss_new;

            let heatingFinalEnergy = 0;
            let heatingPrimaryEnergy = 0;
            let heatingCo2 = 0;
            let heatingAux = 0;
            let heatingGenerationLoss = 0;
            let heatingGenerationDetails: any = null;

            if (iter < 10 && convergence >= 0.001) continue;

            monthlyResults.push({
                heatingLoadDetails: {
                    Te_min: Te_min,
                    H_tr: H_tr_curr,
                    H_ve: H_ve_curr,
                    Theta_int_H: Theta_int_H,
                    A_NGF: Area,
                    P_h_max: (H_tr_curr + H_ve_curr) * (Theta_int_H - Te_min),
                    p_h: ((H_tr_curr + H_ve_curr) * (Theta_int_H - Te_min)) / Area
                },
                iterationLogs: currentMonthLogs, // 로그 추가
                systemLosses: {
                    heating: {
                        generation: heatingGenerationLoss,
                        distribution: distDetailsH.total.Q_loss,
                        storage: storageDetailsH.total.Q_loss,
                        details: {
                            generation: heatingGenerationDetails,
                            distribution: distDetailsH,
                            storage: storageDetailsH
                        }
                    },
                    cooling: {
                        distribution: Q_I_sys_cooling / 1000, // Wh -> kWh
                        storage: 0, // 자리표시자
                        details: {
                            distribution: distDetailsC,
                            storage: storageDetailsC
                        }
                    },
                    dhw: {
                        distribution: 0, // 자리표시자
                        storage: 0 // 자리표시자
                    }
                },
                warnings: warnings.map(w => (w as any).message || w.toString()),
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
                Q_h_b: Q_h_need,
                Q_c_b: Q_c_need,
                Q_l_b: Q_light_demand_m / 1000, // 100% 에너지 수요
                Q_w_b: Q_w_b_m / 1000,      // 100% 에너지 수요
                Q_aux: (fanPower) / 1000, // 팬 에너지
                pvGeneration: 0,
                avg_Ti: Theta_i_h, // 근사치
                avg_Ti_c: Theta_i_c, // 냉방 유효
                avg_Ti_op: Theta_i_h_op,
                avg_Ti_non_op: (profile.annualUsageDays <= 260) ? Theta_i_h_non_op : undefined,
                balanceDetails: { Cm, cooling: Theta_int_C },
                H_tr: H_tr_curr,
                H_ve: H_ve_curr,

                // 상세 열관류율 계수 (검증 탭용 추가)
                H_tr_total: H_tr_curr,
                H_tr_D: H_tr_D_curr,
                H_tr_g: H_tr_g_curr,
                H_tr_u: H_tr_u_curr,
                H_tr_A: H_tr_A_curr,
                H_tr_WB: H_tr_WB_curr,
                H_ve_total: H_ve_total_calc,
                H_ve_inf: H_ve_inf_calc,
                H_ve_win: H_ve_win_calc,
                H_ve_mech: H_ve_mech_calc,
                H_ve_gross: H_ve_gross_calc,

                // 시상수 H-값 (추가됨)
                H_ve_tau_h: H_ve_tau_h,
                H_ve_tau_c: H_ve_tau_c,

                hours: t_duration,
                transmissionBySurface,
                solarData,
                internalGains: {
                    Q_occ: internalGains.Q_I_p,
                    Q_app: internalGains.Q_I_fac,
                    Q_lit: internalGains.Q_I_l,
                    Q_dhw: internalGains.Q_I_w
                },

                // 환기 상세 검증 매개변수
                n_nutz: n_nutz,
                roomHeight: zone.height,
                t_nutz: usageDuration,
                t_v_mech: t_v_mech,
                f_inf_daily_mean: f_inf_daily_mean,
                n50: f_inf_result.details.n50,
                f_ATD: f_inf_result.details.f_ATD,
                e_shield: f_inf_result.details.e_shield,
                f_wind: f_inf_result.details.f_wind,
                f_e: f_inf_result.details.fe,
                n_SUP: n_SUP,
                n_ETA: n_ETA,
                n_win_min: n_win_result.details.n_win_min,
                Delta_n_win: n_win_result.details.Delta_n_win,
                Delta_n_win_mech: n_win_result.details.Delta_n_win_mech,
                Delta_n_win_mech_0: n_win_result.details.Delta_n_win_mech_0,
                A_NGF: Area,
                V_A_Geb: profile.minOutdoorAirBuilding || 0,
                A_E: sumArea,

                // 디버그 검증 필드 (CSV 내보내기용 추가)
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
                t_c_op_d: (usageDuration > 0 ? usageDuration : 24),
                t_NA,
                delta_theta_EMS,
                f_adapt,

                finalEnergy: {
                    heating: heatingFinalEnergy,
                    cooling: 0, dhw: 0, lighting: 0, auxiliary: heatingAux
                },
                primaryEnergy: {
                    heating: heatingPrimaryEnergy,
                    cooling: 0, dhw: 0, lighting: 0, auxiliary: heatingAux * PEF_FACTORS.electricity,
                    total: heatingPrimaryEnergy + heatingAux * PEF_FACTORS.electricity
                },
                co2Emissions: {
                    heating: heatingCo2,
                    cooling: 0, dhw: 0, lighting: 0, auxiliary: heatingAux * CO2_FACTORS.electricity,
                    total: heatingCo2 + heatingAux * CO2_FACTORS.electricity
                },

                energyDemandMetadata: {
                    heating: {
                        tau: tau_h,
                        a: a_H,
                        gamma: gamma_H,
                        eta: eta_H,
                        Q_gain: Q_gain,
                        Q_loss: Q_loss_H,
                    },
                    cooling: {
                        tau: tau_c,
                        a: a_C,
                        gamma: gamma_C,
                        eta: eta_C,
                        Q_gain: Q_source,
                        Q_loss: Q_sink,
                    }
                },
                Delta_theta_i_NA,
                gamma_C,
                eta_C,
                a_H,
                a_C,

                // 환기 상세
                V_net: Volume,
                n_inf: f_inf_daily_mean,
                n_win: n_win, // 사용 기간 환기 횟수 표시
                n_mech: n_mech_daily,
                heatRecoveryEff: heatRecoveryEfficiency,
                isForcedMech: forcedMechanical ? 1 : 0,

                // A_E 내역
                A_ext: A_ext,
                fx_ext: A_ext > 0 ? (fxArea_ext / A_ext) : 1.0,
                A_grnd: A_grnd,
                fx_grnd: A_grnd > 0 ? (fxArea_grnd / A_grnd) : 0,
                A_win: A_win,
                A_door: A_door,

                // 최소 외기 유량
                min_outdoor_airflow: minFlowArea,

                // DIN/TS 18599-5 5장 운전 조건 (Phase 1)
                theta_HK_av: opConditions.temperature.theta_HK_av,
                theta_VL: opConditions.temperature.theta_VL,
                theta_RL: opConditions.temperature.theta_RL,
                t_h_rL: opConditions.time.t_h_rL,
                beta_h_ce: opConditions.beta,

                // Phase 3: 방열 손실
                Q_h_ce: Q_h_ce,
                delta_theta_ce: emissionResult?.delta_theta_ce ?? 0,
                delta_theta_str: emissionResult?.delta_theta_str ?? 0,
                delta_theta_ctr: emissionResult?.delta_theta_ctr ?? 0,
                delta_theta_emb: emissionResult?.delta_theta_emb ?? 0,
                delta_theta_rad: emissionResult?.delta_theta_rad ?? 0,
                delta_theta_im: emissionResult?.delta_theta_im ?? 0,
                delta_theta_hydr: emissionResult?.delta_theta_hydr ?? 0,
                delta_theta_roomaut: emissionResult?.delta_theta_roomaut ?? 0,
                f_hydr: emissionResult?.f_hydr ?? 1.0,
                emissionLabels: emissionResult?.labels,
                emissionHallDetails: emissionResult?.emissionHallDetails,

                // 축열 이동 검증
                d_nutz: d_nutz,
                d_we: d_we,
                Q_storage_transfer: Q_transfer_total,
                Delta_Q_C_b_we: Delta_Q_c_b_we,
                Delta_Q_C_sink_nutz: Q_transfer_total, // 사용일 재충전

                // 상세 내역
                QT_op: QT_op,
                QV_op: QV_op,
                QS_op: QS_op,
                QS_op_transparent: QS_op_transparent,
                QS_op_opaque: QS_op_opaque,
                QI_op: QI_op,
                QT_non_op: QT_non_op,
                QV_non_op: QV_non_op,
                QS_non_op: QS_non_op,
                QS_non_op_transparent: QS_non_op_transparent,
                QS_non_op_opaque: QS_non_op_opaque,
                QI_non_op: QI_non_op,

                // 요청된 검증 필드 (런타임 추적)
                C_wirk: Cm,
                H_tr_sys: H_tr_curr,
                H_ve_sys: H_ve_curr,
                H_ve_mech_0: (Volume * HEAT_CAPACITY_AIR * n_mech_daily), // H_V,mech,0 (기본 기계환기 계수)
                Theta_e: Te_avg,
                Theta_i_h_soll: Theta_int_H,
                Theta_i_c_soll: Theta_int_C,
                Q_source: Q_gain,
                Q_sink: Q_loss_H,
                eta_h: eta_H,
                eta_c: eta_C,
                // Q_h_b, Q_c_b는 이미 상위 레벨에 있음

                // [상세 검증] 사용/비사용 내역
                // 난방
                tau_op: tau_h, // 단순화된 모델에서 op/non-op에 동일한 tau 가정, 필요시 다르게 적용
                tau_non_op: tau_h,
                alpha_op: a_H,
                alpha_non_op: a_H,
                // 참고: eta_nutz / eta_we는 분리된 로직 블록에서 계산됨.
                // 블록 스코프이므로 여기서 직접 접근 불가. 
                // 지금은 간단히 매핑하거나 계산되지 않은 경우 (예: 연속 운전) 0 사용.

                eta_h_op: eta_nutz > 0 ? eta_nutz : eta_H,
                eta_h_non_op: eta_we > 0 ? eta_we : (d_we > 0.1 ? eta_we : 0), // 유의미한 비사용 기간인 경우
                Q_source_op: QS_op + QI_op,
                Q_source_non_op: QS_non_op + QI_non_op,
                Q_sink_op: QT_op + QV_op + (d_nutz > 0 ? Q_transfer_total : 0), // 싱크에 이동량 추가? 로직이 복잡하여 현재는 단순 합계 유지
                Q_sink_non_op: QT_non_op + QV_non_op,
                Q_h_b_op: Q_h_b_op,
                Q_h_b_non_op: Q_h_b_non_op,
                Theta_i_h_op: Theta_i_h_op,
                Theta_i_h_non_op: (profile.annualUsageDays <= 260) ? Theta_i_h_non_op : undefined,

                // 냉방
                Q_c_b_op: Q_c_need, // 단순화됨
                Q_c_b_non_op: 0,

                // 사용 시간
                lighting_usage_hours: hoursUsage,
                dhw_usage_days: daysUsage,
                storageTransferDetails,
            });

            break; // 현재는 피드백 루프 없이 1회 계산 후 종료 (중복 데이터 삽입 방지)
        }
    }

    // 연간 합산
    const sumH = monthlyResults.reduce((s, m) => s + m.Q_h_b, 0);
    const sumC = monthlyResults.reduce((s, m) => s + m.Q_c_b, 0);
    const sumL = monthlyResults.reduce((s, m) => s + m.Q_l_b, 0);
    const sumD = monthlyResults.reduce((s, m) => s + m.Q_w_b, 0);
    const sumA = monthlyResults.reduce((s, m) => s + m.Q_aux, 0);

    // [신규] 프로젝트 레벨 검증 집계 (가중 평균 또는 합계)
    // 모든 존의 monthlyResults를 집계하여 프로젝트 레벨 월간 데이터를 얻어야 함.
    // 현재 이 함수는 'monthly'를 포함한 CalculationResults 객체를 반환함.
    // 하지만 여기서 'monthlyResults'는 현재 존 전용임.
    // "for (const zone of zones)" 루프는 "calculateEnergyDemand" 내부에 있지만 "calculateZoneMonthly" 외부에 있음.

    // 참고: 아키텍처 구조:
    // calculateEnergyDemand가 존을 순회 -> calculateZoneMonthly 호출 -> ZoneResult 획득
    // 그 후 헬퍼가 모든 것을 집계?
    // calculateEnergyDemand 반환 위치 확인.


    // 설비 효율 적용 (Final Energy) - 간단히 COP 적용 예시 (추후 hvac-calc 상세화 필요)
    // 기존에 있던 calculateHourlyHvac을 쓸 수도 없고, 월간용으로 새로 짜야함.
    // 여기서는 간단히 효율 계수를 직접 적용하여 마무리.

    // 설비 효율 적용 (Final Energy) - 간단히 COP 적용 예시 (추후 hvac-calc 상세화 필요)
    // 기존에 있던 calculateHourlyHvac을 쓸 수도 없고, 월간용으로 새로 짜야함.
    // 여기서는 간단히 효율 계수를 직접 적용하여 마무리.

    // [상단으로 이동] heatingSystem, coolingSystem, dhwSystemForFinal은 함수 시작 부분에 정의됨.

    // 단순화된 효율 (시스템 없을 시 1.0, 있으면 COP 적용)
    // 난방은 월별 calculateMonthlyHeatingSystem에서 계산된 값을 합산
    const feH = monthlyResults.reduce((s, m) => s + (m.finalEnergy?.heating || 0), 0);
    const peH = monthlyResults.reduce((s, m) => s + (m.primaryEnergy?.heating || 0), 0);
    const co2H = monthlyResults.reduce((s, m) => s + (m.co2Emissions?.heating || 0), 0);
    const auxH = monthlyResults.reduce((s, m) => s + (m.finalEnergy?.auxiliary || 0), 0);

    const copC = coolingSystem ? (coolingSystem.generator.efficiency || 3.0) : 3.0;

    // 설비 효율 초기화 (가정: 100% 효율)
    let feD = sumD;

    // 에너지원별 PEF (Primary Energy Factor)
    const fuelC = coolingSystem?.generator.energyCarrier || 'electricity';
    const fuelD = dhwSystemForFinal?.generator.energyCarrier || 'gas_lng';

    const pefC = PEF_FACTORS[fuelC as EnergyCarrier] || 2.75;
    const pefD = PEF_FACTORS[fuelD as EnergyCarrier] || 1.1;
    const pefL = PEF_FACTORS.electricity;

    // 최종 에너지 (Final Energy)
    const feC = sumC / copC;
    const feL = sumL;
    const feA = sumA + auxH;

    // 1차 에너지 (Primary Energy)
    const peC = feC * pefC;
    const peD = feD * pefD;
    const peL = feL * pefL;
    const peA = feA * PEF_FACTORS.electricity;
    const peTotal = peH + peC + peD + peL + peA;


    // CO2
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
            monthly: monthlyResults, // 필수 필드 추가
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
 * 시간별 일사량 계산 (상세 계산 래퍼)
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
 * 상세 검증을 위한 시간별 일사량 세부 계산 (전체 객체 반환)
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
        // 지평선 및 일주광 증광을 고려한 비등방성 모델
        const I_hz_global = Ib + Id;
        let F = 0; // 조절 함수 (0: 흐림 -> 1: 맑음)
        if (I_hz_global > 0) {
            const ratio = Id / I_hz_global;
            F = 1 - (ratio * ratio);
        }

        const term_iso = (1 + Math.cos(beta)) / 2; // 등방성 항
        const term_hor = 1 + F * Math.pow(Math.sin(beta / 2), 3); // 지평선 증광
        // 일주광 증광 (태양이 전면에 있는지 확인하기 위해 max(0, cos_theta) 사용)
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
    // 사용자 요청 이미지의 새로운 변수로 CSV 헤더 업데이트
    let csv = "\uFEFFMonth,Day,Hour,Te (C),Azimuth_Sun (deg),Altitude_Sun (deg),Zone,Surface,Type,Azimuth_Surf (deg),Tilt (deg),Theta_Inc (deg),Rb,Ib_horiz (Wh/m2),Id_horiz (Wh/m2),Ib_surf (Wh/m2),Id_surf (Wh/m2),Ir_surf (Wh/m2),I_Tot (Wh/m2)";
    // 새 열 추가: A, U, alpha, R_se, F_f, h_r, Delta_theta_er, F_g, g_eff, F_s, F_w, F_v, I_s
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

                // 추가 변수 추출/계산
                const A = surf.area;
                const U = surf.uValue;
                let alpha = surf.absorptionCoefficient ?? 0.5; // 불투명체 기본값
                const construction = constructions?.find(c => c.id === surf.constructionId);
                const R_se = construction?.r_se ?? 0.04; // 실외 표면 열전달 저항

                // Form factor F_f (F_f_sky)
                // 경사각 45도 이하 (수평에 가까움) => 1.0
                // 경사각 45도 초과 (수직에 가까움) => 0.5
                const F_f = tilt <= 45 ? 1.0 : 0.5;

                const h_r = 4.5; // 방사 열전달 계수
                const Delta_theta_er = 10; // 겉보기 천공 온도차

                // 투명 부재
                let F_g = 0;
                let g_eff = 0;
                let F_s = 0;
                let F_w = 0;
                let F_v = 0;

                if (surf.type === 'window' || surf.type === 'door') {
                    // 창문 전용
                    const shgc = surf.shgc ?? construction?.shgc ?? 0.6;
                    F_g = 0.7; // 프레임 비율 (1 - F_F), 기본값 0.7
                    F_s = 0.9; // 음영
                    F_w = 0.9; // 비수직
                    F_v = 0.9; // 오염도
                    // g_eff = F_s * F_w * F_v * shgc
                    g_eff = F_s * F_w * F_v * shgc;
                    // Alpha는 일반적으로 투과 계산에 관련 없으나 구조 유지를 위해 유지
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
                let alpha = surf.absorptionCoefficient ?? 0.6;
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

/**
 * [신규] 폼 UI 렌더링 시점에 즉각적으로 가중평균 난방부하를 추정하기 위한 헬퍼 함수.
 * 존의 표면 데이터가 존재하면 관류/환기 열손실을 바탕으로 산출하며 없으면 경험적 수치로 대체합니다.
 */
export function estimateSpecificHeatingLoad(zones: any[], Te_min: number = -12.0): number {
    let totalArea = 0;
    let P_h_max_total = 0;

    for (const zone of zones) {
        if (!zone || zone.isExcluded) continue;

        const Area = zone.area || 0;
        if (Area <= 0) continue;

        totalArea += Area;

        // 1. Estimate Transmission (H_tr)
        let H_tr = 0;
        if (zone.surfaces && Array.isArray(zone.surfaces) && zone.surfaces.length > 0) {
            zone.surfaces.forEach((surf: any) => {
                const u_val = surf.uValue || 0;
                let fx = 1.0;
                if (surf.type.includes("ground") || surf.type.includes("unheated")) fx = 0.5;
                if (surf.type.includes("interior")) fx = 0;
                H_tr += u_val * surf.area * fx;
            });
        } else {
            // 표면 데이터가 없을 시 경험적 추정 (외피면적비율 1.5, 평균 열관류율 0.8)
            H_tr = 0.8 * (Area * 1.5);
        }

        // 2. Estimate Ventilation (H_ve)
        let H_ve = 0;
        const vol = Area * (zone.height || 3.0) * 0.95;
        // DIN 18599 프로파일 등 상세 데이터 접근이 어려우므로 0.4 회로 기본 추산
        const n_nutz = 0.4;
        H_ve = vol * n_nutz * 0.34;

        // 3. 설정 온도 기준 최대 부하 합산
        const Theta_int_H = zone.temperatureSetpoints?.heating || 20;
        P_h_max_total += (H_tr + H_ve) * (Theta_int_H - Te_min);
    }

    if (totalArea === 0) return 50; // 기본 디폴트
    return Math.max(10, P_h_max_total / totalArea);
}
