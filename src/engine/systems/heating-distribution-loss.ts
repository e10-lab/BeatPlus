/**
 * DIN/TS 18599-5:2025-10 6.3절 — 난방 배관 분배 손실 계산
 *
 * 식(52): Q_h,d = (1/1000) × U_l × (θ_HK,av − θ_l) × L × t_h,rL
 *
 * 배관 종류별(수평/수직/연결) 길이 추정, 표 27 기반 U_l 참조,
 * 가동/비가동 시간별 손실 분리, 실내 열획득 환입(Gutschrift) 처리
 */

import type { SystemLossBreakdown } from '@/engine/types';

// ─── 타입 정의 ───

/** 배관 단열 등급 */
export type PipeInsulationLevel = 'none' | 'basic' | 'good' | 'reinforced';

/** 배관 분배 손실 계산 입력 */
export interface DistributionLossInput {
    // 배관 물리 파라미터
    pipeLength?: number;               // 사용자 입력 배관 길이 (m), 없으면 자동 추정
    pipeInsulation: PipeInsulationLevel;

    // 건물 기하학 (배관 길이 추정용)
    buildingArea: number;              // A_NGF (m²)
    numFloors?: number;                // n_G (층수, 기본값 1)
    floorHeight?: number;              // h_G (층고 m, 기본값 3)
    buildingLength?: number;           // l_char (m, 없으면 sqrt(A/N)으로 추정)

    // 온도 조건
    theta_HK_av: number;               // 평균 운전 온도 (°C) — Phase 1에서 산출
    theta_ambient?: number;            // 배관 주변 온도 (°C, 기본값 20)

    // 시간 조건
    t_op: number;                      // 가동 시간 (h) — Phase 1 opConditions.time.t_op
    t_non_op: number;                  // 비가동 시간 (h)

    // 실내 배관 비율 (열획득 환입용)
    indoorPipeFraction?: number;       // 실내 구간 배관 비율 (0~1, 기본값 0.8)

    // 시공 연도 (U_l 결정용)
    constructionYear?: number;         // 기본값: 2000 (현행 기준)
}

/** 배관 분배 손실 계산 결과 */
export interface DistributionLossResult {
    Q_d_total: number;         // 총 배관 손실 (kWh)
    Q_d_op: number;            // 가동 시 손실 (kWh)
    Q_d_non_op: number;        // 비가동 시 손실 (kWh)
    Q_d_indoor_gain: number;   // 실내 환입 열획득 (kWh)
    Q_d_net: number;           // 순 손실 (= total - indoor_gain) (kWh)

    // 상세 파라미터 (검증용)
    L_pipe: number;            // 사용된 배관 길이 (m)
    U_l: number;               // 선열관류율 (W/(m·K))
    dT_op: number;             // 가동 시 온도차 (K)
    dT_non_op: number;         // 비가동 시 온도차 (K)

    // SystemLossBreakdown 호환 구조
    breakdown: SystemLossBreakdown;
}

// ─── 표 27: 선열관류율 U_l (W/(m·K)) ───

/**
 * DIN/TS 18599-5 표 27 기반 선열관류율
 *
 * 시공 연도 및 단열 등급별 U_l 값:
 * - 1995년 이후 단열: 0.200 ~ 0.255
 * - 1980~1995년 단열: 0.200 ~ 0.400
 * - 1980년 이전 단열: 0.400
 * - 비단열: 건물 면적에 따라 1.000 ~ 3.000
 */
function getLinearHeatTransferCoeff(
    insulation: PipeInsulationLevel,
    constructionYear: number,
    buildingArea: number
): number {
    if (insulation === 'none') {
        // 비단열 배관: 건물 면적에 따라 단계적 증가
        if (buildingArea <= 200) return 1.000;
        if (buildingArea <= 500) return 2.000;
        return 3.000;
    }

    if (insulation === 'reinforced') {
        // 강화 단열: 최신 기준 최적값
        return 0.200;
    }

    if (insulation === 'good') {
        // 양호 단열
        if (constructionYear >= 1995) return 0.200;
        if (constructionYear >= 1980) return 0.255;
        return 0.400;
    }

    // 'basic' 기본 단열
    if (constructionYear >= 1995) return 0.255;
    if (constructionYear >= 1980) return 0.400;
    return 0.400;
}

// ─── 배관 길이 추정 (표 26 / 식 60~61 간소화) ───

/**
 * DIN/TS 18599-5 식(60~61) 기반 배관 최대 길이 추정
 *
 * L_max = 2 × (L_char + B_char/2 + n_G × h_G + l_d)
 *
 * 여기서:
 * - L_char: 건물 특성 길이 ≈ √(A_NGF / n_G)
 * - B_char: 건물 특성 폭 ≈ L_char (정방형 가정)
 * - n_G: 층수
 * - h_G: 층고
 * - l_d: 연결 배관 할증 (2관식: 10m, 1관식: L+B)
 */
function estimatePipeLength(
    buildingArea: number,
    numFloors: number,
    floorHeight: number,
    buildingLength?: number
): number {
    // 건물 특성 치수 산출
    const areaPerFloor = buildingArea / numFloors;
    const l_char = buildingLength || Math.sqrt(areaPerFloor);
    const b_char = areaPerFloor / l_char; // A/N = L × B이므로 B = (A/N) / L

    // 연결 배관 할증 (2관식 기본값)
    const l_d = 10;

    // 식 60: L_max = 2 × (L_char + B_char/2 + n_G × h_G + l_d)
    const L_max = 2 * (l_char + b_char / 2 + numFloors * floorHeight + l_d);

    return Math.round(L_max * 10) / 10;
}

// ─── 핵심 계산 함수 ───

/**
 * 난방 배관 분배 손실 계산 — DIN/TS 18599-5 식(52)
 *
 * Q_h,d = (1/1000) × U_l × (θ_HK,av − θ_l) × L × t_h,rL [kWh]
 *
 * 배관 손실은 가동 시간 동안에만 발생 (비가동 시 배관 냉각은 별도 미산정)
 * 실내 구간 배관의 손실은 내부 열획득으로 환입(Gutschrift)
 */
export function calculateDistributionLoss(input: DistributionLossInput): DistributionLossResult {
    const {
        pipeInsulation,
        buildingArea,
        numFloors = 1,
        floorHeight = 3,
        buildingLength,
        theta_HK_av,
        theta_ambient = 20,
        t_op,
        t_non_op,
        indoorPipeFraction = 0.8,
        constructionYear = 2000,
    } = input;

    // 1. 배관 길이 결정
    const L_pipe = input.pipeLength || estimatePipeLength(
        buildingArea, numFloors, floorHeight, buildingLength
    );

    // 2. 선열관류율 (표 27)
    const U_l = getLinearHeatTransferCoeff(pipeInsulation, constructionYear, buildingArea);

    // 3. 가동 시 온도차
    const dT_op = Math.max(0, theta_HK_av - theta_ambient);

    // 4. 비가동 시 온도차
    // DIN/TS 18599-5 6.3절: 비가동 시 배관 손실은 별도 수식 없음
    // 다만 야간 절하 등으로 낮은 온도에서 순환하는 경우를 반영
    // 비가동 시 배관 온도를 주변 온도로 수렴한다고 가정 → ΔT ≈ 0
    const dT_non_op = 0;

    // 5. 배관 손실 산출 — 식(52)
    // Q_h,d = (1/1000) × U × ΔT × L × t [kWh]
    const Q_d_op = (1 / 1000) * U_l * dT_op * L_pipe * t_op;
    const Q_d_non_op = (1 / 1000) * U_l * dT_non_op * L_pipe * t_non_op;
    const Q_d_total = Q_d_op + Q_d_non_op;

    // 6. 실내 열획득 환입 (Gutschrift)
    // 난방 구역 내부 배관의 손실은 100% 환입
    const Q_d_indoor_gain = Q_d_total * indoorPipeFraction;
    const Q_d_net = Q_d_total - Q_d_indoor_gain;

    // 7. SystemLossBreakdown 구조 생성 (검증 UI 호환)
    const breakdown: SystemLossBreakdown = {
        L: L_pipe,
        U: U_l,
        total: {
            hours: t_op + t_non_op,
            dT: dT_op,
            Q_loss: Q_d_total,
        },
        op: {
            hours: t_op,
            dT: dT_op,
            Q_loss: Q_d_op,
        },
        non_op: {
            hours: t_non_op,
            dT: dT_non_op,
            Q_loss: Q_d_non_op,
        },
    };

    return {
        Q_d_total,
        Q_d_op,
        Q_d_non_op,
        Q_d_indoor_gain,
        Q_d_net,
        L_pipe,
        U_l,
        dT_op,
        dT_non_op,
        breakdown,
    };
}
