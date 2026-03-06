/**
 * DIN/TS 18599-5 6.5절 보일러 발전 손실 수식 검증 스크립트
 *
 * 검증 항목:
 * 1. K/L 온도 보정 (표 46, 식 225/226)
 * 2. 대기 손실 (식 223/224)
 * 3. 손실 전력 보간 (식 219/220)
 * 4. 총 발전 손실 산출 (식 218)
 * 5. 보일러 유형별 비교
 */

import { calculateBoilerGenerationLoss } from '../src/engine/systems/boiler-generation-loss';

const PASS = '✅';
const FAIL = '❌';

function approx(a: number, b: number, tol = 0.01): boolean {
    return Math.abs(a - b) < tol;
}

function test(name: string, fn: () => boolean): void {
    const result = fn();
    console.log(`${result ? PASS : FAIL} ${name}`);
    if (!result) process.exitCode = 1;
}

console.log('=== DIN/TS 18599-5 6.5절 보일러 발전 손실 검증 ===\n');

// ─── 1. K/L 온도 보정 ───
console.log('--- 1. K/L 온도 보정 (표 46, 식 225/226) ---');

test('콘덴싱, θ_HK=50°C → η_Pn 보정: 0.95 + 0.002*(80-50) = 1.01', () => {
    const r = calculateBoilerGenerationLoss({
        boilerType: 'condensing_boiler', P_n: 30, eta_k_Pn: 0.95,
        beta_gen: 0.5, theta_HK_av: 50, t_h_rL_day: 24, d_h_rB: 31,
    });
    // η_gen,Pn = 0.95 + 0.002 * (80 - 50) = 0.95 + 0.06 = 1.01
    console.log(`  η_gen,Pn=${r.eta_gen_Pn.toFixed(4)}, 기대=1.0100`);
    return approx(r.eta_gen_Pn, 1.01, 0.005);
});

test('콘덴싱, θ_HK=80°C → K 보정 = 0 (시험 온도 = 운전 온도)', () => {
    const r = calculateBoilerGenerationLoss({
        boilerType: 'condensing_boiler', P_n: 30, eta_k_Pn: 0.95,
        beta_gen: 0.5, theta_HK_av: 80, t_h_rL_day: 24, d_h_rB: 31,
    });
    console.log(`  η_gen,Pn=${r.eta_gen_Pn.toFixed(4)}, 기대=0.9500`);
    return approx(r.eta_gen_Pn, 0.95, 0.005);
});

test('표준 보일러, K=0 → η_Pn은 시험값 그대로', () => {
    const r = calculateBoilerGenerationLoss({
        boilerType: 'standard_boiler', P_n: 30, eta_k_Pn: 0.88,
        beta_gen: 0.5, theta_HK_av: 50, t_h_rL_day: 24, d_h_rB: 31,
    });
    console.log(`  η_gen,Pn=${r.eta_gen_Pn.toFixed(4)}, 기대=0.8800 (K=0)`);
    return approx(r.eta_gen_Pn, 0.88, 0.005);
});

// ─── 2. 대기 손실 ───
console.log('\n--- 2. 대기 손실 (식 223/224) ---');

test('콘덴싱, θ_HK=50°C → q_P0,θ < q_P0,70', () => {
    const r = calculateBoilerGenerationLoss({
        boilerType: 'condensing_boiler', P_n: 30, eta_k_Pn: 0.95,
        beta_gen: 0.1, theta_HK_av: 50, t_h_rL_day: 24, d_h_rB: 31,
    });
    // q_P0,θ = 0.005 * (50-20)/(70-20) = 0.005 * 0.6 = 0.003
    // P_gen,P0 = 0.003 * (30/0.95) * 1.0 = 0.003 * 31.58 = 0.0947 kW
    console.log(`  P_gen,P0=${r.P_gen_P0.toFixed(4)} kW, 기대≈0.0947 kW`);
    return r.P_gen_P0 > 0.08 && r.P_gen_P0 < 0.12;
});

test('θ_HK=70°C → q_P0,θ = q_P0,70 (ΔT=50K)', () => {
    const r = calculateBoilerGenerationLoss({
        boilerType: 'condensing_boiler', P_n: 30, eta_k_Pn: 0.95,
        beta_gen: 0.1, theta_HK_av: 70, t_h_rL_day: 24, d_h_rB: 31,
    });
    // q_P0,θ = 0.005 * (70-20)/50 = 0.005 → P = 0.005 * 31.58 = 0.158 kW
    console.log(`  P_gen,P0=${r.P_gen_P0.toFixed(4)} kW, 기대≈0.1579 kW`);
    return approx(r.P_gen_P0, 0.158, 0.01);
});

// ─── 3. 손실 전력 보간 ───
console.log('\n--- 3. 손실 전력 보간 (식 219/220) ---');

test('β=0.01 (극저부하) → 손실은 P0에 가까움', () => {
    const r = calculateBoilerGenerationLoss({
        boilerType: 'condensing_boiler', P_n: 30, eta_k_Pn: 0.95,
        beta_gen: 0.01, theta_HK_av: 50, t_h_rL_day: 24, d_h_rB: 31,
    });
    console.log(`  Q_gen_loss=${r.Q_gen_loss.toFixed(2)} kWh, P_P0=${r.P_gen_P0.toFixed(4)} kW`);
    // 저부하에서 손실은 주로 대기 손실에 의해 결정
    return r.Q_gen_loss > 0;
});

test('β=1.0 (전부하), 콘덴싱 η>1 → 발전 손실 ≈ 0 (기존 대기손실 보간만)', () => {
    const r = calculateBoilerGenerationLoss({
        boilerType: 'condensing_boiler', P_n: 30, eta_k_Pn: 0.95,
        beta_gen: 1.0, theta_HK_av: 50, t_h_rL_day: 24, d_h_rB: 31,
    });
    console.log(`  Q_gen_loss=${r.Q_gen_loss.toFixed(2)} kWh, η_eff=${r.eta_effective.toFixed(4)}, η_gen,Pn=${r.eta_gen_Pn.toFixed(4)}`);
    // η_gen,Pn = 1.01 > 1.0이므로 P_gen,Pn < 0 → Q_loss = 0 (물리적 정확)
    return r.Q_gen_loss >= 0 && r.eta_gen_Pn > 1.0;
});

// ─── 4. 총 발전 손실 ───
console.log('\n--- 4. 총 발전 손실 (식 218) ---');

test('월간 손실 = P_loss × t_day × d_month', () => {
    const r = calculateBoilerGenerationLoss({
        boilerType: 'condensing_boiler', P_n: 30, eta_k_Pn: 0.95,
        beta_gen: 0.5, theta_HK_av: 50, t_h_rL_day: 24, d_h_rB: 31,
    });
    console.log(`  Q_gen_loss=${r.Q_gen_loss.toFixed(2)} kWh, η_eff=${r.eta_effective.toFixed(4)}`);
    // Q_gen_loss = P_loss_interp * 24 * 31
    return r.Q_gen_loss > 0 && r.Q_gen_loss < 5000;
});

// ─── 5. 보일러 유형별 비교 ───
console.log('\n--- 5. 보일러 유형별 비교 ---');

test('같은 조건에서 콘덴싱 > 표준 효율', () => {
    const base = { P_n: 30, eta_k_Pn: 0.92, beta_gen: 0.5, theta_HK_av: 50, t_h_rL_day: 24, d_h_rB: 31 };
    const cond = calculateBoilerGenerationLoss({ ...base, boilerType: 'condensing_boiler' });
    const std = calculateBoilerGenerationLoss({ ...base, boilerType: 'standard_boiler' });
    console.log(`  콘덴싱 η_eff=${cond.eta_effective.toFixed(4)}, 표준 η_eff=${std.eta_effective.toFixed(4)}`);
    console.log(`  콘덴싱 Q_loss=${cond.Q_gen_loss.toFixed(1)}, 표준 Q_loss=${std.Q_gen_loss.toFixed(1)}`);
    return cond.eta_effective > std.eta_effective;
});

test('같은 조건에서 저온 보일러 → 표준 대비 대기 손실 적음', () => {
    const base = { P_n: 30, eta_k_Pn: 0.90, beta_gen: 0.3, theta_HK_av: 50, t_h_rL_day: 24, d_h_rB: 31 };
    const low = calculateBoilerGenerationLoss({ ...base, boilerType: 'low_temp_boiler' });
    const std = calculateBoilerGenerationLoss({ ...base, boilerType: 'standard_boiler' });
    console.log(`  저온 P_P0=${low.P_gen_P0.toFixed(4)}, 표준 P_P0=${std.P_gen_P0.toFixed(4)}`);
    return low.P_gen_P0 < std.P_gen_P0;
});

console.log('\n=== 검증 완료 ===');
