/**
 * DIN/TS 18599-5 5장 운전 조건 수식 검증 스크립트
 *
 * 검증 항목:
 * 1. θ_HK,av — 55/45 온도제식, β=0.5일 때 수식 대입 검산
 * 2. t_h,rL — 야간절하 운전 모드 기반 가동 시간 검산
 * 3. β — Q_h,b=500 kWh, Φ_max=20 kW, t=500h일 때 β 검산
 * 4. 통합 — calculateMonthlyOperatingConditions 함수 검증
 */

import {
    calculateHeatingLoadRatio,
    calculateOperatingTemperature,
    calculateOperatingTime,
    calculateMonthlyOperatingConditions,
} from '../src/engine/systems/heating-operating-conditions';

const PASS = '✅';
const FAIL = '❌';

function approx(a: number, b: number, tol = 0.1): boolean {
    return Math.abs(a - b) < tol;
}

function test(name: string, fn: () => boolean): void {
    const result = fn();
    console.log(`${result ? PASS : FAIL} ${name}`);
    if (!result) process.exitCode = 1;
}

console.log('=== DIN/TS 18599-5 5장 운전 조건 검증 ===\n');

// ─── 1. θ_HK,av 검증 ───
console.log('--- 1. 운전 온도 (θ_HK,av) ---');

test('55/45, β=1.0 → θ_VL=55, θ_RL=45, θ_HK_av=50', () => {
    const r = calculateOperatingTemperature('55/45', 1.0, 'radiator', 20);
    console.log(`  θ_VL=${r.theta_VL}, θ_RL=${r.theta_RL}, θ_HK_av=${r.theta_HK_av}`);
    return approx(r.theta_VL, 55) && approx(r.theta_RL, 45) && approx(r.theta_HK_av, 50);
});

test('55/45, β=0.5 → θ_VL ≈ 40.7°C (수식: (55-20)*0.5^(1/1.3)+20)', () => {
    // 수식 검산: θ_VL = (55-20) * 0.5^(1/1.3) + 20
    //           = 35 * 0.5^0.769 + 20
    //           = 35 * 0.587 + 20 = 20.55 + 20 = 40.55
    // θ_RL = 40.55 - (55-45)*0.5 = 40.55 - 5 = 35.55
    // θ_HK_av = (40.55 + 35.55) / 2 = 38.05
    const r = calculateOperatingTemperature('55/45', 0.5, 'radiator', 20);
    console.log(`  θ_VL=${r.theta_VL}, θ_RL=${r.theta_RL}, θ_HK_av=${r.theta_HK_av}`);
    const expected_VL = (55 - 20) * Math.pow(0.5, 1 / 1.3) + 20;
    const expected_RL = expected_VL - (55 - 45) * 0.5;
    const expected_avg = (expected_VL + expected_RL) / 2;
    console.log(`  기대값: θ_VL=${expected_VL.toFixed(1)}, θ_RL=${expected_RL.toFixed(1)}, θ_HK_av=${expected_avg.toFixed(1)}`);
    return approx(r.theta_VL, expected_VL, 0.2) && approx(r.theta_RL, expected_RL, 0.2);
});

test('35/28, β=0.3, 바닥난방 → θ_VL 낮음', () => {
    const r = calculateOperatingTemperature('35/28', 0.3, 'floor_heating', 20);
    console.log(`  θ_VL=${r.theta_VL}, θ_RL=${r.theta_RL}, θ_HK_av=${r.theta_HK_av}`);
    // 바닥난방 n=1.1, β=0.3
    // θ_VL = (35-20) * 0.3^(1/1.1) + 20 = 15 * 0.3^0.909 + 20
    return r.theta_VL > 20 && r.theta_VL < 35;
});

test('90/70, β=1.0 → θ_HK_av=80', () => {
    const r = calculateOperatingTemperature('90/70', 1.0, 'radiator', 20);
    console.log(`  θ_VL=${r.theta_VL}, θ_RL=${r.theta_RL}, θ_HK_av=${r.theta_HK_av}`);
    return approx(r.theta_HK_av, 80);
});

// ─── 2. t_h,rL 검증 ───
console.log('\n--- 2. 운전 시간 (t_h,rL) ---');

test('연속 운전: 22일+9일 → t=31*24=744h', () => {
    const r = calculateOperatingTime(22, 9, 10, 'continuous');
    console.log(`  t_h_rL=${r.t_h_rL}, t_op=${r.t_op}, t_non_op=${r.t_non_op}`);
    return approx(r.t_h_rL, 744);
});

test('주간만 운전: 22일, 10h/d → t=220h', () => {
    const r = calculateOperatingTime(22, 9, 10, 'daytime_only');
    console.log(`  t_h_rL=${r.t_h_rL}, t_op=${r.t_op}, t_non_op=${r.t_non_op}`);
    return approx(r.t_h_rL, 220);
});

test('야간절하 운전: 22일+9일 → t=744h (24h/d 가동)', () => {
    const r = calculateOperatingTime(22, 9, 10, 'night_setback');
    console.log(`  t_h_rL=${r.t_h_rL}, t_op=${r.t_op}, t_non_op=${r.t_non_op}`);
    return approx(r.t_h_rL, 744);
});

test('주말 정지: 22일 → t=528h, 비사용일 0h', () => {
    const r = calculateOperatingTime(22, 9, 10, 'weekend_shutdown');
    console.log(`  t_h_rL=${r.t_h_rL}, t_op=${r.t_op}, t_non_op=${r.t_non_op}`);
    return approx(r.t_h_rL, 528) && r.t_non_op === 0;
});

// ─── 3. β 검증 ───
console.log('\n--- 3. 부하율 (β) ---');

test('Q=500 kWh, Φ=20 kW, t=500h → β=0.05', () => {
    const beta = calculateHeatingLoadRatio(500, 20, 500);
    console.log(`  β=${beta}`);
    return approx(beta, 0.05, 0.001);
});

test('Q=10000 kWh, Φ=20 kW, t=500h → β=1.0 (클램핑)', () => {
    const beta = calculateHeatingLoadRatio(10000, 20, 500);
    console.log(`  β=${beta}`);
    return beta === 1.0;
});

test('Q=0 → β=0', () => {
    const beta = calculateHeatingLoadRatio(0, 20, 500);
    console.log(`  β=${beta}`);
    return beta === 0;
});

// ─── 4. 통합 검증 ───
console.log('\n--- 4. 통합 (calculateMonthlyOperatingConditions) ---');

test('통합: 55/45, Q=1000kWh, Φ=30kW, 22/9일, 야간절하', () => {
    const r = calculateMonthlyOperatingConditions({
        Q_h_b: 1000,
        Phi_h_max: 30,
        regime: '55/45',
        emissionType: 'radiator',
        d_nutz: 22,
        d_we: 9,
        t_op_d: 10,
        operatingMode: 'night_setback',
    });
    console.log(`  β=${r.beta.toFixed(3)}`);
    console.log(`  θ_VL=${r.temperature.theta_VL}, θ_RL=${r.temperature.theta_RL}, θ_HK_av=${r.temperature.theta_HK_av}`);
    console.log(`  t_h_rL=${r.time.t_h_rL}`);
    // β = 1000 / (30 * 744) = 0.0448
    const expected_beta = 1000 / (30 * 744);
    return approx(r.beta, expected_beta, 0.001) && r.time.t_h_rL === 744 && r.temperature.theta_HK_av > 20;
});

test('통합: Φ=0 (용량 미입력) → β=0', () => {
    const r = calculateMonthlyOperatingConditions({
        Q_h_b: 1000,
        Phi_h_max: 0,
        regime: '55/45',
        emissionType: 'radiator',
        d_nutz: 22,
        d_we: 9,
        t_op_d: 10,
        operatingMode: 'night_setback',
    });
    console.log(`  β=${r.beta}, θ_HK_av=${r.temperature.theta_HK_av}`);
    return r.beta === 0;
});

console.log('\n=== 검증 완료 ===');
