import { UsageProfile } from "@/lib/din-18599-profiles";
import { ZoneInput } from "./types";
import { DHWSystem } from "@/types/system";

/**
 * 급탕 에너지 부하 계산 (DIN/TS 18599-8:2025-10)
 * 저장 손실(Q_W,s) 및 배관 손실(Q_W,d)을 포함합니다.
 */

interface DHWResult {
    energyDHW: number; // [Wh] 총 에너지 요구량 (유효 수요 + 손실) -> Q_W,gen,out
    heatGainDHW: number; // [Wh] 손실에 의한 내부 발열량 -> Q_W,int
    usefulEnergy: number; // [Wh] 수도꼭지에서의 유효 수요량 -> Q_W,b
}

export function calculateHourlyDHW(
    zone: ZoneInput,
    profile: UsageProfile,
    hourOfDay: number, // 0-23
    isOccupied: boolean,
    dhwSystem?: DHWSystem,
    ambientTemp: number = 20, // 저장탱크/배관 주변 온도 (기본값 20C)
): DHWResult {

    // --- 1. 유효 에너지 수요 (Useful Energy Demand, Q_W,b) ---
    // Q_W,b,d = q_w,b,spec * A_NGF
    const dhwDemandSpecific = profile.dhwDemand || 0; // 단위 면적당 일일 수요량 Wh/(m²·d)
    const dailyDemand = dhwDemandSpecific * zone.area; // [Wh/d] 총 일일 수요량

    if (dailyDemand <= 0) {
        return { energyDHW: 0, heatGainDHW: 0, usefulEnergy: 0 };
    }

    // 시간별 배분 로직
    let hourlyFraction = 0;
    if (isOccupied) {
        let usageDuration = 0;
        if (profile.usageHoursEnd > profile.usageHoursStart) {
            usageDuration = profile.usageHoursEnd - profile.usageHoursStart;
        } else {
            usageDuration = (24 - profile.usageHoursStart) + profile.usageHoursEnd;
        }

        if (usageDuration > 0) {
            hourlyFraction = 1 / usageDuration;
        } else {
            // 재실 중이지만 사용 시간이 정의되지 않은 경우 24시간 균등 배분
            hourlyFraction = 1 / 24;
        }
    } else {
        hourlyFraction = 0;
        // 비재실 시 요구량은 0으로 가정 (청소 등 미미한 부하 제외)
    }

    const usefulEnergy = dailyDemand * hourlyFraction; // [Wh] 현재 시간의 유효 에너지

    // --- 2. 시스템 손실 (System Losses) ---

    // 급탕 시스템이 정의되지 않은 경우 이상적인 시스템으로 가정하되,
    // 실내로 방출되는 일반적인 배관 손실 열량(20%)만 반영
    if (!dhwSystem) {
        const heatGainDHW = usefulEnergy * 0.2;
        return {
            energyDHW: usefulEnergy,
            heatGainDHW,
            usefulEnergy
        };
    }

    // A. 저장 손실 (Storage Losses, Q_W,s)
    let storageLoss = 0;
    let gainsFromStorage = 0;

    if (dhwSystem.storage) {
        const { volume, temperature = 60, location = "conditioned" } = dhwSystem.storage;

        // 대기 열손실 (P_loss_avg_W) 계산
        // DIN 18599-8 기준 현대식 탱크의 표준 대기 손실 공식 사용
        const Q_standby_24h_kWh = 0.3 + 0.045 * Math.pow(volume, 0.6); // kWh/24h
        const P_loss_avg_W = (Q_standby_24h_kWh * 1000) / 24;

        // 실제 온도 차이에 따른 보정
        // 테스트 조건: T_store=65, T_amb=20 -> dT=45
        const dT_actual = temperature - ambientTemp;
        const dT_test = 45;

        const correctionFactor = Math.max(0, dT_actual / dT_test);

        storageLoss = P_loss_avg_W * correctionFactor; // 시간당 손실 [Wh]

        // 실내 설치 시 내부 발열로 산입
        if (location === "conditioned") {
            gainsFromStorage = storageLoss;
        }
    }

    // B. 배관 손실 (Distribution Losses, Q_W,d)

    // 1. 순환 루프 손실 (Circulation Loop, Q_W,d,c)
    let circulationLoss = 0;
    const { hasCirculation, pipeInsulation, pipeLength } = dhwSystem.distribution;

    if (hasCirculation) {
        // 단열 등급에 따른 선열손실계수 [W/mK]
        let psi_circ = 0.20;
        switch (pipeInsulation) {
            case "basic": psi_circ = 0.15; break;
            case "good": psi_circ = 0.10; break;
            case "reinforced": psi_circ = 0.05; break;
        }

        // 루프 배관 길이 추정 (제공된 값이 없으면 존 면적으로부터 근사)
        const L_circ = pipeLength || (10 + 2 * Math.sqrt(zone.area));

        const T_mean = (dhwSystem.storage?.temperature || 60) - 5; // 평균 배관 온도
        const deltaT_circ = T_mean - ambientTemp;

        circulationLoss = L_circ * psi_circ * Math.max(0, deltaT_circ); // 1시간 손실량
    }

    // 2. 개별 지관 손실 (Individual Lines, Q_W,d,i)
    // 인출 시 배관 내 정체수의 냉각으로 인한 손실 (유효 에너지의 %로 산출)
    const k_ind = 0.15; // 15% 손실 가정
    const individualLoss = usefulEnergy * k_ind;


    const distributionLossTotal = circulationLoss + individualLoss;

    // 배관 발열의 80%가 실내(냉난방 구역)로 전달된다고 가정
    const gainsFromDistribution = distributionLossTotal * 0.8;

    // --- 3. 종합 결과 (Total Results) ---

    // 열원기 출력량 = 유효 수요 + 저장 손손실 + 배관 손손실
    const energyDHW = usefulEnergy + storageLoss + distributionLossTotal;

    // 내부 발열량 = 저장 탱크 발열 + 배관 발열
    const heatGainDHW = gainsFromStorage + gainsFromDistribution;

    return {
        energyDHW,
        heatGainDHW,
        usefulEnergy
    };
}
