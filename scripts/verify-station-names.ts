import { loadClimateData } from '../src/engine/climate-data';

async function verifyStationNames() {
    console.log("기상 관측소명 표시 로직 검증 중...");

    const testStations = [
        { id: 470980, expected: "동두천" },
        { id: 471080, expected: "서울" },
        { id: 471590, expected: "부산" },
        { id: 123456, expected: "Station 123456" } // 존재하지 않는 관측소 (폴백 확인용)
    ];

    for (const test of testStations) {
        try {
            const data = await loadClimateData(test.id);
            console.log(`관측소 ${test.id}: 산출명="${data.name}", 예상명="${test.expected}"`);
            if (data.name === test.expected) {
                console.log("✅ 일치!");
            } else {
                console.log("❌ 불일치!");
            }
        } catch (err) {
            if (test.id === 123456) {
                console.log(`관측소 ${test.id}: 예상된 오류 발생 (파일 없음) 또는 합성 데이터 폴백 작동.`);
            } else {
                console.error(`관측소 ${test.id} 로딩 오류:`, err);
            }
        }
    }
}

verifyStationNames();
