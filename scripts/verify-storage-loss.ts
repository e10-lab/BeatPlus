/**
 * DIN/TS 18599-5 6.4절 축열조 손실 수식 검증 스크립트
 */

import { calculateStorageLoss, calculateDailyStandbyLoss } from '../src/engine/systems/heating-storage-loss';

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

console.log('=== DIN/TS 18599-5 6.4절 축열조 손실 검증 ===\n');

// ─── 1. 일일 대기 손실 (식 71) ───
console.log('--- 1. Q_P0,s,day (식 71) ---');

test('V=200L → Q_P0 = 0.4+0.14*√200 = 2.38 kWh/d', () => {
    const q = calculateDailyStandbyLoss(200);
    const expected = 0.4 + 0.14 * Math.sqrt(200);
    console.log(`  Q_P0=${q.toFixed(3)}, 기대=${expected.toFixed(3)}`);
    return approx(q, expected, 0.01);
});

test('V=500L → Q_P0 = 0.4+0.14*√500 = 3.53 kWh/d', () => {
    const q = calculateDailyStandbyLoss(500);
    console.log(`  Q_P0=${q.toFixed(3)}`);
    return approx(q, 0.4 + 0.14 * Math.sqrt(500), 0.01);
});

test('제조사 제공값 우선', () => {
    const q = calculateDailyStandbyLoss(500, 2.0);
    return q === 2.0;
});

// ─── 2. 온도 보정 (식 69) ───
console.log('\n--- 2. 온도 보정 (식 69) ---');

test('θ_s=50°C, θ_l=13°C → (50-13)/45 = 0.822', () => {
    const r = calculateStorageLoss({
        V_s: 200, theta_h_s: 50,
        storageLocation: 'unheated_space', sameRoomAsGenerator: false,
        d_op_mth: 31,
    });
    // Q = 1.0 * (50-13)/45 * 31 * (0.4+0.14*√200)
    const expected = 1.0 * ((50 - 13) / 45) * 31 * (0.4 + 0.14 * Math.sqrt(200));
    console.log(`  Q_h_s=${r.Q_h_s.toFixed(2)}, 기대=${expected.toFixed(2)}, θ_l=${r.theta_l}`);
    return approx(r.Q_h_s, expected, 0.5) && r.theta_l === 13;
});

test('θ_s=35°C (바닥난방) → 온도차 작아서 손실 감소', () => {
    const r50 = calculateStorageLoss({
        V_s: 200, theta_h_s: 50, d_op_mth: 31, sameRoomAsGenerator: false,
    });
    const r35 = calculateStorageLoss({
        V_s: 200, theta_h_s: 35, d_op_mth: 31, sameRoomAsGenerator: false,
    });
    console.log(`  θ=50: Q=${r50.Q_h_s.toFixed(1)}, θ=35: Q=${r35.Q_h_s.toFixed(1)}`);
    return r35.Q_h_s < r50.Q_h_s;
});

// ─── 3. f_con 계수 ───
console.log('\n--- 3. 연결 배관 계수 (f_con) ---');

test('같은 공간 → f_con=1.2', () => {
    const r = calculateStorageLoss({
        V_s: 200, theta_h_s: 50, d_op_mth: 31, sameRoomAsGenerator: true,
    });
    console.log(`  f_con=${r.f_con}`);
    return r.f_con === 1.2;
});

test('다른 공간 → f_con=1.0', () => {
    const r = calculateStorageLoss({
        V_s: 200, theta_h_s: 50, d_op_mth: 31, sameRoomAsGenerator: false,
    });
    return r.f_con === 1.0;
});

test('f_con=1.2 → 손실 20% 증가', () => {
    const same = calculateStorageLoss({
        V_s: 200, theta_h_s: 50, d_op_mth: 31, sameRoomAsGenerator: true,
    });
    const diff = calculateStorageLoss({
        V_s: 200, theta_h_s: 50, d_op_mth: 31, sameRoomAsGenerator: false,
    });
    const ratio = same.Q_h_s / diff.Q_h_s;
    console.log(`  비율=${ratio.toFixed(2)} (기대=1.20)`);
    return approx(ratio, 1.2, 0.01);
});

// ─── 4. 경계 조건 ───
console.log('\n--- 4. 경계 조건 ---');

test('V_s=0 → Q=0', () => {
    const r = calculateStorageLoss({ V_s: 0, theta_h_s: 50, d_op_mth: 31 });
    return r.Q_h_s === 0;
});

test('난방 공간 설치 → θ_l=20°C', () => {
    const r = calculateStorageLoss({
        V_s: 200, theta_h_s: 50, d_op_mth: 31, storageLocation: 'heated_space',
    });
    console.log(`  θ_l=${r.theta_l}`);
    return r.theta_l === 20;
});

console.log('\n=== 검증 완료 ===');
