import { loadClimateData } from '../climate-data';

async function verifyStationNames() {
    console.log("Verifying station name display logic...");

    const testStations = [
        { id: 470980, expected: "동두천" },
        { id: 471080, expected: "서울" },
        { id: 471590, expected: "부산" }
    ];

    for (const test of testStations) {
        try {
            const data = await loadClimateData(test.id);
            console.log(`Station ${test.id}: Result="${data.name}", Expected="${test.expected}"`);
            if (data.name === test.expected) {
                console.log("✅ Match!");
            } else {
                console.log("❌ Mismatch!");
            }
        } catch (err) {
            console.error(`Error loading station ${test.id}:`, err);
        }
    }
}

verifyStationNames();
