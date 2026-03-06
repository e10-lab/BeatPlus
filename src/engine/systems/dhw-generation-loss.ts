/**
 * DIN/TS 18599-8 급탕 열원 발전 손실 계산
 * 
 * 난방(Part 5)과 달리 "가동 시간(전부하)과 대기 시간 분리" 접근법 사용.
 * - η_k,Pn,w = η_k,Pn + K × (50°C − θ_s,av)  (온도 보정)
 * - q_P0,θ = q_P0,70 × (θ_gen,av − θ_l) / (70 − 20) (대기 손실 보정)
 * - Q_w,gen = Q_w,gen,Pn × (t_w,Pn / 24) × d_op + Q_w,gen,P0 × max(d_op − d_h,rB; 0)
 */

// ──────────────────────────────────────────────
//  타입 정의
// ──────────────────────────────────────────────

/** 보일러 유형 */
export type DHWBoilerType = 'condensing_gas' | 'condensing_oil' | 'low_temp' | 'standard';

/** 입력 파라미터 */
export interface DHWGenerationInput {
    /** 보일러 유형 */
    boilerType: DHWBoilerType;
    /** 정격 용량 P_n [kW] */
    P_n: number;
    /** 정격 전부하 효율 η_k,Pn (Hi 기준, 0~1.1) */
    eta_k_Pn: number;
    /** 월간 급탕 요구 출력 Q_w,outg [kWh] (배관+저장 손실 포함) */
    Q_w_outg: number;
    /** 축열조 평균 온도 θ_s,av [°C] — 기본 55 */
    theta_s_av?: number;
    /** 보일러 주변 온도 θ_l [°C] — 기본 20 */
    theta_l?: number;
    /** 급탕 가동 일수 d_op [일] */
    d_op: number;
    /** 난방 가동 일수 d_h,rB [일] — 난방 기간 대기 손실 분리용 */
    d_h_rB?: number;
    /** 일일 가동 시간 t_op (순환 시스템 기준) [h] — 기본 24 */
    t_op_day?: number;
    /** f_Hs/Hi — 연소 기준 보정 계수(콘덴싱=1.11 가스, 1.06 오일) 기본 자동 */
    f_Hs_Hi?: number;
}

/** 출력 결과 */
export interface DHWGenerationResult {
    /** 월간 총 발전 손실 Q_w,gen [kWh] */
    Q_w_gen: number;
    /** 월간 최종 에너지 Q_w,f [kWh] */
    Q_w_f: number;
    /** 실효 효율 (Q_w,outg / Q_w,f) */
    eta_effective: number;
    /** 보정된 급탕 전부하 효율 η_k,Pn,w */
    eta_k_Pn_w: number;
    /** 일일 전부하 가동 시간 [h] */
    t_w_Pn_day: number;
    /** 일일 가동 중 손실 [kWh] */
    Q_gen_Pn_day: number;
    /** 일일 대기 중 손실 [kWh] */
    Q_gen_P0_day: number;
    /** 온도 보정 대기 계수 q_P0,θ */
    q_P0_theta: number;
}

// ──────────────────────────────────────────────
//  Table 31 — K 계수 (급탕 온도 보정)
// ──────────────────────────────────────────────

/** 급탕 K 계수: 50°C 기준 효율 보정 */
function getK(type: DHWBoilerType): number {
    switch (type) {
        case 'condensing_gas': return 0.002;
        case 'condensing_oil': return 0.0004;
        case 'low_temp': return 0.0004;
        case 'standard': return 0;
    }
}

// ──────────────────────────────────────────────
//  Table 35 — q_P0,70 대기 손실 경험식 계수
//  q_P0,70 = E × P_n^F / 100
// ──────────────────────────────────────────────

function getQP0_70(type: DHWBoilerType, P_n: number): number {
    let E: number, F: number;
    switch (type) {
        case 'condensing_gas':
        case 'condensing_oil':
            E = 4.0; F = -0.4;
            break;
        case 'low_temp':
            E = 8.5; F = -0.4;
            break;
        case 'standard':
            E = 8.5; F = -0.4;
            break;
    }
    // q_P0,70 = E × P_n^F / 100  (무차원 비율)
    return (E * Math.pow(Math.max(1, P_n), F)) / 100;
}

// ──────────────────────────────────────────────
//  f_Hs/Hi 자동 결정
// ──────────────────────────────────────────────

function getDefaultFHsHi(type: DHWBoilerType): number {
    switch (type) {
        case 'condensing_gas': return 1.11;
        case 'condensing_oil': return 1.06;
        default: return 1.0;
    }
}

// ──────────────────────────────────────────────
//  메인 계산 함수
// ──────────────────────────────────────────────

/**
 * DIN/TS 18599-8 급탕 발전 손실 계산
 *
 * 핵심 플로우:
 * 1. η_k,Pn,w = η_k,Pn + K × (50 − θ_s,av)
 * 2. t_w,Pn,day = Q_w,outg / (P_n × d_op)
 * 3. Q_w,gen,Pn,day = ((f_Hs/Hi − η_k,Pn,w) / η_k,Pn,w) × P_n × 24
 * 4. q_P0,θ = q_P0,70 × (θ_gen,av − θ_l) / 50
 * 5. Q_w,gen,P0,day = q_P0,θ × (P_n / η_k,Pn,w) × (t_op − t_w,Pn) × f_Hs/Hi
 * 6. Q_w,gen = Q_gen,Pn,day × (t_w,Pn/24) × d_op + Q_gen,P0,day × max(d_op − d_h,rB; 0)
 */
export function calculateDHWGenerationLoss(input: DHWGenerationInput): DHWGenerationResult {
    const {
        boilerType,
        P_n,
        eta_k_Pn,
        Q_w_outg,
        theta_s_av = 55,
        theta_l = 20,
        d_op,
        d_h_rB = 0,
        t_op_day = 24,
    } = input;

    const f_Hs_Hi = input.f_Hs_Hi ?? getDefaultFHsHi(boilerType);

    // 빈 부하 시 조기 반환
    if (Q_w_outg <= 0 || P_n <= 0 || d_op <= 0) {
        return {
            Q_w_gen: 0,
            Q_w_f: 0,
            eta_effective: eta_k_Pn,
            eta_k_Pn_w: eta_k_Pn,
            t_w_Pn_day: 0,
            Q_gen_Pn_day: 0,
            Q_gen_P0_day: 0,
            q_P0_theta: 0,
        };
    }

    // ── 1) 급탕 전부하 효율 (온도 보정) ──
    const K = getK(boilerType);
    const eta_k_Pn_w = Math.max(0.5, eta_k_Pn + K * (50 - theta_s_av));

    // ── 2) 일일 전부하 가동 시간 ──
    let t_w_Pn_day = Q_w_outg / (P_n * d_op);
    t_w_Pn_day = Math.min(t_w_Pn_day, t_op_day); // 최대 가동 시간 이하

    // ── 3) 가동 중 일일 손실 ──
    // Q_w,gen,Pn,day = ((f_Hs/Hi − η_k,Pn,w) / η_k,Pn,w) × P_n × 24
    const lossRatio = Math.max(0, (f_Hs_Hi - eta_k_Pn_w) / eta_k_Pn_w);
    const Q_gen_Pn_day = lossRatio * P_n * 24;

    // ── 4) 대기 손실 온도 보정 ──
    const q_P0_70 = getQP0_70(boilerType, P_n);
    const theta_gen_av = theta_s_av + 10; // 보일러 평균 온도 ≈ θ_s,av + 10K
    const q_P0_theta = q_P0_70 * Math.max(0, (theta_gen_av - theta_l) / 50);

    // ── 5) 대기 중 일일 손실 ──
    const t_standby = Math.max(0, t_op_day - t_w_Pn_day);
    const Q_gen_P0_day = q_P0_theta * (P_n / eta_k_Pn_w) * t_standby * f_Hs_Hi;

    // ── 6) 월간 합산 ──
    // 가동 중 손실: 가동일 전체에 비례 (t_w,Pn/24 비중 반영)
    const Q_gen_op = Q_gen_Pn_day * (t_w_Pn_day / 24) * d_op;

    // 대기 손실: 난방 비가동일에만 급탕 측 계상
    const d_dhw_only = Math.max(0, d_op - d_h_rB);
    const Q_gen_sb = Q_gen_P0_day * d_dhw_only;

    const Q_w_gen = Math.max(0, Q_gen_op + Q_gen_sb);
    const Q_w_f = Q_w_outg + Q_w_gen;

    // 실효 효율
    const eta_effective = Q_w_f > 0 ? Q_w_outg / Q_w_f : eta_k_Pn;

    return {
        Q_w_gen,
        Q_w_f,
        eta_effective,
        eta_k_Pn_w,
        t_w_Pn_day,
        Q_gen_Pn_day,
        Q_gen_P0_day,
        q_P0_theta,
    };
}

// ──────────────────────────────────────────────
//  헬퍼: HeatingSystem → DHWBoilerType 매핑
// ──────────────────────────────────────────────

/**
 * generator.type → DHWBoilerType 매핑
 */
export function mapToDHWBoilerType(
    generatorType: string,
    energyCarrier?: string
): DHWBoilerType {
    if (generatorType.includes('condensing')) {
        return energyCarrier === 'oil' ? 'condensing_oil' : 'condensing_gas';
    }
    if (generatorType.includes('low_temp')) return 'low_temp';
    return 'standard';
}
