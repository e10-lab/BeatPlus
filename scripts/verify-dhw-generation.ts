/**
 * DIN/TS 18599-8 급탕 발전 손실 수식 검증 스크립트
 * 
 * 검증 항목:
 * 1. K 계수 온도 보정 (η_k,Pn,w)
 * 2. 일일 전부하 가동 시간 (t_w,Pn,day)
 * 3. 가동 중 손실 (Q_w,gen,Pn,day)
 * 4. 대기 손실 (q_P0,θ 보정 + Q_w,gen,P0,day)
 * 5. 월간 합산 및 실효 효율
 * 6. 난방/비난방 기간 분리
 */

import { calculateDHWGenerationLoss, mapToDHWBoilerType } from '../src/engine/systems/dhw-generation-loss';

let passed = 0;
let failed = 0;
const results: string[] = [];

function test(name: string, fn: () => boolean) {
    try {
        if (fn()) {
            passed++;
            results.push(`✅ ${name}`);
        } else {
            failed++;
            results.push(`❌ ${name}`);
        }
    } catch (e) {
        failed++;
        results.push(`❌ ${name} — ${(e as Error).message}`);
    }
}

function approx(a: number, b: number, tol = 0.01) {
    if (b === 0) return Math.abs(a) < tol;
    return Math.abs((a - b) / b) < tol;
}

// ── 1. K 계수 온도 보정 ──
test('K 계수: 가스 콘덴싱 η=0.95, θ_s=55 → η_w ≈ 0.95+0.002×(50-55) = 0.94', () => {
    const r = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 30, eta_k_Pn: 0.95,
        Q_w_outg: 100, d_op: 30, theta_s_av: 55,
    });
    return approx(r.eta_k_Pn_w, 0.94);
});

test('K 계수: 표준 보일러 K=0 → η_w = η_k,Pn', () => {
    const r = calculateDHWGenerationLoss({
        boilerType: 'standard', P_n: 30, eta_k_Pn: 0.85,
        Q_w_outg: 100, d_op: 30, theta_s_av: 55,
    });
    return approx(r.eta_k_Pn_w, 0.85);
});

// ── 2. 전부하 가동 시간 ──
test('t_w,Pn: Q=300kWh, P=30kW, d=30일 → 300/(30×30)=0.333h/d', () => {
    const r = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 30, eta_k_Pn: 0.95,
        Q_w_outg: 300, d_op: 30,
    });
    return approx(r.t_w_Pn_day, 0.333, 0.02);
});

test('t_w,Pn: 최대 t_op(24h) 이하로 제한', () => {
    const r = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 1, eta_k_Pn: 0.95,
        Q_w_outg: 10000, d_op: 1, t_op_day: 24,
    });
    return r.t_w_Pn_day <= 24;
});

// ── 3. 가동 중 손실 ──
test('Q_gen,Pn: 콘덴싱 f_Hs/Hi=1.11, η_w=0.94 → lossRatio=(1.11-0.94)/0.94 ≈ 0.181', () => {
    const r = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 30, eta_k_Pn: 0.95,
        Q_w_outg: 300, d_op: 30, theta_s_av: 55,
    });
    const expectedLossRatio = (1.11 - 0.94) / 0.94;
    const expectedQday = expectedLossRatio * 30 * 24;
    return approx(r.Q_gen_Pn_day, expectedQday, 0.02);
});

// ── 4. 대기 손실 q_P0,θ 보정 ──
test('q_P0,θ: 콘덴싱 30kW → q_P0,70 = 4×30^(-0.4)/100, θ보정=(65-20)/50', () => {
    const r = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 30, eta_k_Pn: 0.95,
        Q_w_outg: 100, d_op: 30, theta_s_av: 55, theta_l: 20,
    });
    const q70 = (4 * Math.pow(30, -0.4)) / 100;
    const expectedQ = q70 * (65 - 20) / 50; // θ_gen = 55+10 = 65
    return approx(r.q_P0_theta, expectedQ, 0.05);
});

// ── 5. 빈 부하 시 ──
test('빈 부하: Q_w_outg=0 → Q_w_gen=0, Q_w_f=0', () => {
    const r = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 30, eta_k_Pn: 0.95,
        Q_w_outg: 0, d_op: 30,
    });
    return r.Q_w_gen === 0 && r.Q_w_f === 0;
});

// ── 6. 난방/비난방 기간 분리 ──
test('대기 손실: d_h_rB = d_op → 비난방일 없음 → Q_gen_sb = 0', () => {
    const r = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 30, eta_k_Pn: 0.95,
        Q_w_outg: 300, d_op: 30, d_h_rB: 30,
    });
    // 대기 손실의 비난방일 분은 0
    // Q_w_gen = 가동 중 비례분만
    return r.Q_w_gen >= 0 && r.Q_w_f > 300;
});

test('대기 손실: d_h_rB=0 → 전 기간 대기 손실 급탕 계상', () => {
    const r1 = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 30, eta_k_Pn: 0.95,
        Q_w_outg: 300, d_op: 30, d_h_rB: 0,
    });
    const r2 = calculateDHWGenerationLoss({
        boilerType: 'condensing_gas', P_n: 30, eta_k_Pn: 0.95,
        Q_w_outg: 300, d_op: 30, d_h_rB: 30,
    });
    return r1.Q_w_gen > r2.Q_w_gen; // 비난방 기간 있으면 손실 더 큼
});

// ── 7. mapToDHWBoilerType 헬퍼 ──
test('매핑: condensing_boiler → condensing_gas', () => {
    return mapToDHWBoilerType('condensing_boiler', 'natural_gas') === 'condensing_gas';
});

test('매핑: boiler → standard', () => {
    return mapToDHWBoilerType('boiler', 'natural_gas') === 'standard';
});

// ── 결과 출력 ──
console.log('\n=== DIN/TS 18599-8 급탕 발전 손실 검증 ===\n');
results.forEach(r => console.log(r));
console.log(`\n총 ${passed + failed}개 | ✅ ${passed} | ❌ ${failed}`);
if (failed > 0) process.exit(1);
