/**
 * DIN/TS 18599-5:2025-10 5장 — 난방 시스템 운전 조건 산출
 *
 * 부하율(β)에 연동된 실제 운전 온도와 운전 시간을 계산합니다.
 * 이 모듈은 이후 배관 분배 손실(6.3절), 저장 손실(6.4절),
 * 발전 효율 보정(6.5절)의 필수 입력값을 제공합니다.
 */

// ─── 타입 정의 ───

/** 온도제식 (설계 공급/환수 온도) */
export type TemperatureRegime = '90/70' | '70/50' | '55/45' | '35/28';

/** 방열기의 온도 지수 n (DIN/TS 18599-5 5.3절) */
export type EmissionType = 'radiator' | 'floor_heating' | 'fcu' | 'supply_air';

/** 난방 시스템 운전 모드 */
export type OperatingMode = 'continuous' | 'daytime_only' | 'night_setback' | 'weekend_shutdown';

/** 운전 온도 계산 결과 */
export interface OperatingTemperatureResult {
    theta_VL: number;     // 월간 평균 공급 온도 (°C)
    theta_RL: number;     // 월간 평균 환수 온도 (°C)
    theta_HK_av: number;  // 평균 운전(난방매체) 온도 (°C)
}

/** 운전 시간 계산 결과 */
export interface OperatingTimeResult {
    t_h_rL: number;       // 월간 총 난방 가동 시간 (h)
    t_op: number;         // 사용일 가동 시간 (h)
    t_non_op: number;     // 비사용일 가동 시간 (h)
}

// ─── 온도제식별 설계 온도 ───

/** 온도제식별 설계 공급/환수 온도 (°C) */
const DESIGN_TEMPS: Record<TemperatureRegime, { VL: number; RL: number }> = {
    '90/70': { VL: 90, RL: 70 },
    '70/50': { VL: 70, RL: 50 },
    '55/45': { VL: 55, RL: 45 },
    '35/28': { VL: 35, RL: 28 },
};

/** 방열기 타입별 온도 지수 n (DIN/TS 18599-5 5.3절) */
const EMISSION_EXPONENT: Record<EmissionType, number> = {
    radiator: 1.3,       // 라디에이터 (대류+복사)
    floor_heating: 1.1,  // 바닥 난방 (대부분 복사)
    fcu: 1.3,           // 팬코일 (강제 대류)
    supply_air: 1.0,    // 공기 가열 (직접 공급)
};

// ─── 핵심 계산 함수 ───

/**
 * 1. 부하율(β) 산출 — DIN/TS 18599-5 식(8)
 *
 * β_h,ce = Q_h,b / (Φ_h,max × t_h,rL)
 *
 * @param Q_h_b - 월간 난방 요구량 (kWh)
 * @param Phi_h_max - 최대 난방 용량 (kW)
 * @param t_h_rL - 월간 난방 가동 시간 (h)
 * @returns 방열 부하율 β (0.01 ~ 1.0 클램핑)
 */
export function calculateHeatingLoadRatio(
    Q_h_b: number,
    Phi_h_max: number,
    t_h_rL: number
): number {
    if (Phi_h_max <= 0 || t_h_rL <= 0 || Q_h_b <= 0) return 0;

    const beta = Q_h_b / (Phi_h_max * t_h_rL);
    return Math.max(0.01, Math.min(1.0, beta));
}

/**
 * 2. 운전 온도(θ_HK,av) 산출 — DIN/TS 18599-5 5.3절
 *
 * 부하율(β)에 따라 실제로 배관을 흐르는 평균 온도를 산출합니다.
 * 설계 조건에서는 공급/환수 온도가 최대이지만, 부하율이 낮아지면
 * 온도가 함께 낮아집니다.
 *
 * 수식:
 *   θ_VL = (θ_VL,design - θ_i) × β^(1/n) + θ_i
 *   θ_RL = θ_VL - (θ_VL,design - θ_RL,design) × β
 *   θ_HK,av = (θ_VL + θ_RL) / 2
 *
 * @param regime - 온도제식 (예: '55/45')
 * @param beta - 부하율 (0~1)
 * @param emissionType - 방열기 타입 (온도 지수 n 결정)
 * @param theta_i - 실내 설정 온도 (°C, 기본값 20)
 */
export function calculateOperatingTemperature(
    regime: TemperatureRegime,
    beta: number,
    emissionType: EmissionType = 'radiator',
    theta_i: number = 20
): OperatingTemperatureResult {
    const design = DESIGN_TEMPS[regime];
    const n = EMISSION_EXPONENT[emissionType];

    // β 클램핑 (0이면 최소 온도 반환)
    const b = Math.max(0.01, Math.min(1.0, beta));

    // DIN/TS 18599-5 5.3절 운전 온도 산출
    // θ_VL = (θ_VL,design - θ_i) × β^(1/n) + θ_i
    const theta_VL = (design.VL - theta_i) * Math.pow(b, 1 / n) + theta_i;

    // θ_RL = θ_VL - (θ_VL,design - θ_RL,design) × β
    const designSpread = design.VL - design.RL; // 설계 공급-환수 온도차
    const theta_RL = theta_VL - designSpread * b;

    // θ_HK,av = (θ_VL + θ_RL) / 2
    const theta_HK_av = (theta_VL + theta_RL) / 2;

    return {
        theta_VL: Math.round(theta_VL * 10) / 10,
        theta_RL: Math.round(theta_RL * 10) / 10,
        theta_HK_av: Math.round(theta_HK_av * 10) / 10,
    };
}

/**
 * 3. 운전 시간(t_h,rL) 산출 — DIN/TS 18599-5 5.4절
 *
 * 야간 운전, 주말 정지 등 제어 방식을 반영하여
 * 월간 총 난방 가동 시간을 결정합니다.
 *
 * @param d_nutz - 사용일 (일/월)
 * @param d_we - 비사용일 (일/월)
 * @param t_op_d - 일일 사용 시간 (h/d)
 * @param operatingMode - 운전 모드
 * @param t_NA - 야간 시간 (h/d, 기본값 = 24 - t_op_d)
 */
export function calculateOperatingTime(
    d_nutz: number,
    d_we: number,
    t_op_d: number,
    operatingMode: OperatingMode = 'night_setback',
    t_NA?: number
): OperatingTimeResult {
    // 야간 시간 (명시되지 않으면 사용 시간의 나머지)
    const nightHours = t_NA ?? (24 - t_op_d);

    let t_op = 0;   // 사용일 가동 시간 (h)
    let t_non_op = 0; // 비사용일 가동 시간 (h)

    switch (operatingMode) {
        case 'continuous':
            // 연속 운전: 24시간 × 전체 일수
            t_op = d_nutz * 24;
            t_non_op = d_we * 24;
            break;

        case 'daytime_only':
            // 주간만 운전: 사용 시간 동안만 가동, 야간/주말 정지
            t_op = d_nutz * t_op_d;
            t_non_op = 0;
            break;

        case 'night_setback':
            // 야간 절하 운전: 24시간 가동하되 야간에는 낮은 온도로 운전
            // 시스템은 24시간 가동, 야간에도 배선 온도가 낮지만 가동 중
            t_op = d_nutz * 24;
            // 비사용일에도 절하 운전 (동결 방지 등)
            t_non_op = d_we * 24;
            break;

        case 'weekend_shutdown':
            // 주말 정지: 사용일에는 24시간 가동, 비사용일에는 정지
            t_op = d_nutz * 24;
            t_non_op = 0;
            break;
    }

    const t_h_rL = t_op + t_non_op;

    return {
        t_h_rL,
        t_op,
        t_non_op,
    };
}

/**
 * 통합 함수: 월간 운전 조건 일괄 산출
 *
 * 하나의 호출로 β, θ_HK,av, t_h,rL을 모두 계산합니다.
 */
export interface MonthlyOperatingConditions {
    beta: number;
    temperature: OperatingTemperatureResult;
    time: OperatingTimeResult;
}

export function calculateMonthlyOperatingConditions(params: {
    Q_h_b: number;          // 월간 난방 요구량 (kWh)
    Phi_h_max: number;      // 최대 난방 용량 (kW)
    regime: TemperatureRegime;
    emissionType: EmissionType;
    d_nutz: number;
    d_we: number;
    t_op_d: number;
    operatingMode: OperatingMode;
    theta_i?: number;
}): MonthlyOperatingConditions {
    const {
        Q_h_b, Phi_h_max, regime, emissionType,
        d_nutz, d_we, t_op_d, operatingMode,
        theta_i = 20,
    } = params;

    // 1. 운전 시간 산출
    const time = calculateOperatingTime(d_nutz, d_we, t_op_d, operatingMode);

    // 2. 부하율 산출
    const beta = calculateHeatingLoadRatio(Q_h_b, Phi_h_max, time.t_h_rL);

    // 3. 운전 온도 산출 (β 기반)
    const temperature = calculateOperatingTemperature(regime, beta, emissionType, theta_i);

    return { beta, temperature, time };
}
