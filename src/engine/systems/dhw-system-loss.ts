/**
 * DIN/TS 18599-8 급탕 배관/저장 손실 공유 모듈
 *
 * 목적: dhw-calc.ts(시간별)와 calculator.ts(월별) 양쪽에서 동일 수식을 사용.
 * 규정 근거: DIN/TS 18599-8:2025-10
 *   - 저장 손실: 식(30) Q_s,p0 = 0.8 + 0.02 × V^0.77 [kWh/24h]
 *   - 배관 길이: 표 12 (주거/비주거 그룹별)
 *   - 배관 U_l: 표 10 (단열 수준별)
 */

// ──────────────────────────────────────────────
//  저장조 대기 손실
// ──────────────────────────────────────────────

/**
 * 저장조 일일 대기 손실 [Wh/d]
 * DIN/TS 18599-8 식(30): Q_s,p0 = (0.8 + 0.02 × V^0.77) × 1000
 * 기준 온도차 45K (θ_store=65°C, θ_amb=20°C)
 *
 * @param volume 저장조 체적 [L]
 * @returns 일일 대기 손실 [Wh/d] (기준 온도차 45K 조건)
 */
export function calcStandbyLoss_Wh_day(volume: number): number {
    if (volume <= 0) return 0;
    return (0.8 + 0.02 * Math.pow(volume, 0.77)) * 1000;
}

/**
 * 온도 보정된 저장조 시간당 손실 [Wh/h]
 *
 * @param volume 저장조 체적 [L]
 * @param theta_store 저장 온도 [°C]
 * @param theta_amb 주변 온도 [°C]
 * @returns 시간당 손실 [Wh/h]
 */
export function calcStandbyLoss_Wh_h(
    volume: number,
    theta_store: number = 60,
    theta_amb: number = 20
): number {
    const Q_sb_day = calcStandbyLoss_Wh_day(volume);
    const P_avg = Q_sb_day / 24; // [Wh/h] = [W]
    // 온도 보정: (θ_store − θ_amb) / 45K (기준 ΔT)
    const dT_actual = theta_store - theta_amb;
    const correction = Math.max(0, dT_actual / 45);
    return P_avg * correction;
}

// ──────────────────────────────────────────────
//  배관 길이 추정 (표 12)
// ──────────────────────────────────────────────

/**
 * 급탕 순환 배관 길이 추정 [m]
 * DIN/TS 18599-8 표 12 기반
 *
 * L_V (수평 분배관) + L_S (수직 입상관)
 *
 * @param area 존 면적 [m²]
 * @param isResidential 주거 여부
 * @returns 총 순환 배관 길이 [m]
 */
export function estimateDHWPipeLength(area: number, isResidential: boolean): number {
    let L_V: number, L_S: number;

    if (isResidential) {
        // 그룹 1 (주거) - 표 12
        L_V = 0.11 * Math.pow(area, 1.24);
        L_S = 0.05 * Math.pow(area, 0.97);
    } else {
        // 그룹 2 (비주거) - 표 12
        L_V = 5.4 * Math.pow(area, 0.49);
        L_S = 0.025 * Math.pow(area, 0.97);
    }

    return L_V + L_S;
}

// ──────────────────────────────────────────────
//  배관 선열손실계수 U_l (표 10)
// ──────────────────────────────────────────────

/** 단열 수준 */
export type DHWPipeInsulation = 'none' | 'basic' | 'good' | 'reinforced';

/**
 * 급탕 배관 선열손실계수 [W/(m·K)]
 * DIN/TS 18599-8 표 10 기반
 *
 * @param insulation 단열 수준
 * @returns U_l [W/(m·K)]
 */
export function getDHWPipeUl(insulation: DHWPipeInsulation): number {
    switch (insulation) {
        case 'none': return 0.255; // 미단열 / 기본값
        case 'basic': return 0.200; // 기본 단열
        case 'good': return 0.150; // 양호 단열
        case 'reinforced': return 0.100; // 강화 단열
    }
}

// ──────────────────────────────────────────────
//  저장조 체적 추정 (표 54)
// ──────────────────────────────────────────────

/**
 * 면적 기반 급탕 저장조 체적 추정 [L]
 * DIN/TS 18599-8 표 54 → 연속 함수 근사
 *
 * 50→78, 100→116, 200→192, 300→268L
 *
 * @param area 존 면적 [m²]
 * @returns 추정 체적 [L], 최소 30L
 */
export function estimateStorageVolume(area: number): number {
    return Math.max(30, 40 + 0.76 * area);
}

// ──────────────────────────────────────────────
//  월별 급탕 배관 손실 통합 계산
// ──────────────────────────────────────────────

/** 월별 급탕 배관/저장 손실 입력 */
export interface DHWSystemLossInput {
    /** 존 면적 [m²] */
    area: number;
    /** 주거 여부 */
    isResidential: boolean;
    /** 월간 사용일수 */
    daysUsage: number;
    /** 월간 총 일수 */
    daysInMonth: number;
    /** 급탕 유효 에너지 Q_w,b [Wh] (월간) */
    Q_w_b: number;
    /** 난방 실내 온도 [°C] */
    theta_i: number;
    /** 순환 배관 유무 */
    hasCirculation?: boolean;
    /** 타이머 제어 여부 */
    hasTimer?: boolean;
    /** 배관 단열 수준 */
    pipeInsulation?: DHWPipeInsulation;
    /** 배관 길이 (사용자 지정) [m] */
    pipeLength?: number;
    /** 저장조 체적 [L] (미지정 시 면적 기반 추정) */
    storageVolume?: number;
    /** 저장 온도 [°C] */
    storageTemp?: number;
}

/** 월별 급탕 배관/저장 손실 결과 */
export interface DHWSystemLossResult {
    /** 배관 손실 — 사용일 [Wh] */
    Q_w_d_op: number;
    /** 저장 손실 — 사용일 [Wh] */
    Q_w_s_op: number;
    /** 저장 손실 — 비사용일 [Wh] */
    Q_w_s_non_op: number;
    /** 총 내부 열획득 [Wh] */
    Q_I_w: number;
    /** 메타데이터 (검증용) */
    metadata: {
        L_w_d: number;        // 배관 길이 [m]
        U_l_w_d: number;      // 선열손실계수 [W/(m·K)]
        dT_pipe: number;      // 배관 온도차 [K]
        theta_w_av: number;   // 배관 평균 온도 [°C]
        V_storage: number;    // 저장조 체적 [L]
        q_w_s_day: number;    // 일일 저장 손실 [Wh/d]
        t_op_day: number;     // 일일 순환 시간 [h]
    };
}

/**
 * 월별 급탕 배관/저장 손실 통합 계산
 * DIN/TS 18599-8 표 10, 12, 식(30) 기반
 */
export function calculateDHWSystemLoss(input: DHWSystemLossInput): DHWSystemLossResult {
    const {
        area,
        isResidential,
        daysUsage,
        daysInMonth,
        theta_i,
        hasCirculation = true,
        hasTimer = false,
        pipeInsulation = 'none',
        pipeLength,
        storageVolume,
        storageTemp = 60,
    } = input;

    // ── 1. 배관 손실 ──
    const L_w_d = pipeLength ?? estimateDHWPipeLength(area, isResidential);
    const U_l_w_d = getDHWPipeUl(pipeInsulation);

    // 배관 평균 온도: 순환 시 60/55 평균 = 57.5°C
    const theta_w_av = 57.5;
    const dT_pipe = Math.max(0, theta_w_av - theta_i);

    // 운전 시간: 타이머 16h, 미적용 24h (표 11)
    const t_op_day = hasTimer ? 16 : 24;

    // 월간 배관 손실 (순환은 매일 발생)
    const Q_w_d_op = hasCirculation
        ? L_w_d * U_l_w_d * dT_pipe * (t_op_day * daysInMonth)
        : 0;

    // ── 2. 저장조 손실 (Gap 4: 온도 보정 적용) ──
    const V_s = storageVolume ?? estimateStorageVolume(area);
    const q_w_s_day_base = calcStandbyLoss_Wh_day(V_s);
    // 온도 보정: (θ_store − θ_amb) / 45K — 기준 ΔT=45K(65°C/20°C)
    const theta_amb = theta_i; // 실내 설치 가정
    const dT_storage = Math.max(0, storageTemp - theta_amb);
    const correctionFactor = dT_storage / 45;
    const q_w_s_day = q_w_s_day_base * correctionFactor;

    // 사용일/비사용일 모두 탱크 열손실 발생 (상시 온수 유지)
    const Q_w_s_op = q_w_s_day * daysUsage;
    const Q_w_s_non_op = q_w_s_day * (daysInMonth - daysUsage);

    // ── 3. 내부 열획득 (실내 위치 가정 시 100% 환입) ──
    const Q_I_w = Q_w_d_op + Q_w_s_op + Q_w_s_non_op;

    return {
        Q_w_d_op,
        Q_w_s_op,
        Q_w_s_non_op,
        Q_I_w,
        metadata: {
            L_w_d,
            U_l_w_d,
            dT_pipe,
            theta_w_av,
            V_storage: V_s,
            q_w_s_day,
            t_op_day,
        }
    };
}
