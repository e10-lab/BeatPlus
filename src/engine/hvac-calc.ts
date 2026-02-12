import { HeatingSystem, CoolingSystem, EnergyCarrier, HeatSource } from "@/types/system";
import { HourlyResult } from "./types";

/**
 * HVAC 시스템 계산 (DIN/TS 18599-5:2025-10 및 7 상세 구현)
 * 순 에너지 수요(Q_h, Q_c)를 최종 에너지(Q_f) 및 1차 에너지(Q_p)로 변환합니다.
 * 부분 부하 효율 및 온도 의존성을 고려한 시간별 계산을 수행합니다.
 */

import { PEF_FACTORS, CO2_FACTORS } from "@/lib/standard-values";

export interface HvacResult {
    finalEnergyHeating: number; // 최종 난방 에너지
    finalEnergyCooling: number; // 최종 냉방 에너지
    primaryEnergyHeating: number; // 1차 난방 에너지
    primaryEnergyCooling: number; // 1차 냉방 에너지
    auxiliaryEnergyHeating: number; // 난방 보조 에너지 (펌프 등) [kWh]
    auxiliaryEnergyCooling: number; // 냉방 보조 에너지 (펌프 등) [kWh]
    co2Heating: number; // 난방 탄소 배출량
    co2Cooling: number; // 냉방 탄소 배출량
    systemLossesHeating: number; // 난방 시스템 손실
    systemLossesCooling: number; // 냉방 시스템 손실
}

// --- 헬퍼: 보일러 효율 곡선 ---
function calculateBoilerEfficiency(
    type: "condensing_boiler" | "std_boiler" | "heat_pump" | "electric" | "district",
    nominalEff: number,
    loadRatio: number
): number {
    // 부하 비(beta)를 0.01에서 1.0 사이로 유지
    const beta = Math.max(0.01, Math.min(1.0, loadRatio));

    if (type === "condensing_boiler") {
        // 콘덴싱 보일러는 부분 부하에서 효율이 상승함 (일정 지점까지)
        // 30% 부하 시 효율 약 4% 상승, 100% 부하 시 정격 효율 수준
        if (beta > 0.3) {
            // 30%와 100% 부하 사이 선형 보간
            return (nominalEff + 0.04) + (nominalEff - (nominalEff + 0.04)) * ((beta - 0.3) / 0.7);
        } else {
            return nominalEff + 0.04;
        }
    } else if (type === "std_boiler") {
        // 일반 보일러는 대기 손실 등으로 인해 낮은 부하에서 효율이 감소함
        if (beta < 1.0) {
            // 선형적인 효율 저하 모델링
            return nominalEff - (0.05 * (1 - beta));
        }
        return nominalEff;
    }

    return nominalEff; // 전기 및 지역난방은 고정 효율 가정
}

// --- 헬퍼: 히트펌프 COP 곡선 ---
function calculateHeatPumpCOP(
    type: string,
    nominalCOP: number,
    sourceTemp: number, // 공기 열원의 경우 외기 온도
    supplyTemp: number, // 공급 온도 (온수 온도)
    heatSource?: HeatSource
): number {
    // 카르노 효율 기반 모델 (Carnot Efficiency Model)
    let T_sink_K = supplyTemp + 273.15;
    let T_source_K = sourceTemp + 273.15;

    // 최소 온도차(5K) 보장
    if (T_sink_K - T_source_K < 5) T_source_K = T_sink_K - 5;

    const cop_carnot = T_sink_K / (T_sink_K - T_source_K);

    // 기기별 보전 계수 (Guetegrad) 설정
    // 공기 대 물(Air-to-Water): ~0.45, 지열(Brine-Water): ~0.50
    let eta_carnot = 0.45;
    if (heatSource?.includes('ground') || heatSource === 'surface_water') eta_carnot = 0.50;

    // 간략화된 선형 모델 사용 (온도차 1도당 효율 변동률 적용)
    // 기준점: 외기 7C, 공급 35C
    const ratingSource = 7;
    const ratingSupply = 35;

    const dSource = sourceTemp - ratingSource;
    const dSupply = supplyTemp - ratingSupply;

    // 열원 온도가 올라가면 COP 상승 (K당 약 2.5%), 공급 온도가 올라가면 COP 하락 (K당 약 2.5%)
    let cop = nominalCOP * (1 + 0.025 * dSource) * (1 - 0.025 * dSupply);

    return Math.max(1.0, cop);
}

// --- 헬퍼: EHP (VRF) COP 곡선 ---
function calculateEhpCOP(
    nominalCOP: number,
    outdoorTemp: number,
    loadRatio: number
): number {
    // 공기 대 공기(Air-to-Air) 방식의 EHP/VRF
    // 인버터 제어와 외기 온도에 크게 의존함

    // 1. 온도 보정 (기준 원도 7C)
    const dT = outdoorTemp - 7;
    const factor_temp = 1.0 + 0.02 * dT;

    // 2. 부분 부하(PLR) 보정 (인버터 특성)
    // 일반적으로 40~60% 부하에서 최대 효율 발생
    const beta = Math.max(0.1, loadRatio);
    let factor_plr = 1.0;
    if (beta >= 1.0) factor_plr = 1.0;
    else if (beta >= 0.5) factor_plr = 1.0 + 0.5 * (1.0 - beta);
    else factor_plr = 1.25 - 0.5 * (0.5 - beta);

    return nominalCOP * factor_temp * factor_plr;
}

// --- 헬퍼: 냉동기 EER 곡선 ---
function calculateChillerEER(
    type: string,
    nominalEER: number,
    outdoorTemp: number,
    loadRatio: number
): number {
    // 1. 온도 의존성 (기준 온도 35C)
    const dTemp = 35 - outdoorTemp;
    // 외기 온도가 낮아지면 EER 상승 (K당 약 3%)
    let eer_temp = nominalEER * (1 + 0.03 * dTemp);

    // 2. 부분 부하 보정 (인버터 형식 가정)
    const beta = Math.max(0.1, loadRatio);

    let plv = 1.0;
    if (beta >= 0.75) plv = 1.0 + 0.4 * (1 - beta);
    else if (beta >= 0.50) plv = 1.1 + 0.4 * (0.75 - beta);
    else plv = 1.2 - 0.4 * (0.50 - beta);

    return eer_temp * plv;
}

export function calculateHourlyHvac(
    hourlyResults: HourlyResult[],
    heatingSystem?: HeatingSystem,
    coolingSystem?: CoolingSystem
): HvacResult {

    let sum_fe_h = 0;
    let sum_fe_c = 0;
    let sum_aux_h = 0; // 난방 보조 에너지 (순환 펌프 등)
    let sum_aux_c = 0; // 냉방 보조 에너지

    // 난방 시스템 설정에 따른 분배 및 공급 온도 파라미터 사전 정의
    let eth_dist_h = 0.93;
    let supplyTempCurveMax = 70;
    let supplyTempCurveMin = 70;

    if (heatingSystem) {
        if (heatingSystem.distribution.temperatureRegime === "55/45") {
            eth_dist_h = 0.96;
            supplyTempCurveMax = 55;
            supplyTempCurveMin = 45;
        } else if (heatingSystem.distribution.temperatureRegime === "35/28") {
            eth_dist_h = 0.98;
            supplyTempCurveMax = 35;
            supplyTempCurveMin = 28;
        } else if (heatingSystem.distribution.temperatureRegime === "90/70") {
            eth_dist_h = 0.93;
            supplyTempCurveMax = 80;
            supplyTempCurveMin = 60;
        }
    }

    // 방열 방식에 따른 효율
    let eth_em_h = 0.93; // 일반 라디에이터
    if (heatingSystem?.emission.type === "floor_heating") eth_em_h = 0.97; // 바닥 난방
    if (heatingSystem?.emission.type === "air_heating") eth_em_h = 0.90; // 공기 가열

    // 냉방 시스템 설정
    let eth_dist_c = 0.95;
    if (coolingSystem?.distribution.type === "air") eth_dist_c = 0.90;

    // 시간당 반복 계산
    for (const hr of hourlyResults) {
        const Q_h = hr.Q_heating;
        const Q_c = hr.Q_cooling;
        const Te = hr.Te;

        // --- 난방 계산 ---
        if (Q_h > 0) {
            // EHP/VRF 등 공조 방식은 수순환 펌프를 사용하지 않음
            const isAirSystem = heatingSystem && ["ehp", "split"].includes(heatingSystem.generator.type);

            if (!isAirSystem) {
                // 수순환 폄프 전력 추정 (기본값: dT=15K, dp=35kPa, 효율=0.4)
                const dT_h = 15;
                const Q_w = Q_h;
                const V_dot = Q_w / (1.16 * 1000 * dT_h);
                const P_pump_hyd = (V_dot * 35) / (3.6 * 0.4);
                const f_pump = 0.5; // 평균 부분 부하 계수 반영
                sum_aux_h += P_pump_hyd * f_pump;
            }

            if (!heatingSystem) {
                // 시스템이 없을 경우 레퍼런스 효율(0.81) 적용
                sum_fe_h += Q_h / 0.81;
            } else {
                // 분배 및 방열 손실 반영한 요구 열원 출력계산
                const Q_gen_out = Q_h / (eth_dist_h * eth_em_h);

                // 현재 외기 기반 부분 부하 비(Beta) 추정
                const dT_design = 32; // 설계 조건 온도차 (-12C ~ 20C)
                const dT_curr = Math.max(0, 20 - Te);
                let beta = Math.min(1.0, dT_curr / dT_design);

                let eff_gen = heatingSystem.generator.efficiency;

                // 열원 형식별 시간당 효율 보정
                if (heatingSystem.generator.type.includes("boiler")) {
                    eff_gen = calculateBoilerEfficiency(heatingSystem.generator.type as any, heatingSystem.generator.efficiency, beta);
                } else if (heatingSystem.generator.type === "heat_pump") {
                    // 외기 연동 공급 온도(주행 곡선) 계산
                    const T_design_out = -12;
                    const T_limit = 15;
                    let t_set = supplyTempCurveMin + (supplyTempCurveMax - supplyTempCurveMin) * ((T_limit - Te) / (T_limit - T_design_out));
                    t_set = Math.max(supplyTempCurveMin, Math.min(supplyTempCurveMax, t_set));

                    eff_gen = calculateHeatPumpCOP(heatingSystem.generator.type, heatingSystem.generator.efficiency, Te, t_set, heatingSystem.generator.heatSource);
                } else if (heatingSystem.generator.type === "ehp" || heatingSystem.generator.type === "split") {
                    eff_gen = calculateEhpCOP(heatingSystem.generator.efficiency, Te, beta);
                }

                sum_fe_h += Q_gen_out / eff_gen;

                // 팬 보조 전력 계산 (팬코일 또는 공기 가열 방식)
                const isEHP = heatingSystem.generator.type === "ehp" || heatingSystem.generator.type === "split";

                if (isEHP || ["fan_coil", "air_heating"].includes(heatingSystem.emission.type)) {
                    let P_fan = 0;
                    if (heatingSystem.emission.fanPower) {
                        P_fan = heatingSystem.emission.fanPower;
                    } else {
                        // 기본값으로 요구 출력의 2.5% 수준 가정
                        P_fan = 0.025 * Q_gen_out;
                    }

                    const f_fan = 0.5 + 0.5 * beta;
                    sum_aux_h += P_fan * f_fan;
                }
            }
        }

        // --- 냉방 계산 ---
        if (Q_c > 0) {
            // 수순환 펌프 (냉방용)
            const isAirSystemC = coolingSystem && ["ehp", "split"].includes(coolingSystem.generator.type);

            if (!isAirSystemC) {
                const dT_c = 6;
                const Q_c_w = Q_c;
                const V_dot_c = Q_c_w / (1.16 * 1000 * dT_c);
                const P_pump_c = (V_dot_c * 45) / (3.6 * 0.45);
                const f_pump_c = 0.5;
                sum_aux_c += P_pump_c * f_pump_c;
            }

            if (!coolingSystem) {
                // 레퍼런스 냉동기 효율 가정
                sum_fe_c += Q_c / (3.0 * 0.95);
            } else {
                const Q_gen_out = Q_c / eth_dist_c;

                // 냉방 설계 조건(외기 35C, 실내 26C) 기반 부하비 추정
                const dT_design_c = 9;
                const dT_curr_c = Math.max(0, Te - 26);
                const beta = Math.min(1.0, dT_curr_c / dT_design_c);

                let eer = calculateChillerEER(
                    coolingSystem.generator.type,
                    coolingSystem.generator.efficiency,
                    Te,
                    beta
                );

                sum_fe_c += Q_gen_out / eer;

                // 단말기 팬 보조 전력 (냉방)
                const isEHPC = coolingSystem.generator.type === "ehp" || coolingSystem.generator.type === "split";

                if (isEHPC || ["fan_coil", "air"].includes(coolingSystem.emission.type)) {
                    let P_fan_c = 0;
                    if (coolingSystem.emission.fanPower) {
                        P_fan_c = coolingSystem.emission.fanPower;
                    } else {
                        P_fan_c = 0.03 * Q_gen_out;
                    }

                    const f_fan_c = 0.5 + 0.5 * beta;
                    sum_aux_c += P_fan_c * f_fan_c;
                }

                // 수냉식 냉각탑 및 냉각수 펌프 계산
                if (coolingSystem.generator.condenserType === "water_cooled") {
                    // 응축기 열부하 = 냉방 부하 + 압축기 일
                    const P_comp = Q_gen_out / eer;
                    const Q_reject = Q_gen_out + P_comp;

                    // 냉각수 펌프 전력 (dT 5K 가정)
                    const dT_cw = 5;
                    const V_dot_cw = Q_reject / (1.16 * 1000 * dT_cw);
                    const dp_cw = 50;
                    const eta_cw = 0.45;
                    const P_pump_cw = (V_dot_cw * dp_cw) / (3.6 * eta_cw);

                    const f_cw = 0.2 + 0.8 * beta;
                    sum_aux_c += P_pump_cw * f_cw;

                    // 냉각탑 팬 전력 (부하의 3제곱 비례하는 풍량 제어 가정)
                    const spec_fan_power = 0.04;
                    const P_fan_max = (Q_reject / 1000) * spec_fan_power * 1000;
                    const f_fan_curve = Math.max(0.05, Math.pow(beta, 3));

                    sum_aux_c += P_fan_max * f_fan_curve;
                }
            }
        }
    }

    // 결과 집계 (연간 값 단위 변환: Wh -> kWh)
    const fuel_h = heatingSystem?.generator.energyCarrier || 'natural_gas';
    const fuel_c = coolingSystem?.generator.energyCarrier || 'electricity';

    const fe_h_kWh = sum_fe_h / 1000;
    const fe_c_kWh = sum_fe_c / 1000;

    const net_h_kWh = hourlyResults.reduce((s, h) => s + h.Q_heating, 0) / 1000;
    const net_c_kWh = hourlyResults.reduce((s, h) => s + h.Q_cooling, 0) / 1000;

    const aux_h_kWh = sum_aux_h / 1000;
    const aux_c_kWh = sum_aux_c / 1000;

    return {
        finalEnergyHeating: fe_h_kWh,
        finalEnergyCooling: fe_c_kWh,
        auxiliaryEnergyHeating: aux_h_kWh,
        auxiliaryEnergyCooling: aux_c_kWh,
        // 각 용도별 1차 에너지 계산 (가중치 계수 적용)
        primaryEnergyHeating: fe_h_kWh * PEF_FACTORS[fuel_h],
        primaryEnergyCooling: fe_c_kWh * PEF_FACTORS[fuel_c],

        // 이산화탄소 배출량 계산
        co2Heating: fe_h_kWh * CO2_FACTORS[fuel_h],
        co2Cooling: fe_c_kWh * CO2_FACTORS[fuel_c],

        // 시스템 손실 (공급과 수요의 차이)
        systemLossesHeating: fe_h_kWh - net_h_kWh,
        systemLossesCooling: fe_c_kWh - net_c_kWh
    };
}
