/**
 * DIN/TS 18599-5 6.1~6.2절 방열 손실 수식 검증 스크립트
 */

import { calculateEmissionLoss, getHydraulicFactor } from '../src/engine/systems/heating-emission-loss';

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

console.log('=== DIN/TS 18599-5 6.1~6.2절 방열 손실 검증 ===\n');

// ─── 1. Δθ 값 검증 ───
console.log('--- 1. Δθ 구성요소 검증 ---');

test('라디에이터(외벽), P-제어, 정적균형 → Δθ_ce ≈ 2.05K', () => {
    const r = calculateEmissionLoss({
        Q_h_b: 1000, theta_i: 20, theta_e: 0,
        emitterType: 'radiator', radiatorPosition: 'exterior_wall_opaque',
        controlType: 'p_control', hydraulicBalancing: 'static',
    });
    // str=0.55 + ctr=1.2 + emb=0 + hydr=0.3 + roomaut=0 = 2.05
    console.log(`  Δθ_str=${r.delta_theta_str}, Δθ_ctr=${r.delta_theta_ctr}, Δθ_hydr=${r.delta_theta_hydr}`);
    console.log(`  Δθ_ce=${r.delta_theta_ce}`);
    return approx(r.delta_theta_ce, 2.05, 0.2);
});

test('바닥난방, PI최적화, 동적균형 → Δθ_ce 낮음', () => {
    const r = calculateEmissionLoss({
        Q_h_b: 1000, theta_i: 20, theta_e: 0,
        emitterType: 'floor_heating', controlType: 'pi_optimized',
        hydraulicBalancing: 'dynamic', floorInsulation: 'enhanced',
    });
    // str=0 + ctr=0.9 + emb=(0.7+0.1)/2=0.4 + hydr=0 + roomaut=0 = 1.3
    console.log(`  Δθ_str=${r.delta_theta_str}, Δθ_ctr=${r.delta_theta_ctr}, Δθ_emb=${r.delta_theta_emb}`);
    console.log(`  Δθ_ce=${r.delta_theta_ce}`);
    return r.delta_theta_ce < 2.0;
});

test('수동밸브, 균형없음 → Δθ_ce 높음', () => {
    const r = calculateEmissionLoss({
        Q_h_b: 1000, theta_i: 20, theta_e: 0,
        emitterType: 'radiator', controlType: 'manual', hydraulicBalancing: 'none',
    });
    // str=0.55 + ctr=2.5 + emb=0 + hydr=0.6 = 3.65
    console.log(`  Δθ_ce=${r.delta_theta_ce}`);
    return r.delta_theta_ce > 3.0;
});

// ─── 2. Q_h,ce 수식 검증 ───
console.log('\n--- 2. Q_h,ce 수식 검증 (식 34) ---');

test('Q_h,ce = 1000 × 2.05/20 = 102.5 kWh', () => {
    const r = calculateEmissionLoss({
        Q_h_b: 1000, theta_i: 20, theta_e: 0,
        emitterType: 'radiator', radiatorPosition: 'exterior_wall_opaque',
        controlType: 'p_control', hydraulicBalancing: 'static',
    });
    const expected = 1000 * (r.delta_theta_ce / 20);
    console.log(`  Q_h_ce=${r.Q_h_ce.toFixed(2)}, 기대=${expected.toFixed(2)}`);
    return approx(r.Q_h_ce, expected, 1);
});

test('θ_e=10°C → ΔT=10K → 손실 비율 증가', () => {
    const r = calculateEmissionLoss({
        Q_h_b: 1000, theta_i: 20, theta_e: 10,
        emitterType: 'radiator', controlType: 'p_control', hydraulicBalancing: 'static',
    });
    // Q_h,ce = 1000 * Δθ_ce / 10 (분모 작아짐 → 비율 증가)
    console.log(`  Q_h_ce=${r.Q_h_ce.toFixed(2)} (θ_e=10°C)`);
    return r.Q_h_ce > 150; // 비율이 더 큼
});

test('Q_h,b=0 → Q_h,ce=0', () => {
    const r = calculateEmissionLoss({
        Q_h_b: 0, theta_i: 20, theta_e: 0,
        emitterType: 'radiator',
    });
    return r.Q_h_ce === 0;
});

// ─── 3. f_hydr 검증 ───
console.log('\n--- 3. 수력 평형 계수 (f_hydr) ---');

test('균형없음 → f_hydr=1.06', () => getHydraulicFactor('none') === 1.06);
test('정적균형 → f_hydr=1.02', () => getHydraulicFactor('static') === 1.02);
test('동적균형 → f_hydr=1.00', () => getHydraulicFactor('dynamic') === 1.00);

// ─── 4. 실내 자동화 보정 ───
console.log('\n--- 4. 실내 자동화 보정 (Δθ_roomaut) ---');

test('시간제어 → Δθ_ce 감소', () => {
    const base = calculateEmissionLoss({
        Q_h_b: 1000, theta_i: 20, theta_e: 0,
        emitterType: 'radiator', controlType: 'p_control',
        roomAutomation: 'none',
    });
    const auto = calculateEmissionLoss({
        Q_h_b: 1000, theta_i: 20, theta_e: 0,
        emitterType: 'radiator', controlType: 'p_control',
        roomAutomation: 'time_control',
    });
    console.log(`  기본 Δθ=${base.delta_theta_ce}, 시간제어 Δθ=${auto.delta_theta_ce}`);
    return auto.delta_theta_ce < base.delta_theta_ce;
});

console.log('\n=== 검증 완료 ===');
