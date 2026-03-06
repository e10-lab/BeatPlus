/**
 * DIN/TS 18599-5:2025-10 6.5절 — 보일러 발전 손실 계산
 *
 * 부하율(β)에 따른 손실 전력 선형 보간 + 대기 손실 온도 보정 +
 * K/L 계수 기반 효율 보정을 통해 총 발전 손실을 산출합니다.
 *
 * 핵심 수식:
 * - 식 218: Q_h,gen = Σ(Q_h,gen,ls,day × d_h,rB)
 * - 식 219/220: 부하율별 손실 전력 보간
 * - 식 223: P_gen,P0 = q_P0,θ × (P_n / η_k,Pn) × f_Hs/Hi
 * - 식 224: q_P0,θ = q_P0,70 × (θ_HK,av - θ_l) / (70 - 20)
 * - 식 225: η_gen,Pn = η_k,Pn + K × (θ_Test,Pn - θ_HK,av)
 * - 식 226: η_gen,Pint = η_k,Pint + L × (θ_Test,Pint - θ_HK,av)
 */

// ─── 타입 정의 ───

/** 보일러 유형 */
export type BoilerType = 'condensing_boiler' | 'low_temp_boiler' | 'standard_boiler';

/** 보일러 발전 손실 계산 입력 */
export interface BoilerGenerationInput {
    // 보일러 기본 사양
    boilerType: BoilerType;
    P_n: number;                  // 정격 출력 (kW)
    eta_k_Pn: number;            // 전부하 시험 효율 (0~1, Hi 기준)
    eta_k_Pint?: number;         // 부분부하 시험 효율 (0~1, Hi 기준)
    q_P0_70?: number;            // 70°C 기준 대기 손실 계수 (없으면 표 45 기본값)

    // 운전 조건 (Phase 1 산출값)
    beta_gen: number;            // 발전기 부하율
    theta_HK_av: number;         // 평균 운전 온도 (°C)
    theta_ambient?: number;      // 보일러 주변 온도 (°C, 기본값 20)

    // 시간 조건
    t_h_rL_day: number;          // 일일 난방 가동 시간 (h/d)
    d_h_rB: number;              // 월간 난방 가동 일수 (일)

    // 연료 관련
    f_Hs_Hi?: number;            // 상위/하위 발열량 비 (가스: 1.11, 오일: 1.06)
}

/** 보일러 발전 손실 계산 결과 */
export interface BoilerGenerationResult {
    eta_gen_Pn: number;          // 보정된 전부하 효율
    eta_gen_Pint: number;        // 보정된 부분부하 효율
    P_gen_P0: number;            // 대기 손실 전력 (kW)
    P_gen_Pint: number;          // 부분부하 손실 전력 (kW)
    P_gen_Pn: number;            // 전부하 손실 전력 (kW)
    Q_gen_loss: number;          // 월간 발전 손실 (kWh)
    eta_effective: number;       // 실효 효율 (Q_outg / (Q_outg + Q_gen_loss))
}

// ─── 표 46: K/L 계수 (온도 보정) ───

interface KLCoefficients {
    K: number;     // 전부하 효율 보정 계수 (K/°C)
    L: number;     // 부분부하 효율 보정 계수 (K/°C)
    theta_Test_Pn: number;   // 전부하 시험 온도 (°C)
    theta_Test_Pint: number; // 부분부하 시험 온도 (°C)
    beta_Pint: number;       // 부분부하 기준점
}

/** DIN/TS 18599-5 표 46 기반 K/L 계수 */
const KL_TABLE: Record<BoilerType, KLCoefficients> = {
    condensing_boiler: {
        K: 0.002,
        L: 0.002,
        theta_Test_Pn: 80,    // 전부하 시험: 80/60
        theta_Test_Pint: 30,  // 부분부하 시험: 환수 30°C
        beta_Pint: 0.3,
    },
    low_temp_boiler: {
        K: 0.0004,
        L: 0.0004,
        theta_Test_Pn: 75,    // 전부하 시험: 75/60
        theta_Test_Pint: 40,  // 부분부하 시험: 40°C
        beta_Pint: 0.3,
    },
    standard_boiler: {
        K: 0,
        L: 0.0004,
        theta_Test_Pn: 80,    // 정적 시험 온도
        theta_Test_Pint: 50,
        beta_Pint: 0.3,
    },
};

// ─── 표 45: 70°C 기준 대기 손실 계수 기본값 ───

function getDefaultStandbyLoss(boilerType: BoilerType, P_n: number): number {
    // q_P0,70 기본값 (보일러 유형 및 용량별)
    if (boilerType === 'condensing_boiler') {
        if (P_n <= 50) return 0.005;
        if (P_n <= 120) return 0.004;
        return 0.003;
    }
    if (boilerType === 'low_temp_boiler') {
        if (P_n <= 50) return 0.008;
        if (P_n <= 120) return 0.006;
        return 0.005;
    }
    // standard_boiler
    if (P_n <= 50) return 0.012;
    if (P_n <= 120) return 0.010;
    return 0.008;
}

// ─── 핵심 계산 함수 ───

/**
 * 보일러 발전 손실 계산 — DIN/TS 18599-5 6.5절
 */
export function calculateBoilerGenerationLoss(input: BoilerGenerationInput): BoilerGenerationResult {
    const {
        boilerType,
        P_n,
        eta_k_Pn,
        theta_HK_av,
        theta_ambient = 20,
        beta_gen,
        t_h_rL_day,
        d_h_rB,
        f_Hs_Hi = boilerType === 'condensing_boiler' ? 1.0 : 1.0,
    } = input;

    // 부분부하 시험 효율 기본값 산출
    let eta_k_Pint = input.eta_k_Pint ?? eta_k_Pn;
    if (!input.eta_k_Pint) {
        if (boilerType === 'condensing_boiler') {
            eta_k_Pint = eta_k_Pn + 0.04; // 콘덴싱: 부분부하에서 효율 상승
        } else {
            eta_k_Pint = eta_k_Pn - 0.02; // 일반: 부분부하에서 소폭 하락
        }
    }

    const kl = KL_TABLE[boilerType];
    const b = Math.max(0.01, Math.min(1.0, beta_gen));

    // ─── 1. K/L 온도 보정 (식 225, 226) ───
    // η_gen,Pn = η_k,Pn + K × (θ_Test,Pn − θ_HK,av)
    const eta_gen_Pn = Math.min(
        1.09, // 물리적 상한 (콘덴싱 최대)
        eta_k_Pn + kl.K * (kl.theta_Test_Pn - theta_HK_av)
    );

    // η_gen,Pint = η_k,Pint + L × (θ_Test,Pint − θ_HK,av)
    const eta_gen_Pint = Math.min(
        1.09,
        eta_k_Pint + kl.L * (kl.theta_Test_Pint - theta_HK_av)
    );

    // ─── 2. 대기 손실 전력 (식 223, 224) ───
    const q_P0_70 = input.q_P0_70 ?? getDefaultStandbyLoss(boilerType, P_n);

    // 식 224: q_P0,θ = q_P0,70 × (θ_HK,av − θ_l) / (70 − 20)
    const q_P0_theta = q_P0_70 * Math.max(0, (theta_HK_av - theta_ambient)) / (70 - 20);

    // 식 223: P_gen,P0 = q_P0,θ × (P_n / η_k,Pn) × f_Hs/Hi
    const P_gen_P0 = q_P0_theta * (P_n / eta_k_Pn) * f_Hs_Hi;

    // ─── 3. 부분부하/전부하 손실 전력 (식 227, 228) ───
    // P_gen,Pint = P_n × β_Pint × (1/η_gen,Pint − 1)
    const P_gen_Pint = P_n * kl.beta_Pint * (1 / eta_gen_Pint - 1);

    // P_gen,Pn = P_n × (1/η_gen,Pn − 1)
    const P_gen_Pn = P_n * (1 / eta_gen_Pn - 1);

    // ─── 4. 부하율별 손실 전력 보간 (식 219/220) ───
    let P_loss_interp: number;

    if (b <= kl.beta_Pint) {
        // 저부하 구간 (식 219): P0와 Pint 사이 보간
        P_loss_interp = (b / kl.beta_Pint) * (P_gen_Pint - P_gen_P0) + P_gen_P0;
    } else {
        // 고부하 구간 (식 220): Pint와 Pn 사이 보간
        P_loss_interp = ((b - kl.beta_Pint) / (1 - kl.beta_Pint)) * (P_gen_Pn - P_gen_Pint) + P_gen_Pint;
    }

    // ─── 5. 월간 발전 손실 (식 218) ───
    // Q_h,gen,ls = P_loss × t_h,rL,day × d_h,rB
    const Q_gen_loss = Math.max(0, P_loss_interp * t_h_rL_day * d_h_rB);

    // ─── 6. 실효 효율 ───
    // η_eff = Q_outg / (Q_outg + Q_gen_loss)
    // (Q_outg를 직접 모르므로, β×P_n×t로 근사하거나 외부에서 계산)
    // 여기서는 beta_gen 기반 근사
    const Q_outg_approx = b * P_n * t_h_rL_day * d_h_rB;
    const eta_effective = Q_outg_approx > 0
        ? Q_outg_approx / (Q_outg_approx + Q_gen_loss)
        : eta_gen_Pn;

    return {
        eta_gen_Pn,
        eta_gen_Pint,
        P_gen_P0,
        P_gen_Pint,
        P_gen_Pn,
        Q_gen_loss,
        eta_effective,
    };
}
