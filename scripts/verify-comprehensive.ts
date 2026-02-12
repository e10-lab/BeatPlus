import { calculateEnergyDemand } from '../src/engine/calculator';
import { ZoneInput } from '../src/engine/types';
import { Surface } from '../src/types/project';

// --- 존(Zone) 생성을 위한 헬퍼 함수 ---
function createZone(name: string, overrides: Partial<ZoneInput> = {}, surfaceOverrides: Partial<Surface> = {}): ZoneInput {
    const defaultSurface: Surface = {
        id: `s-${name}`, zoneId: name, name: 'South Window', type: 'window',
        area: 20, uValue: 1.5, orientation: 'S', tilt: 90, shgc: 0.6
    };

    return {
        id: name,
        projectId: 'proj-1',
        name: name,
        usageType: '1_office', // 용도: 사무소 (하루 11시간, 연간 250일 운영. 야간 설정온도 4K 하향)
        area: 100,
        height: 3,
        volume: 300,
        temperatureSetpoints: { heating: 20, cooling: 26 },
        thermalCapacitySpecific: 50 * 50, // 중간 열용량 (~50 Wh/m²K)
        surfaces: [{ ...defaultSurface, ...surfaceOverrides }],
        isExcluded: false,
        ...overrides
    };
}

// --- 테스트 케이스 정의 ---

// 2. 냉방 환기 (DIN V 18599 식 91)
// 높은 발열과 유효 팬 설정 필요
const coolingVentUnit = {
    id: 'ahu-1', projectId: 'proj-1', name: 'AHU', type: 'balanced',
    efficiency: 0.75, supplyFlowRate: 0, exhaustFlowRate: 0
};
const caseFreeCool = createZone('FreeCool', {
    usageType: '9_lecture_hall', // 높은 밀도의 강의실 설정
    linkedVentilationUnitIds: ['ahu-1']
});

// 3. 주간/야간 조명 검증
const caseWindow = createZone('Daylight', {}, { type: 'window' });
const caseNoWindow = createZone('NoDaylight', {}, { type: 'wall_exterior' }); // 불투명 벽체

// 4. 간헐 난방 및 구조체 열용량 검증
// DIN 18599-2 표 9의 현실적인 값 반영:
// 경량: ~15-50 Wh/m²K | 중량: ~130-260 Wh/m²K
const caseLight = createZone('LightMass', { thermalCapacitySpecific: 15 });
const caseHeavy = createZone('HeavyMass', { thermalCapacitySpecific: 150 });

// --- 시뮬레이션 실행 ---
console.log("=== 1. 냉방 부하 조절 환기 (식 91) ===");

console.log("\n=== 2. 냉방 부하 조절 환기 (식 91) ===");
// 식 91은 Te < Ti_c - 2 일 때 트리거됨 (예: 서울 5월 Te=19.5, Ti_c=26)
const resFreeCool = calculateEnergyDemand([caseFreeCool], undefined, undefined, undefined, [coolingVentUnit as any]);
const may = resFreeCool.monthly[4];
console.log(`5월 (외기온 Te=19.5):`);
console.log(`- 환기 손실 (QV): ${may.QV.toFixed(1)} kWh (프리쿨링 효과로 인해 높게 나타나야 함)`);
console.log(`- 냉방 수요 (Qc): ${may.Q_cooling.toFixed(1)} kWh`);
// 1월과 비교 (외기온 Te=-1.6, 최소 환기)
const jan = resFreeCool.monthly[0];
console.log(`1월 (외기온 Te=-1.6):`);
console.log(`- 환기 손실 (QV): ${jan.QV.toFixed(1)} kWh`);

console.log("\n=== 2. 주간/야간 조명 부하 ===");
const resWin = calculateEnergyDemand([caseWindow]);
const resNoWin = calculateEnergyDemand([caseNoWindow]);
const qiWin = resWin.monthly[0].QI;
const qiNoWin = resNoWin.monthly[0].QI;
console.log(`창문이 있는 경우 내부 발열: ${qiWin.toFixed(1)} kWh`);
console.log(`창문이 없는 경우 내부 발열: ${qiNoWin.toFixed(1)} kWh`);
console.log(`차이: ${(qiNoWin - qiWin).toFixed(1)} kWh (주광 이용 절감량)`);

console.log("\n=== 3. 간헐 난방 (구조체 열용량) ===");
const resLight = calculateEnergyDemand([caseLight]);
const resHeavy = calculateEnergyDemand([caseHeavy]);
const qhLight = resLight.yearly.heatingDemand;
const qhHeavy = resHeavy.yearly.heatingDemand;
console.log(`연간 난방 부하 (경량): ${qhLight.toFixed(1)} kWh/a`);
console.log(`연간 난방 부하 (중량): ${qhHeavy.toFixed(1)} kWh/a`);
console.log(`에너지 절감량: ${(qhLight - qhHeavy).toFixed(1)} kWh`);
if (qhHeavy < qhLight) console.log("성공: 중량 구조체가 에너지를 더 절량함.");
else console.log("실패: 중량 구조체의 에너지 절감 효과가 나타나지 않음.");

