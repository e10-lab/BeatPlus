import { ZoneInput } from "./types";
import { UsageProfile } from "@/lib/din-18599-profiles";
import { LightingSystem } from "@/types/system";

/**
 * 조명 계산 모듈 (DIN/TS 18599:2025-10 시간별 간이법 적용)
 */

// 태양 복사 에너지의 발광 효율 (Luminous Efficacy, lm/W)
// 표준 하늘 모델 등을 기반으로 한 근사값
// 직달(Direct): ~90-100 lm/W, 확산(Diffuse): ~110-120 lm/W
const EFFICACY_SOLAR_DIRECT = 95;
const EFFICACY_SOLAR_DIFFUSE = 115;

/**
 * 주광의 이용 가능성, 제어 전략 및 대기전력을 고려하여 시간당 조명 에너지 수요를 계산합니다.
 * 
 * @param zone 존 속성 (면적, 크기, 창호 정보 등)
 * @param I_beam 직달 일사량 [W/m²]
 * @param I_diff 확산 일사량 [W/m²]
 * @param sunElevation 태양 고도 [도]
 * @param profile 재실/사용 프로필 (요구 조도 등)
 * @param lightingSystem 연결된 조명 시스템 정보 (선택사항)
 * @returns { powerLighting: 에너지 소비량, heatGainLighting: 열 획득량 } [W]
 */
export function calculateLightingDemand(
    zone: ZoneInput,
    I_beam: number,
    I_diff: number,
    sunElevation: number,
    profile: UsageProfile,
    lightingSystem?: LightingSystem
): { powerLighting: number, heatGainLighting: number } {
    const Area = zone.area;

    // 1. 요구 조도 (Em)
    const E_m = profile.illuminance; // [lux]

    // 2. 조명 설치 밀도(Installed Power Density) 계산
    // 우선순위: 조명 시스템 설정 -> 존 개별 설정 -> 프로필 기반 추정
    const efficacy = lightingSystem?.lightingEfficacy || zone.lighting?.efficacy || 60;

    // 조명 설치 밀도 [W/m²]
    let p_j = 0;
    if (zone.lighting?.powerDensity !== undefined) {
        p_j = zone.lighting.powerDensity;
    } else {
        // 조도를 통한 추정: p_j = E_m / (광효율 * 보수율 * 이용률)
        // DIN/TS 18599:2025-10의 간략화된 접근 방식 사용
        const k_L = profile.illuminanceDepreciationFactor || 0.8;
        const rho = 0.6; // 일반적인 이용률 (실지수 등에 따라 변동)
        p_j = E_m / (efficacy * k_L * rho);
    }
    const P_installed = p_j * Area;

    // 3. 운전 계수 (DIN/TS 18599:2025-10 반영)

    // 3.1 정조도 제어 계수 (Constant Illuminance Factor, F_C)
    // 정조도 제어가 적용되는 경우, 램프가 신품일 때 출력을 낮추어 일정 조도를 유지함
    let F_C = 1.0;
    if (lightingSystem?.hasConstantIlluminanceControl || lightingSystem?.controlType === "constant") {
        const k_L = profile.illuminanceDepreciationFactor || 0.8;
        F_C = (1 + k_L) / 2;
    }

    // 3.2 재실 제어 계수 (Presence Factor, F_A)
    // 재실 센서나 비우 시 수동 소등 등에 따른 감소 반영
    // DIN 18599-10에서는 'lightingAbsenceFactor'가 절감 잠재력을 나타냄
    let F_A = 1.0;
    const controlType = lightingSystem?.controlType || "manual";
    if (controlType === "occupancy" || controlType === "dual") {
        const k_A = profile.lightingAbsenceFactor || 0;
        F_A = 1.0 - k_A;
        if (F_A < 0) F_A = 0;
    }

    // 3.3 부분 매일 운전 계수 (Partial Operation Factor, F_Te)
    // 재실 중이라도 조명이 항상 100% 켜져 있지는 않은 상황을 고려한 계수
    const F_Te = profile.partialOperationFactorLighting ?? 1.0;

    // 4. 주광 이용 가능 조도 계산
    const sinAlpha = Math.sin(Math.max(0, sunElevation) * Math.PI / 180);
    const I_dir_horiz = I_beam * sinAlpha;
    const E_ext_horiz = I_dir_horiz * EFFICACY_SOLAR_DIRECT + I_diff * EFFICACY_SOLAR_DIFFUSE; // [lux]

    let daylightFactor = 0;
    let windowArea = 0;
    zone.surfaces.forEach(s => {
        if (s.type === 'window') windowArea += s.area;
    });

    if (windowArea > 0 && Area > 0) {
        // 주광률(DF) 간략 추정
        daylightFactor = (windowArea / Area) * 0.1;
    }
    const E_day = E_ext_horiz * daylightFactor;

    // 5. 주광 연동 제어 계수 (Daylight Control Factor, F_D)
    let F_D = 1.0;
    const canUseDaylight = (controlType === "daylight" || controlType === "dual") && E_day > 0;

    if (canUseDaylight) {
        if (E_day >= E_m) {
            F_D = 0.0; // 주광만으로 충분한 경우 조명 소등
        } else {
            F_D = (E_m - E_day) / E_m; // 필요분만 출력
        }
    }

    // 6. 시간당 조명 소비 전력 [W]
    // P_h = P_installed * F_C * F_D * F_A * F_Te
    let P_lighting_h = P_installed * F_C * F_D * F_A * F_Te;

    // 7. 대기 전력 / 보조 전력 [W]
    if (lightingSystem?.parasiticPowerDensity) {
        P_lighting_h += lightingSystem.parasiticPowerDensity * Area;
    } else if (controlType !== "manual") {
        // 자동 제어 시 표준 대기 전력 반영 (~0.1 W/m²)
        P_lighting_h += 0.1 * Area;
    }

    // 열 획득량 [W]
    const heatGain = P_lighting_h;

    return {
        powerLighting: P_lighting_h,
        heatGainLighting: heatGain
    };
}
