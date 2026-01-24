import { ZoneInput, CalculationResults, MonthlyResult } from "./types";
import { Project } from "@/types/project";
import { KOREA_WEATHER_STATIONS } from "@/lib/climate-data";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { calculateSolarRadiation } from "./solar-calc";

// DIN V 18599 매개변수 (간략화됨)
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const HEAT_CAPACITY_AIR = 0.34; // 공기 비열 Wh/(m³K) (약어)

// 유효한 공조기 속성을 가져오는 헬퍼 함수
function getEffectiveVentilationProperties(
    zone: ZoneInput,
    allUnits: Project['ventilationUnits'] = []
): { type: "balanced" | "exhaust" | "supply"; efficiency: number; totalSupplyFlow: number; totalExhaustFlow: number; hasExplicitFlow: boolean } | null {
    if (!zone.linkedVentilationUnitIds || zone.linkedVentilationUnitIds.length === 0) {
        return null;
    }

    const linkedUnits = allUnits.filter(u => zone.linkedVentilationUnitIds!.includes(u.id));
    if (linkedUnits.length === 0) return null;

    // 1. 주 시스템 유형 결정 (지배적인 유형 판단)
    // 혼합된 유닛이 있을 경우 로직 개선:
    // - 급기/배기 (Balanced)가 하나라도 있거나, (급기 전용 + 배기 전용)이 섞여 있으면 -> 'Balanced'
    // - 급기 전용만 있으면 -> 'Supply'
    // - 배기 전용만 있으면 -> 'Exhaust'
    const hasBalanced = linkedUnits.some(u => u.type === 'balanced');
    const hasSupply = linkedUnits.some(u => u.type === 'supply');
    const hasExhaust = linkedUnits.some(u => u.type === 'exhaust');

    let type: "balanced" | "exhaust" | "supply" = "balanced";

    if (hasBalanced || (hasSupply && hasExhaust)) {
        type = "balanced";
    } else if (hasSupply) {
        type = "supply";
    } else {
        type = "exhaust";
    }

    // 2. 명시적 풍량 합계 계산 (가중 평균 계산을 위해 선행)
    const totalSupplyFlow = linkedUnits.reduce((sum, u) => sum + (u.supplyFlowRate || 0), 0);
    const totalExhaustFlow = linkedUnits.reduce((sum, u) => sum + (u.exhaustFlowRate || 0), 0);
    const hasExplicitFlow = totalSupplyFlow > 0 || totalExhaustFlow > 0;

    // 3. 가중 평균 효율 계산 (Weighted Average Efficiency)
    // 명시적 풍량이 있는 경우, 급기 풍량(supplyFlowRate)을 가중치로 사용
    // (열회수는 통상 급기 측에서 일어나므로)
    // 풍량 정보가 없으면 기존처럼 단순 평균 사용
    let avgEff = 0;

    if (hasExplicitFlow && totalSupplyFlow > 0) {
        const weightedSum = linkedUnits.reduce((sum, u) => {
            // 해당 유닛의 급기 풍량 가중치 적용
            const flow = u.supplyFlowRate || 0;
            return sum + (u.heatRecoveryEfficiency * flow);
        }, 0);
        avgEff = weightedSum / totalSupplyFlow;
    } else {
        // 풍량이 정의되지 않은 경우 단순 평균 (기존 로직)
        // 단, 열회수가 가능한 유닛(Balanced/Supply)만 평균에 포함하는 것이 합리적일 수 있으나,
        // 현재 데이터 구조상 모든 유닛을 대상으로 하되 0인 경우를 포함
        const totalEff = linkedUnits.reduce((sum, u) => sum + u.heatRecoveryEfficiency, 0);
        avgEff = totalEff / linkedUnits.length;
    }

    return { type, efficiency: avgEff, totalSupplyFlow, totalExhaustFlow, hasExplicitFlow };
}

export function calculateEnergyDemand(zones: ZoneInput[], weatherStationId?: number, mainStructure?: string, ventilationConfig?: Project['ventilationConfig'], ventilationUnits?: Project['ventilationUnits']): CalculationResults {
    // 기상 관측소 찾기
    const defaultStationId = 108; // 서울
    const station = KOREA_WEATHER_STATIONS.find(s => s.id === weatherStationId)
        || KOREA_WEATHER_STATIONS.find(s => s.id === defaultStationId)
        || KOREA_WEATHER_STATIONS[0];

    const monthlyResults: MonthlyResult[] = [];

    // 월별 결과 누적기 초기화
    for (let i = 0; i < 12; i++) {
        monthlyResults.push({
            month: i + 1,
            QT: 0, QV: 0, Qloss: 0,
            QS: 0, QI: 0, Qgain: 0,
            gamma: 0, eta: 0,
            Qh: 0, Qc: 0,
            warnings: []
        });
    }

    // DIN V 18599-2 Section 6 구현

    // 구조에 따른 Cm 계수 결정
    let Cm_factor = 50; // 기본값 (중량/경량)
    if (mainStructure) {
        if (["철근콘크리트구조", "철골철근콘크리트구조", "조적구조"].includes(mainStructure)) {
            Cm_factor = 90; // 중량 구조 (Heavy)
        } else if (["철골구조", "목구조"].includes(mainStructure)) {
            Cm_factor = 50; // 경량 구조 (Light)
        }
    }

    // 전체 프로젝트 체적 (글로벌 설계 풍량 배분을 위해 사용)
    let totalProjectVolume = 0;
    zones.forEach(z => {
        if (!z.isExcluded) {
            totalProjectVolume += z.area * z.height * 0.95;
        }
    });

    zones.forEach(zone => { // 각 존에 대해 루프 수행
        if (zone.isExcluded) return; // 제외된 존 건너뛰기

        const Area = zone.area;
        const Height = zone.height;
        const Volume = Area * Height * 0.95;
        // 유효 공기 체적 (V_net)
        // 0.95 계수: 면적은 중심선 기준, 높이는 천장고(순 높이).
        // 내부 칸막이벽 및 가구 등을 고려하여 1.0에서 약간 줄임.

        // 용도 프로필 데이터
        const profile = DIN_18599_PROFILES[zone.usageType] || DIN_18599_PROFILES["residential_single"];

        // 난방 설정온도 (존의 사용자 입력을 우선하고, 필요시 프로필값 사용)
        const Ti = zone.temperatureSetpoints.heating;

        // 유효 열용량 (C_m)
        const C_m = Cm_factor * Area;

        // 월별 루프 수행
        for (let m = 0; m < 12; m++) {
            const days = DAYS_IN_MONTH[m];
            const hours = days * 24;
            const Te = station.monthlyTemp[m];
            const Is_H = station.monthlySolar[m]; // kWh/m²/month 단위

            // --- 1. 열 손실 (Q_sink) ---

            // 전열 손실 (H_tr)
            let H_tr = 0;
            zone.surfaces.forEach(surf => {
                let Fx = 1.0; // 기본값 (외기에 직접 면함)

                // 1. 단열 / 열 전달 없음 (예: 인접 세대 벽체)
                // 'NoExposure' 방위로 정의됨
                if (surf.orientation === "NoExposure") {
                    Fx = 0.0;
                }
                // 2. 지면 접함 (토양)
                else if (surf.type.includes("ground")) {
                    Fx = 0.6; // 지면 접함 (간략화된 표준값)
                }
                // 3. 간접 / 비난방 공간 (예: 계단실, 지하주차장)
                else if (surf.type.includes("interior")) {
                    Fx = 0.5; // 비난방 공간에 간접 면함
                }

                H_tr += surf.area * surf.uValue * Fx;
            });

            // 열교 할증 (delta U_wb)
            // H_TB = Area_envelope * deltaU_wb
            const deltaU_wb = zone.thermalBridgeMode ?? 0.10; // 설정되지 않은 경우 기본값 0.10
            const Area_envelope = zone.surfaces.reduce((sum, surf) => {
                // 열 전달이 있는 경우(Fx > 0) 외피 면적에 포함
                if (!surf.type.includes("interior") || surf.type.includes("ground") || (surf.type.includes("interior") && true)) {
                    return sum + surf.area;
                }
                return sum;
            }, 0);

            H_tr += Area_envelope * deltaU_wb;

            // 환기 손실 (H_ve)
            // DIN V 18599-2

            // 1. 필요 신선 외기량 (V_req)
            const reqRate = profile.minOutdoorAir || 0;
            const V_req = Area * reqRate; // [m³/h]

            // 2. 침기 (V_inf) - 건물 전체 기밀성 기준
            // 매개변수
            const n50 = ventilationConfig?.n50 ?? 2.0;
            const e_shield = 0.07; // e: 방풍 계수 (표준 0.07)
            let f_ATD = 1.0;
            const hasALD = ventilationConfig?.hasALD ?? false;

            if (hasALD && n50 > 0) {
                f_ATD = Math.min(16, (n50 + 1.5) / n50);
            }

            // 기본 n_inf (기계환기 없는 자연상태)
            let n_inf = n50 * e_shield * f_ATD;

            // 3. 기계 및 창문 환기
            let V_mech = 0; // 기계 환기량 [m³/h] (팬이 이동시키는 실제 풍량)
            let V_mech_eff = 0; // 유효 기계 환기량 [m³/h] (열회수 효율이 고려된 등가 풍량)
            let V_win = 0; // 창문 환기량 [m³/h] (자연 환기에 의한 풍량)

            // 창문 환기 로직에 필요한 변수 스코프 설정
            let n_mech_ZUL = 0;
            let n_mech_ABL = 0;
            let f_e = 1.0;

            const hasWindows = zone.surfaces.some(s => s.type === 'window' || s.type === 'door');

            // 용도별 필요 환기 횟수 (n_nutz) Eq 84
            const n_nutz = (profile.minOutdoorAirFlow > 0 ? (profile.minOutdoorAirFlow * Area) : V_req) / Volume;
            const t_nutz = profile.dailyUsageHours;

            // --- 기계 환기 계산 (있을 경우) ---
            // 연결된 공조 장비의 유효 속성(타입, 효율, 풍량 등)을 가져옴
            const linkedUnitProps = getEffectiveVentilationProperties(zone, ventilationUnits);
            // 기계 환기 장치가 연결되어 있는지 여부 확인 (null이면 없음)
            const hasMechanical = !!linkedUnitProps;

            if (hasMechanical) {
                // 기계 환기 작동 시 침기율 보정 (DIN V 18599-2 Eq 60)
                // 설계 풍량 (n_mech_design)
                // 위생 필요 환기량 (Hygienic minimum)
                const n_mech_hygiene = profile.minOutdoorAirFlow > 0
                    ? (profile.minOutdoorAirFlow * Area / Volume)
                    : (reqRate * Area / Volume);

                // 설계 풍량 (n_mech_design) 결정
                // 위생 필요 환기량을 기본값으로 사용
                const n_mech_design = n_mech_hygiene;

                // TODO: 냉방 부하 제거를 위한 필요 풍량(Eq 91) 자동 계산 구현 필요
                // 현재는 공조 장비의 명시적 풍량 설정을 통해 수동으로 반영 가능함.

                // 주거용 건물 (DIN V 18599-6 Eq 90)
                // "주거용 환기 시스템의 경우... n_mech,ZUL = n_mech"
                // 이는 일반적으로 DIN 1946-6 등에 의해 결정된 환기량을 의미함.
                // 프로필에 정의된 표준값을 사용하므로 이를 충족함.
                // 배기 전용 시스템인 경우 n_mech_ZUL = 0 처리는 아래 로직에서 수행됨.

                // --- 기계 환기 시스템 특성 파악 ---
                // 시스템 유형 결정
                let sysType: "balanced" | "exhaust" | "supply" = "balanced"; // 시스템 유형 (급배기/배기전용/급기전용)
                let eta_HR_val = 0; // 열회수 효율 (%)
                let explicitSupply = 0; // 명시적 급기 풍량 합계 (m³/h)
                let explicitExhaust = 0; // 명시적 배기 풍량 합계 (m³/h)
                let useExplicitFlows = false; // 명시적 풍량 사용 여부 (장비에 풍량이 입력되었는지)

                if (linkedUnitProps) {
                    sysType = linkedUnitProps.type;
                    eta_HR_val = linkedUnitProps.efficiency;
                    explicitSupply = linkedUnitProps.totalSupplyFlow;
                    explicitExhaust = linkedUnitProps.totalExhaustFlow;
                    useExplicitFlows = linkedUnitProps.hasExplicitFlow;
                }

                if (useExplicitFlows) {
                    // 1. 유닛에서 제공된 명시적 풍량 사용
                    n_mech_ZUL = explicitSupply / Volume;
                    n_mech_ABL = explicitExhaust / Volume;
                } else {
                    // 2. 요구량 기반 로직 (n_mech_design)
                    if (sysType === "balanced") {
                        n_mech_ZUL = n_mech_design;
                        n_mech_ABL = n_mech_design;
                    } else if (sysType === "exhaust") {
                        n_mech_ZUL = 0;
                        n_mech_ABL = n_mech_design;
                    } else if (sysType === "supply") {
                        n_mech_ZUL = n_mech_design;
                        n_mech_ABL = 0;
                    }
                }

                // f_e (불균형 계수) 계산 - DIN V 18599-2 Eq 64/65
                if (n_mech_ZUL === n_mech_ABL) {
                    // Eq 64: 균형 환기
                    f_e = 1.0;
                } else {
                    // Eq 65: 불균형 환기
                    const f_coeff = 15.0;
                    if (n50 > 0 && f_ATD > 0) {
                        const ratio = (n_mech_ABL - n_mech_ZUL) / (n50 * f_ATD);
                        f_e = 1.0 / (1.0 + (f_coeff / e_shield) * Math.pow(ratio, 2));
                    }
                }

                // 기계 환기 작동 시 침기율 보정 (DIN V 18599-2 Eq 60)
                const t_V_mech = profile.hvacDailyOperationHours;

                // 보정된 n_inf
                n_inf = n50 * e_shield * f_ATD * (1 + (f_e - 1) * (t_V_mech / 24.0));

                // 유효 열회수 효율
                const eta_HR = eta_HR_val / 100.0;

                // V_mech Calculation
                // 급기량 기준 평균 풍량
                const n_mech_avg = n_mech_ZUL * (t_V_mech / 24.0);
                V_mech = Volume * n_mech_avg;

                // V_mech_eff Calculation
                if (sysType === "balanced" || sysType === "supply") {
                    // 급기가 있는 경우 (열회수 적용 가능)
                    if (eta_HR > 0) {
                        V_mech_eff = Volume * n_mech_ZUL * (t_V_mech / 24.0) * (1.0 - eta_HR);
                    } else {
                        V_mech_eff = Volume * n_mech_ZUL * (t_V_mech / 24.0);
                    }
                } else {
                    // 배기 전용 (Exhaust only): V_mech (급기)는 0. 
                    V_mech_eff = 0;
                }
            }

            // 침기량 확정
            const V_inf = Volume * n_inf;

            // --- B. 창문 환기 계산 (창호가 있을 경우) ---
            if (hasWindows) {
                let n_win = 0;
                let n_win_min = 0.1; // 식 73 시작: n_win,min
                // 주거용 계절 보정
                const isResidential = zone.usageType.startsWith("residential");
                if (isResidential) {
                    n_win_min = n_win_min * (0.04 * Te + 0.8);
                }

                // 공통 변수 준비
                // n_nutz: 위에서 이미 계산됨 (용도별 필요 환기 횟수)
                // n_inf: 식 59에 따른 침기율 (여기서는 기계 환기 보정 전의 기본 침기율을 의미)
                // DIN 식 59는 기계 환기 여부와 상관없이 기본 침기율 n_50 * e * f_ATD 임 (기계 환기 시에는 f_e 보정 추가됨)
                // 식 74, 75에서의 n_inf는 기본 침기율을 의미함. (식 59 참조)
                const n_inf_0 = n50 * e_shield * f_ATD; // 기본 침기율 (Base infiltration)

                // 1. 기계 환기 없을 때의 추가 창문 환기 (Delta_n_win) - Eq 74, 75
                // 기계 환기 여부에 따라 사용하는 n_inf가 다름
                // - 기계 환기 없음: 현재 n_inf (기본값)
                // - 기계 환기 있음: 비가동 시간에는 기본 n_inf_0 사용

                let Delta_n_win = 0;
                // 공통적으로 사용할 n_inf 값 결정
                const n_inf_calc = (!hasMechanical) ? n_inf : n_inf_0;

                if (n_nutz < 1.2) {
                    // 식 74
                    const factor = (n_nutz - 0.2);
                    Delta_n_win = Math.max(0, n_nutz - factor * n_inf_calc - 0.1);
                } else {
                    // 식 75
                    Delta_n_win = Math.max(0, n_nutz - n_inf_calc - 0.1);
                }

                if (!hasMechanical) {
                    // 기계 환기 없음 - Eq 73
                    n_win = n_win_min + Delta_n_win * (t_nutz / 24.0);
                } else {
                    // 기계 환기 있음
                    const t_V_mech = profile.hvacDailyOperationHours; // t_V,mech

                    // 2. 기계 환기 작동 시 추가 창문 환기 (Delta_n_win_mech)
                    // 우선 Delta_n_win_mech,0 계산 (Eq 78, 79) - Infiltration with imbalance factor f_e (already calculated above)
                    // f_e는 기계환기 루프 안에서 계산된 값 사용
                    // 주의: 식 78에서 n_inf,0 * f_e 사용됨
                    let Delta_n_win_mech_0 = 0;
                    if (n_nutz < 1.2) {
                        // 식 78
                        const factor = (n_nutz - 0.2);
                        Delta_n_win_mech_0 = Math.max(0, n_nutz - factor * n_inf_0 * f_e - 0.1);
                    } else {
                        // 식 79
                        Delta_n_win_mech_0 = Math.max(0, n_nutz - n_inf_0 * f_e - 0.1);
                    }

                    // 공급/배기 불균형에 따른 Case 분류 (Eq 80-83)
                    // n_ZUL = Mech Supply + Transfer Supply (n_z,ZUL is 0 for now)
                    // n_ETA = Mech Exhaust + Transfer Exhaust (n_z,ETA is 0 for now)
                    const n_ZUL = n_mech_ZUL; // calculated inside mech block
                    const n_ETA = n_mech_ABL; // calculated inside mech block which is exhaust rate

                    let Delta_n_win_mech = 0;

                    // Fall a) Demand covered by Supply (Delta_n_win_mech,0 <= n_ZUL) -> Actually logic is about required vs provided?
                    // Image text: "Fall a) Der nutzungsbedingt notwendige Luftwechsel ist durch die Zuluft gedeckt"
                    // Condition: Delta_n_win_mech,0 <= n_ZUL ?? No, text says "Bedingung: Delta_n_win_mech,0 <= n_ZUL"
                    // Wait, logic check:

                    if (Delta_n_win_mech_0 <= n_ZUL) {
                        // Fall a
                        if (n_ETA <= (n_ZUL + n_inf_0)) {
                            // Fall a-1 Eq 80
                            Delta_n_win_mech = 0;
                        } else {
                            // Fall a-2 Eq 81
                            Delta_n_win_mech = n_ETA - n_ZUL - n_inf_0;
                        }
                    } else {
                        // Fall b) Not covered by supply
                        // Bedingung: Delta_n_win_mech,0 > n_ZUL

                        if (n_ETA <= (Delta_n_win_mech_0 + n_inf_0)) {
                            // Fall b-1 Eq 82
                            Delta_n_win_mech = Delta_n_win_mech_0 - n_ZUL;
                        } else {
                            // Fall b-2 Eq 83
                            Delta_n_win_mech = n_ETA - n_ZUL - n_inf_0;
                        }
                    }

                    // Final Calculation based on Operation Time
                    if (t_V_mech >= t_nutz) {
                        // Eq 76 (Standard Case)
                        n_win = n_win_min + Delta_n_win_mech * (t_V_mech / 24.0);
                    } else {
                        // Eq 77 (Short Operation)
                        // 미가동 시간(t_nutz - t_V_mech) 동안은 자연환기 논리 Delta_n_win 사용
                        // 가동 시간(t_V_mech) 동안은 기계환기 보충 논리 Delta_n_win_mech 사용
                        n_win = n_win_min + Delta_n_win * ((t_nutz - t_V_mech) / 24.0) + Delta_n_win_mech * (t_V_mech / 24.0);
                    }
                }

                // 음수 방지
                n_win = Math.max(0, n_win);
                V_win = Volume * n_win;
            } else {
                V_win = 0;
            }

            // --- C. 부족 환기량 및 결과 처리 ---
            const V_supply_eff_daily = V_inf + V_win + (hasMechanical ? V_mech : 0);
            // V_mech는 일평균 풍량 (24시간 평균).
            // V_req (목표값) 또한 24시간 평균이거나 타이밍이 맞아야 함.
            // DIN은 평균 유량을 기준으로 에너지 밸런스를 계산함.
            // 부족량 확인 (Shortfall Check):
            // n_nutz는 일반적으로 사용 시간 동안의 요구량임.
            // 평균 요구량 = n_nutz * Volume * (t_nutz / 24).
            const V_req_avg = n_nutz * Volume * (t_nutz / 24.0);

            if (V_supply_eff_daily < V_req_avg * 0.9) { // 10% tolerance
                if (!monthlyResults[m].warnings) monthlyResults[m].warnings = [];
                // Avoid Duplicate Warnings
                const msg = `Zone ${zone.name}: 환기량 부족 (${Math.round(V_supply_eff_daily)} < ${Math.round(V_req_avg)})`;
                if (!monthlyResults[m].warnings!.includes(msg)) {
                    monthlyResults[m].warnings!.push(msg);
                }
            }

            const V_total_eff = V_inf + V_win + V_mech_eff;
            const H_ve = HEAT_CAPACITY_AIR * V_total_eff;
            const H_total = H_tr + H_ve;

            // 총 열 손실 (Q_sink) [kWh]
            const Q_sink = Math.max(0, H_total * (Ti - Te) * hours / 1000);

            // --- 2. 일사 획득 (Q_source) ---

            // 일사 획득 (Q_sol)
            // Q_sol = Sum( I_s * A * F_F * F_S * F_C * g_tot ) -> DIN 18599-2 Eq 110 로직으로 대체됨
            let Q_sol = 0;

            zone.surfaces.forEach(surf => {
                // 공통: 방위 및 경사각에 따른 표면 일사량 계산 (Liu & Jordan 모델)
                const orient = surf.orientation || "S";
                // Azimuth: South=0, East=-90, West=90, North=180
                let azimuth = 0;
                if (orient === 'S') azimuth = 0;
                else if (orient === 'SE') azimuth = -45;
                else if (orient === 'SW') azimuth = 45;
                else if (orient === 'E') azimuth = -90;
                else if (orient === 'W') azimuth = 90;
                else if (orient === 'NE') azimuth = -135;
                else if (orient === 'NW') azimuth = 135;
                else if (orient === 'N') azimuth = 180;
                else if (orient === 'Horiz') azimuth = 0; // Azimuth irrelevant for horiz
                else if (orient === 'NoExposure') azimuth = 0;

                // Tilt: 0 = Horizontal, 90 = Vertical
                let tilt = surf.tilt ?? 90; // Default to vertical wall
                if (orient === 'Horiz') tilt = 0;
                if (surf.type === 'roof_exterior' && surf.tilt === undefined) tilt = 0; // Default roof to horizontal if undefined
                if (surf.type === 'floor_exterior') tilt = 180; // Facing down (not exposed to sun usually, or reflected only) logic handles 0 direct.

                // NoExposure handling
                let I_s = 0;
                if (orient !== 'NoExposure') {
                    I_s = calculateSolarRadiation(Is_H, m, station.latitude, azimuth, tilt);
                }

                // 표면 일사량 [kWh/m2]
                // I_s는 calculateSolarRadiation에서 계산됨

                if (surf.type === 'window' || surf.type === 'door') {
                    // DIN V 18599-2:2018-09 6.4.1 투명한 면을 통한 태양 복사 열획득
                    // Eq 110: Q_s,tr = F_F * A * g_eff * I_S * t

                    const F_F = 0.7; // F_F: 프레임 저감 계수 (기본값 0.7, DIN V 18599-2)

                    // g_eff 계산 (유효 총 에너지 투과율)
                    // 현재 차양 장치가 없는 경우(Eq 111)를 기준으로 함:
                    // g_eff = F_S * F_W * F_V * g_perp

                    const F_S = 0.9; // F_S: 차폐 계수 (주변 건물/지형), 보통 0.9 사용 (Eq 114)
                    const F_W = 0.9; // F_W: 입사각 수정 계수 (비수직 입사), 표준값 0.9
                    const F_V = 1.0; // F_V: 오염 보정 계수, 표준값 1.0
                    //TODO: F_V: 오염 보정 계수 DIN V 18599-10 참조 알고리즘 구현 필요  

                    const g_perp = surf.shgc ?? 0.6; // g_perp: 창호의 태양열 취득 계수 (SHGC), 수직 입사 기준 (Envelope Type 값 우선)

                    const g_eff = F_S * F_W * F_V * g_perp;  // g_eff: 유효 총 에너지 투과율(차양 장치가 없는 경우)
                    //TODO:고정식 차양 장치/가변식 차양 장치에 따른 g_eff 계산 추가 필요    

                    // I_s는 월간 총 일사량(Energy, kWh/m²)이므로 이미 시간(t) 요소가 포함되어 있음. (따라서 식 110의 t를 추가로 곱하지 않음)
                    Q_sol += surf.area * I_s * F_F * g_eff;
                } else if (
                    surf.type === 'wall_exterior' ||
                    surf.type === 'roof_exterior'
                ) {
                    // DIN V 18599-2:2018-09 6.4.2 불투명 부재를 통한 태양 복사 열획득
                    // Eq 115 & 116 (열원/열침에 따른 부호 처리)
                    // Q_S,opak = R_se * U * A * (alpha * I_S - F_f * h_r * d_theta_er) * t

                    const R_se = 0.04; // 외부 표면 열전달 저항 [m²K/W] (표준값)
                    const alpha = surf.absorptionCoefficient ?? 0.5; // (Table 8 참조: 밝은색 0.4, 어두운색 0.8 등)

                    // F_f: 형태 계수 (Form factor)
                    // 수평면(기울기 < 45도): 1.0
                    // 수직면(기울기 >= 45도): 0.5
                    // surf.tilt가 위에서 이미 tilt 변수로 할당되었으므로 이를 그대로 사용
                    // F_f: 형태 계수 (Form factor) - 수평면(<45도) 1.0, 수직면(>=45도) 0.5
                    const F_f = tilt < 45 ? 1.0 : 0.5;

                    // h_r: 외부 복사 열전달 계수 (Eq 117)
                    // h_r = 5 * epsilon, epsilon은 방사율 (기본값 0.9)
                    const epsilon = 0.9;
                    const h_r = 5.0 * epsilon; // = 4.5 W/(m²K)

                    // d_theta_er: 하늘의 외기 온도 차이 (평균 10 K 가정)
                    const d_theta_er = 10.0; // K

                    // 유효 일사량 항 (Effective Solar Term)
                    // alpha * I_S (획득) - F_f * h_r * d_theta_er (방사 손실)
                    const radiationBalance = (alpha * I_s) - (F_f * h_r * d_theta_er);

                    // Q_S,opak 계산 (양수면 열획득, 음수면 열손실로 작용하나, 여기서는 태양열 획득 항에 더함)
                    // 만약 음수가 되면 '열손실(Sink)'로 작용하지만, DIN 공식 구조상 Q_sol에 합산하여 순 획득량으로 처리하거나
                    // Eq 116처럼 별도 Sink로 분류할 수도 있음.
                    // Monthly Method에서는 Net Gain으로 합산하는 것이 일반적임. (음수 허용)

                    // I_s는 [kWh/m²·month] 단위.
                    // 공식의 다른 항들은 W/m² 단위이므로 단위 변환 필요.
                    // 그러나 위 식 110 구현에서도 I_s * t 가 사용되었음. (I_s 자체가 에너지)
                    // 식 115의 괄호 안은 (Power - Power) 구조임. 여기에 시간 t를 곱해야 에너지.
                    // 현재 I_s 변수는 "월간 누적 일사량 (Energy)"임. 즉 (Power_avg * t).
                    // 따라서 (alpha * I_s)는 에너지 항이 됨.
                    // 뒤의 (F_f * h_r * d_theta_er)는 Power(Flux)이므로 시간 t(hours)를 곱해서 에너지로 변환해야 함.

                    const longwaveLoss = F_f * h_r * d_theta_er * hours / 1000; // Wh -> kWh 변환

                    // 최종 계산:
                    // Q_sol += R_se * U * A * (alpha * Is_H_total_kWh - LongwaveLoss_kWh)
                    // 주의: R_se * U * A 는 [m²K/W * W/m²K * m²] = [m²] (단위 상쇄되어 면적?? 아님)
                    // R_se [m²K/W] * U [W/m²K] -> 무차원 계수 (U * R_se)
                    // 결과 = (U * R_se) * A * (Energy_Gain - Energy_Loss)  [kWh]

                    const Q_opak = R_se * surf.uValue * surf.area * ((alpha * I_s) - longwaveLoss);

                    Q_sol += Q_opak;
                }
            });

            // 내부 발열 (Q_int)
            // A. 조명 열 획득 (Q_l)
            const efficacy = zone.lighting?.efficacy ?? 60.0;
            const powerDensity = zone.lighting?.powerDensity ?? (profile.illuminance / efficacy);
            const P_light_total = powerDensity * Area;

            // B. 인체 및 기기 발열 (Q_p + Q_e)
            // 프로필은 Wh/(m²·d) 단위 (일일 에너지)를 제공함. 이를 "사용 일수" 기준으로 가정함.
            // 연간 계수 = annualUsageDays / 365
            const dailyInternalHeat = profile.metabolicHeat + profile.equipmentHeat; // Wh/(m²·d) 단위
            const usageFactor = profile.annualUsageDays / 365.0;

            const Q_l_daily = P_light_total * profile.dailyUsageHours * (1 - profile.lightingAbsenceFactor) * profile.partialOperationFactorLighting;
            const q_light_daily = Q_l_daily / Area;

            const totalDailyGain = dailyInternalHeat + q_light_daily;
            const Q_int = (totalDailyGain * days * usageFactor * Area) / 1000;

            const Q_source = Q_sol + Q_int;

            // --- 3. 이용 효율 (eta) ---

            const gamma = Q_sink > 0 ? Q_source / Q_sink : 1000;
            const tau = C_m / H_total;
            const a = 1 + (tau / 15);

            let eta = 1.0;
            if (gamma > 0 && Math.abs(gamma - 1) > 0.0001) {
                eta = (1 - Math.pow(gamma, a)) / (1 - Math.pow(gamma, a + 1));
            } else if (Math.abs(gamma - 1) <= 0.0001) {
                eta = a / (a + 1);
            }

            const Qh = Math.max(0, Q_sink - eta * Q_source);

            // --- 냉방 에너지 요구량 계산 ---
            const Ti_c = zone.temperatureSetpoints.cooling;
            const Q_source_c = Q_sol + Q_int;

            const Q_sink_c_val = (H_total * (Ti_c - Te) * hours) / 1000;

            let Q_sink_c = 0;
            let Q_source_c_eff = Q_source_c;

            if (Q_sink_c_val > 0) {
                Q_sink_c = Q_sink_c_val;
            } else {
                Q_source_c_eff += Math.abs(Q_sink_c_val);
                Q_sink_c = 0;
            }

            const gamma_c = Q_source_c_eff > 0 ? Q_sink_c / Q_source_c_eff : 1000;

            let eta_c = 1.0;
            if (gamma_c > 0 && Math.abs(gamma_c - 1) > 0.0001) {
                eta_c = (1 - Math.pow(gamma_c, a)) / (1 - Math.pow(gamma_c, a + 1));
            } else if (Math.abs(gamma_c - 1) <= 0.0001) {
                eta_c = a / (a + 1);
            }

            let Qc = Q_source_c_eff - eta_c * Q_sink_c;
            if (Qc < 0) Qc = 0;

            // 결과 누적
            const res = monthlyResults[m];
            res.QT += (H_tr * (Ti - Te) * hours / 1000);
            res.QV += (H_ve * (Ti - Te) * hours / 1000);
            res.Qloss += Q_sink;

            res.QS += Q_sol;
            res.QI += Q_int;
            res.Qgain += Q_source;

            res.gamma = gamma;
            res.eta = eta;

            res.Qh += Qh;
            res.Qc += Qc;
        }
    });

    // 연간 합계 계산
    const yearly = {
        heatingDemand: monthlyResults.reduce((acc, curr) => acc + curr.Qh, 0),
        coolingDemand: monthlyResults.reduce((acc, curr) => acc + curr.Qc, 0),
        totalArea: zones.reduce((acc, z) => acc + (z.isExcluded ? 0 : z.area), 0),
        specificHeatingDemand: 0,
        specificCoolingDemand: 0
    };

    if (yearly.totalArea > 0) {
        yearly.specificHeatingDemand = yearly.heatingDemand / yearly.totalArea;
        yearly.specificCoolingDemand = yearly.coolingDemand / yearly.totalArea;
    }

    return {
        monthly: monthlyResults,
        yearly
    };
}
