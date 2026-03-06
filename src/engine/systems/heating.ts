import { PEF_FACTORS, CO2_FACTORS } from "@/lib/standard-values";
import { HeatingSystem, EnergyCarrier } from "@/types/system";
import { SystemLossBreakdown } from "@/engine/types";
import { calculateBoilerGenerationLoss, type BoilerGenerationResult } from "./boiler-generation-loss";

export interface MonthlyHeatingSystemOutput {
    finalEnergy: number; // kWh
    primaryEnergy: number; // kWh
    co2Emissions: number; // kg
    auxiliaryEnergy: number; // kWh
    generationLoss: number; // kWh
    generationDetails: SystemLossBreakdown;
}

export function calculateMonthlyHeatingSystem(
    heatingSystem: HeatingSystem,
    Q_outg: number, // 열원기 요구출력 (배관/저장 손실 포함) kWh
    Te_mth: number, // 월평균 외기 온도
    hoursInMonth: number,
    theta_HK_av?: number // DIN/TS 18599-5 5.3절 평균 운전 온도 (°C) — Phase 2 보일러 K/L 보정용
): MonthlyHeatingSystemOutput {
    if (Q_outg <= 0) {
        return {
            finalEnergy: 0,
            primaryEnergy: 0,
            co2Emissions: 0,
            auxiliaryEnergy: 0,
            generationLoss: 0,
            generationDetails: {
                total: { hours: hoursInMonth, dT: 0, Q_loss: 0 },
                op: { hours: hoursInMonth, dT: 0, Q_loss: 0 },
                non_op: { hours: 0, dT: 0, Q_loss: 0 }
            }
        };
    }

    let current_eff = heatingSystem.generator.efficiency || 1.0;
    const isHeatPump = heatingSystem.generator.type === "heat_pump";
    const isEhp = heatingSystem.generator.type === "ehp" || heatingSystem.generator.type === "split";
    const isBoiler = heatingSystem.generator.type.includes("boiler");

    // 발전 손실 사전 계산 (보일러 전용)
    let boilerResult: BoilerGenerationResult | null = null;

    let beta = 0.3;
    if (heatingSystem.generator.capacity && heatingSystem.generator.capacity > 0) {
        beta = Q_outg / (heatingSystem.generator.capacity * hoursInMonth);
        beta = Math.max(0.01, Math.min(1.0, Math.abs(beta)));
    }

    if (isBoiler) {
        // [Phase 2-2/2-3] DIN/TS 18599-5 6.5절 보일러 발전 손실
        // 보일러 유형 매핑: condensing_boiler → condensing, std_boiler → standard
        const boilerType = heatingSystem.generator.type === "condensing_boiler"
            ? 'condensing_boiler' as const
            : 'standard_boiler' as const;

        const capacity = heatingSystem.generator.capacity || Q_outg / (hoursInMonth * 0.3);
        const avgDailyHours = hoursInMonth > 0 ? 24 : 0; // 월간 시간을 일 기준으로 환산
        const daysInMonth = hoursInMonth / 24;

        boilerResult = calculateBoilerGenerationLoss({
            boilerType,
            P_n: capacity,
            eta_k_Pn: heatingSystem.generator.efficiency,
            eta_k_Pint: heatingSystem.generator.partLoadValue,
            beta_gen: beta,
            theta_HK_av: theta_HK_av ?? 50, // Phase 1 산출값 우선, 없으면 기본 50°C
            theta_ambient: 20,
            t_h_rL_day: avgDailyHours,
            d_h_rB: daysInMonth,
        });

        // 보정된 실효 효율 사용
        current_eff = boilerResult.eta_effective;
        // 최소 효율 방어 (비정상적 입력값 대비)
        current_eff = Math.max(0.5, current_eff);

    } else if (isHeatPump || isEhp) {
        // 히트펌프 (DIN 18599-12 단순화 기준 적용)

        // 1. 설계 공급 온도 추정 (T_VA)
        let T_VA = 55;
        if (heatingSystem.distribution.temperatureRegime === '90/70') T_VA = 90;
        else if (heatingSystem.distribution.temperatureRegime === '70/50') T_VA = 70;
        else if (heatingSystem.distribution.temperatureRegime === '55/45') T_VA = 55;
        else if (heatingSystem.distribution.temperatureRegime === '35/28') T_VA = 35;

        // 2. 월간 작동 온도 추정 (부하율 기반 보정)
        const T_design = -12;
        let beta_approx = (20 - Te_mth) / (20 - T_design);
        beta_approx = Math.max(0, Math.min(1.0, beta_approx));

        // DIN 18599-12 수식 기반 (T_VL)
        const T_VL = (T_VA - 20) * Math.pow(beta_approx, 1 / 1.3) + 20;

        // 3. 온도 보정 계수 (Carnot 유사 선형 보정)
        const heatSource = heatingSystem.generator.heatSource || "outdoor_air";
        const ratingSource = (heatSource === "outdoor_air" || heatSource === "exhaust_air") ? 7 : 10;
        const ratingSupply = 35;

        const dSource = Te_mth - ratingSource;
        const dSupply = T_VL - ratingSupply;

        const f_dT = (1 + 0.025 * dSource) * (1 - 0.025 * dSupply);

        current_eff = heatingSystem.generator.efficiency * f_dT;
        current_eff = Math.max(1.0, current_eff);
    }

    // 최종 에너지 계산
    const finalEnergy = Q_outg / current_eff;
    const generationLoss = finalEnergy - Q_outg;

    // 연료원 및 산출 계수 연동
    const fuel = heatingSystem.generator.energyCarrier || "natural_gas";
    const pef = PEF_FACTORS[fuel as EnergyCarrier] || 1.1;
    const co2Factor = CO2_FACTORS[fuel as EnergyCarrier] || 0.2;

    const primaryEnergy = finalEnergy * pef;
    const co2Emissions = finalEnergy * co2Factor;

    // 보조 에너지 (순환 펌프 등) - 매우 간소한 추정치 (추후 확장을 위한 구조)
    const isAirSystem = ["ehp", "split"].includes(heatingSystem.generator.type);
    let auxiliaryEnergy = 0;
    if (!isAirSystem && Q_outg > 0) {
        // 수순환 펌프 전력 임의 추정(요구 열량의 약 1%)
        auxiliaryEnergy = finalEnergy * 0.01;
    }

    // 세부 내역 저장 (Loss breakdown 포맷)
    const generationDetails: SystemLossBreakdown = {
        total: { hours: hoursInMonth, dT: 0, Q_loss: generationLoss },
        op: { hours: hoursInMonth, dT: 0, Q_loss: generationLoss },
        non_op: { hours: 0, dT: 0, Q_loss: 0 }
    };

    return {
        finalEnergy,
        primaryEnergy,
        co2Emissions,
        auxiliaryEnergy,
        generationLoss,
        generationDetails
    };
}
