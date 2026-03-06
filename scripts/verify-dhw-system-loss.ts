/**
 * Gap 2 검증: dhw-system-loss.ts 공유 모듈
 * dhw-calc.ts와 calculator.ts가 동일한 수식을 사용하는지 확인
 */

import {
    calcStandbyLoss_Wh_day,
    calcStandbyLoss_Wh_h,
    estimateDHWPipeLength,
    getDHWPipeUl,
    estimateStorageVolume,
    calculateDHWSystemLoss,
} from '../src/engine/systems/dhw-system-loss';

let passed = 0;
let failed = 0;
const results: string[] = [];

function test(name: string, fn: () => boolean) {
    try {
        if (fn()) { passed++; results.push(`✅ ${name}`); }
        else { failed++; results.push(`❌ ${name}`); }
    } catch (e) {
        failed++; results.push(`❌ ${name} — ${(e as Error).message}`);
    }
}

function approx(a: number, b: number, tol = 0.02) {
    if (b === 0) return Math.abs(a) < tol;
    return Math.abs((a - b) / b) < tol;
}

// ── 1. 저장 손실: DIN 식(30) Q_s,p0 = (0.8 + 0.02 × V^0.77) × 1000 [Wh/d] ──
test('저장 손실(100L): 식(30) = (0.8+0.02×100^0.77)×1000', () => {
    const expected = (0.8 + 0.02 * Math.pow(100, 0.77)) * 1000;
    return approx(calcStandbyLoss_Wh_day(100), expected);
});

test('저장 손실(0L): 0', () => {
    return calcStandbyLoss_Wh_day(0) === 0;
});

// ── 2. 온도 보정된 시간당 손실 ──
test('시간당 손실: 60°C/20°C → ΔT/45 = 40/45 보정', () => {
    const Q_sb_day = calcStandbyLoss_Wh_day(100);
    const expected = (Q_sb_day / 24) * (40 / 45);
    return approx(calcStandbyLoss_Wh_h(100, 60, 20), expected);
});

test('시간당 손실: 65°C/20°C → ΔT/45 = 1.0 보정 (기준 조건)', () => {
    const Q_sb_day = calcStandbyLoss_Wh_day(100);
    const expected = Q_sb_day / 24; // 보정 = 1.0
    return approx(calcStandbyLoss_Wh_h(100, 65, 20), expected);
});

// ── 3. 배관 길이: 표 12 ──
test('배관 길이(주거 100m²): L_V=0.11×100^1.24, L_S=0.05×100^0.97', () => {
    const L_V = 0.11 * Math.pow(100, 1.24);
    const L_S = 0.05 * Math.pow(100, 0.97);
    return approx(estimateDHWPipeLength(100, true), L_V + L_S);
});

test('배관 길이(비주거 200m²): L_V=5.4×200^0.49, L_S=0.025×200^0.97', () => {
    const L_V = 5.4 * Math.pow(200, 0.49);
    const L_S = 0.025 * Math.pow(200, 0.97);
    return approx(estimateDHWPipeLength(200, false), L_V + L_S);
});

// ── 4. U_l: 표 10 ──
test('U_l(none)=0.255, basic=0.200, good=0.150, reinforced=0.100', () => {
    return getDHWPipeUl('none') === 0.255
        && getDHWPipeUl('basic') === 0.200
        && getDHWPipeUl('good') === 0.150
        && getDHWPipeUl('reinforced') === 0.100;
});

// ── 5. 저장조 체적 추정 ──
test('체적(100m²)=116L, 200m²=192L', () => {
    return approx(estimateStorageVolume(100), 116, 0.05)
        && approx(estimateStorageVolume(200), 192, 0.05);
});

// ── 6. 통합 함수 calculateDHWSystemLoss ──
test('통합 함수: 비주거 200m², 22일+31일', () => {
    const r = calculateDHWSystemLoss({
        area: 200,
        isResidential: false,
        daysUsage: 22,
        daysInMonth: 31,
        Q_w_b: 5000,
        theta_i: 20,
    });
    return r.Q_w_d_op > 0
        && r.Q_w_s_op > 0
        && r.Q_w_s_non_op > 0
        && r.Q_I_w > 0
        && r.metadata.L_w_d > 0
        && approx(r.metadata.U_l_w_d, 0.255);
});

test('통합 함수: 단열=good → U_l=0.150', () => {
    const r = calculateDHWSystemLoss({
        area: 200,
        isResidential: false,
        daysUsage: 22,
        daysInMonth: 31,
        Q_w_b: 5000,
        theta_i: 20,
        pipeInsulation: 'good',
    });
    return approx(r.metadata.U_l_w_d, 0.150);
});

test('통합 함수: 타이머 → t_op_day=16', () => {
    const r = calculateDHWSystemLoss({
        area: 200,
        isResidential: false,
        daysUsage: 22,
        daysInMonth: 31,
        Q_w_b: 5000,
        theta_i: 20,
        hasTimer: true,
    });
    return r.metadata.t_op_day === 16;
});

test('dhw-calc과 calculator 일치: 동일 입력 → 동일 출력', () => {
    // 두 곳 모두 estimateDHWPipeLength 사용 시의 결과 비교
    const area = 150;
    const r = calculateDHWSystemLoss({
        area,
        isResidential: false,
        daysUsage: 22,
        daysInMonth: 31,
        Q_w_b: 3000,
        theta_i: 20,
    });
    // 이전 calculator.ts 인라인 로직 재현
    const L_V = 5.4 * Math.pow(area, 0.49);
    const L_S = 0.025 * Math.pow(area, 0.97);
    const L = L_V + L_S;
    const U_l = 0.255;
    const dT = 57.5 - 20;
    const Q_w_d_old = L * U_l * dT * (24 * 31);
    // 공유 모듈과 기존 로직의 배관 손실 비교
    return approx(r.Q_w_d_op, Q_w_d_old);
});

// ── 결과 ──
console.log('\n=== DIN/TS 18599-8 급탕 공유 모듈 검증 ===\n');
results.forEach(r => console.log(r));
console.log(`\n총 ${passed + failed}개 | ✅ ${passed} | ❌ ${failed}`);
if (failed > 0) process.exit(1);
