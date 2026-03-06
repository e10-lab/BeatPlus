/**
 * DIN/TS 18599-5 6.5절 다중 열원 부하 분배 검증 스크립트
 */

import { distributeLoad, heatingSystemToGenerator, type GeneratorUnit } from '../src/engine/systems/multi-generator';

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

console.log('=== DIN/TS 18599-5 6.5절 다중 열원 부하 분배 검증 ===\n');

// ─── 1. 단일 열원 (기존 호환) ───
console.log('--- 1. 단일 열원 (기존 호환) ---');

test('단일 보일러: 전체 부하 담당', () => {
    const gen: GeneratorUnit = {
        id: 'boiler1', name: 'Main Boiler', type: 'condensing_boiler',
        priority: 1, P_n: 30, efficiency: 0.95,
        energyCarrier: 'natural_gas', servesHeating: true, servesDHW: false,
    };
    const r = distributeLoad({ generators: [gen], Q_h_demand: 5000, hoursInMonth: 744 });
    console.log(`  Q_h=${r.generators[0].Q_heating}, coverage=${r.generators[0].coverageRatio.toFixed(2)}`);
    return r.generators[0].Q_heating === 5000 && r.unmetHeating === 0;
});

// ─── 2. 2열원 순차 제어 ───
console.log('\n--- 2. 2열원 순차 제어 ---');

test('HP(10kW) + Boiler(30kW): HP 우선, 초과분 보일러', () => {
    const hp: GeneratorUnit = {
        id: 'hp1', name: 'Heat Pump', type: 'heat_pump',
        priority: 1, P_n: 10, efficiency: 3.5,
        energyCarrier: 'electricity', servesHeating: true, servesDHW: false,
    };
    const boiler: GeneratorUnit = {
        id: 'boiler1', name: 'Gas Boiler', type: 'condensing_boiler',
        priority: 2, P_n: 30, efficiency: 0.95,
        energyCarrier: 'natural_gas', servesHeating: true, servesDHW: false,
    };
    // Q_demand = 10000kWh, HP max = 10*744 = 7440kWh, 나머지 2560kWh 보일러
    const r = distributeLoad({ generators: [hp, boiler], Q_h_demand: 10000, hoursInMonth: 744 });
    const hpResult = r.generators.find(g => g.generatorId === 'hp1')!;
    const boilerResult = r.generators.find(g => g.generatorId === 'boiler1')!;
    console.log(`  HP: Q=${hpResult.Q_heating}, β=${hpResult.beta.toFixed(3)}`);
    console.log(`  Boiler: Q=${boilerResult.Q_heating}, β=${boilerResult.beta.toFixed(3)}`);
    return hpResult.Q_heating === 7440 && boilerResult.Q_heating === 2560 && r.unmetHeating === 0;
});

test('부하가 1순위 용량 이내 → 2순위 미가동', () => {
    const hp: GeneratorUnit = {
        id: 'hp1', name: 'HP', type: 'heat_pump',
        priority: 1, P_n: 20, efficiency: 3.5,
        energyCarrier: 'electricity', servesHeating: true, servesDHW: false,
    };
    const boiler: GeneratorUnit = {
        id: 'boiler1', name: 'Boiler', type: 'condensing_boiler',
        priority: 2, P_n: 30, efficiency: 0.95,
        energyCarrier: 'natural_gas', servesHeating: true, servesDHW: false,
    };
    const r = distributeLoad({ generators: [hp, boiler], Q_h_demand: 5000, hoursInMonth: 744 });
    const boilerResult = r.generators.find(g => g.generatorId === 'boiler1')!;
    console.log(`  Boiler Q=${boilerResult.Q_heating} (기대=0)`);
    return boilerResult.Q_heating === 0 && boilerResult.beta === 0;
});

// ─── 3. DHW 공유 (Kombibetrieb) ───
console.log('\n--- 3. DHW 공유 (Kombibetrieb) ---');

test('HP가 난방+급탕 담당: 급탕 우선 할당', () => {
    const hp: GeneratorUnit = {
        id: 'hp1', name: 'HP', type: 'heat_pump',
        priority: 1, P_n: 10, efficiency: 3.5,
        energyCarrier: 'electricity', servesHeating: true, servesDHW: true,
    };
    const boiler: GeneratorUnit = {
        id: 'boiler1', name: 'Boiler', type: 'condensing_boiler',
        priority: 2, P_n: 30, efficiency: 0.95,
        energyCarrier: 'natural_gas', servesHeating: true, servesDHW: false,
    };
    // HP max = 10*744=7440, DHW=3000 → HP 난방 가용=4440, 난방 요구=8000, HP난방=4440, 보일러=3560
    const r = distributeLoad({ generators: [hp, boiler], Q_h_demand: 8000, Q_dhw_demand: 3000, hoursInMonth: 744 });
    const hpResult = r.generators.find(g => g.generatorId === 'hp1')!;
    const boilerResult = r.generators.find(g => g.generatorId === 'boiler1')!;
    console.log(`  HP: Q_dhw=${hpResult.Q_dhw}, Q_h=${hpResult.Q_heating}`);
    console.log(`  Boiler: Q_h=${boilerResult.Q_heating}`);
    return hpResult.Q_dhw === 3000 && hpResult.Q_heating === 4440 &&
        boilerResult.Q_heating === 3560 && r.unmetHeating === 0 && r.unmetDHW === 0;
});

// ─── 4. 커버리지 계수 ───
console.log('\n--- 4. 커버리지 계수 (κ) ---');

test('커버리지 합산 = 1.0', () => {
    const hp: GeneratorUnit = {
        id: 'hp1', name: 'HP', type: 'heat_pump',
        priority: 1, P_n: 10, efficiency: 3.5,
        energyCarrier: 'electricity', servesHeating: true, servesDHW: false,
    };
    const boiler: GeneratorUnit = {
        id: 'boiler1', name: 'Boiler', type: 'condensing_boiler',
        priority: 2, P_n: 30, efficiency: 0.95,
        energyCarrier: 'natural_gas', servesHeating: true, servesDHW: false,
    };
    const r = distributeLoad({ generators: [hp, boiler], Q_h_demand: 10000, hoursInMonth: 744 });
    const totalCoverage = r.generators.reduce((s, g) => s + g.coverageRatio, 0);
    console.log(`  총 커버리지=${totalCoverage.toFixed(4)} (기대=1.0)`);
    return approx(totalCoverage, 1.0, 0.01);
});

// ─── 5. 미충족 부하 ───
console.log('\n--- 5. 미충족 부하 ---');

test('전체 용량 부족 시 미충족 부하 발생', () => {
    const gen: GeneratorUnit = {
        id: 'small', name: 'Small', type: 'condensing_boiler',
        priority: 1, P_n: 5, efficiency: 0.95,
        energyCarrier: 'natural_gas', servesHeating: true, servesDHW: false,
    };
    // max = 5*744 = 3720, demand = 5000 → unmet = 1280
    const r = distributeLoad({ generators: [gen], Q_h_demand: 5000, hoursInMonth: 744 });
    console.log(`  unmetHeating=${r.unmetHeating}`);
    return r.unmetHeating === 1280;
});

// ─── 6. 헬퍼 함수 ───
console.log('\n--- 6. 헬퍼 함수 ---');

test('heatingSystemToGenerator 변환', () => {
    const sys = { id: 'sys1', name: 'Main', generator: { type: 'condensing_boiler', efficiency: 0.95, capacity: 30, energyCarrier: 'natural_gas' } };
    const gen = heatingSystemToGenerator(sys as any, { priority: 1, servesDHW: true });
    return gen.P_n === 30 && gen.servesDHW === true && gen.priority === 1;
});

console.log('\n=== 검증 완료 ===');
