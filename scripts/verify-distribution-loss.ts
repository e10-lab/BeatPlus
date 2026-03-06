/**
 * DIN/TS 18599-5 6.3절 배관 분배 손실 수식 검증 스크립트
 *
 * 검증 항목:
 * 1. U_l 참조표 (표 27) — 단열/비단열/시공연도/면적별
 * 2. 배관 길이 추정 (식 60~61)
 * 3. 배관 손실 계산 (식 52) — 수동 검산 대조
 * 4. 가동/비가동 분리
 * 5. 실내 열획득 환입 (Gutschrift)
 */

import { calculateDistributionLoss } from '../src/engine/systems/heating-distribution-loss';

const PASS = '✅';
const FAIL = '❌';

function approx(a: number, b: number, tol = 0.5): boolean {
    return Math.abs(a - b) < tol;
}

function test(name: string, fn: () => boolean): void {
    const result = fn();
    console.log(`${result ? PASS : FAIL} ${name}`);
    if (!result) process.exitCode = 1;
}

console.log('=== DIN/TS 18599-5 6.3절 배관 분배 손실 검증 ===\n');

// ─── 1. U_l 참조표 검증 ───
console.log('--- 1. U_l 참조표 (표 27) ---');

test('비단열, A≤200m² → U_l=1.000', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'none', buildingArea: 150,
        theta_HK_av: 50, t_op: 744, t_non_op: 0
    });
    console.log(`  U_l=${r.U_l}`);
    return r.U_l === 1.000;
});

test('비단열, A=300m² → U_l=2.000', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'none', buildingArea: 300,
        theta_HK_av: 50, t_op: 744, t_non_op: 0
    });
    console.log(`  U_l=${r.U_l}`);
    return r.U_l === 2.000;
});

test('비단열, A=600m² → U_l=3.000', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'none', buildingArea: 600,
        theta_HK_av: 50, t_op: 744, t_non_op: 0
    });
    console.log(`  U_l=${r.U_l}`);
    return r.U_l === 3.000;
});

test('기본 단열, 2000년 시공 → U_l=0.255', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'basic', buildingArea: 200,
        theta_HK_av: 50, t_op: 744, t_non_op: 0, constructionYear: 2000
    });
    console.log(`  U_l=${r.U_l}`);
    return r.U_l === 0.255;
});

test('양호 단열, 1990년 시공 → U_l=0.255', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'good', buildingArea: 200,
        theta_HK_av: 50, t_op: 744, t_non_op: 0, constructionYear: 1990
    });
    console.log(`  U_l=${r.U_l}`);
    return r.U_l === 0.255;
});

test('강화 단열 → U_l=0.200', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'reinforced', buildingArea: 200,
        theta_HK_av: 50, t_op: 744, t_non_op: 0
    });
    console.log(`  U_l=${r.U_l}`);
    return r.U_l === 0.200;
});

// ─── 2. 배관 길이 추정 검증 ───
console.log('\n--- 2. 배관 길이 추정 (식 60~61) ---');

test('A=200m², 1층, h=3m → L_max 자동 추정', () => {
    const r = calculateDistributionLoss({
        pipeInsulation: 'basic', buildingArea: 200,
        numFloors: 1, floorHeight: 3,
        theta_HK_av: 50, t_op: 744, t_non_op: 0
    });
    // L_max = 2 × (√200 + √200/1 ÷ √200 + 1×3 + 10)
    // l_char = √200 ≈ 14.14, b_char = 200/14.14 ≈ 14.14
    // L_max = 2 × (14.14 + 14.14/2 + 3 + 10) = 2 × (14.14 + 7.07 + 3 + 10) = 2 × 34.21 = 68.4
    console.log(`  L_pipe=${r.L_pipe}, 기대≈68.4m`);
    return r.L_pipe > 50 && r.L_pipe < 90;
});

test('사용자 지정 배관 길이 우선', () => {
    const r = calculateDistributionLoss({
        pipeLength: 42, pipeInsulation: 'basic', buildingArea: 200,
        theta_HK_av: 50, t_op: 744, t_non_op: 0
    });
    console.log(`  L_pipe=${r.L_pipe}`);
    return r.L_pipe === 42;
});

// ─── 3. 배관 손실 수동 검산 ───
console.log('\n--- 3. 배관 손실 수동 검산 (식 52) ---');

test('L=100m, U=0.255, ΔT=30K, t=744h → Q_d=5.69 kWh', () => {
    // Q = (1/1000) × 0.255 × 30 × 100 × 744 = 569.16 kWh
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'basic', buildingArea: 200,
        theta_HK_av: 50, theta_ambient: 20, // ΔT = 30K
        t_op: 744, t_non_op: 0, constructionYear: 2000,
        indoorPipeFraction: 0, // 환입 없음
    });
    const expected = (1/1000) * 0.255 * 30 * 100 * 744;
    console.log(`  Q_d_total=${r.Q_d_total.toFixed(2)} kWh, 기대=${expected.toFixed(2)} kWh`);
    return approx(r.Q_d_total, expected, 1);
});

// ─── 4. 가동/비가동 분리 ───
console.log('\n--- 4. 가동/비가동 분리 ---');

test('비가동 시 ΔT=0 → 비가동 손실=0', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'basic', buildingArea: 200,
        theta_HK_av: 50, t_op: 528, t_non_op: 216,
        indoorPipeFraction: 0,
    });
    console.log(`  Q_d_op=${r.Q_d_op.toFixed(2)}, Q_d_non_op=${r.Q_d_non_op.toFixed(2)}`);
    console.log(`  breakdown.op.Q_loss=${r.breakdown.op.Q_loss.toFixed(2)}, breakdown.non_op.Q_loss=${r.breakdown.non_op.Q_loss.toFixed(2)}`);
    return r.Q_d_non_op === 0 && r.Q_d_op > 0;
});

test('breakdown에 시간/온도차 기록 확인', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'basic', buildingArea: 200,
        theta_HK_av: 50, t_op: 528, t_non_op: 216,
    });
    console.log(`  op: hours=${r.breakdown.op.hours}, dT=${r.breakdown.op.dT}`);
    console.log(`  non_op: hours=${r.breakdown.non_op.hours}, dT=${r.breakdown.non_op.dT}`);
    return r.breakdown.op.hours === 528 && r.breakdown.non_op.hours === 216 &&
           r.breakdown.op.dT === 30 && r.breakdown.non_op.dT === 0;
});

// ─── 5. 실내 열획득 환입 ───
console.log('\n--- 5. 실내 열획득 환입 (Gutschrift) ---');

test('환입 80% → Q_d_indoor_gain = 0.8 × Q_d_total', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'basic', buildingArea: 200,
        theta_HK_av: 50, t_op: 744, t_non_op: 0,
        indoorPipeFraction: 0.8,
    });
    console.log(`  Q_d_total=${r.Q_d_total.toFixed(2)}, Q_d_indoor_gain=${r.Q_d_indoor_gain.toFixed(2)}, Q_d_net=${r.Q_d_net.toFixed(2)}`);
    return approx(r.Q_d_indoor_gain, r.Q_d_total * 0.8, 0.01) &&
           approx(r.Q_d_net, r.Q_d_total * 0.2, 0.01);
});

test('환입 0% → Q_d_net = Q_d_total', () => {
    const r = calculateDistributionLoss({
        pipeLength: 100, pipeInsulation: 'basic', buildingArea: 200,
        theta_HK_av: 50, t_op: 744, t_non_op: 0,
        indoorPipeFraction: 0,
    });
    return approx(r.Q_d_net, r.Q_d_total, 0.01);
});

console.log('\n=== 검증 완료 ===');
