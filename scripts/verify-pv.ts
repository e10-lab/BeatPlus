
import { calculateHourlyPV } from "../src/engine/pv-calc";
import { PVSystem } from "../src/types/system";

// Mock Weather Data (simplified)
const mockWeather = Array.from({ length: 8760 }, (_, i) => ({
    Te: 20,
    I_beam: i % 24 > 6 && i % 24 < 18 ? 500 : 0, // Simple sun during day
    I_diff: i % 24 > 6 && i % 24 < 18 ? 100 : 0,
    day: Math.floor(i / 24),
    hour: i % 24
}));

const mockSystem: PVSystem = {
    id: "test-pv",
    name: "Test PV",
    type: "PV",
    projectId: "test-project",
    isShared: true,
    arrays: [
        {
            name: "Array 1",
            capacity: 10, // 10 kWp
            moduleType: "crystalline",
            orientation: "S",
            tilt: 30,
            performanceRatio: 0.8
        }
    ]
};

console.log("Running PV Calculation Verification...");
const result = calculateHourlyPV(mockSystem, mockWeather, 37.5);

console.log("Total Generation (kWh/a):", result.totalGeneration.toFixed(2));
console.log("First 24 hours generation (Wh):", result.hourlyGeneration.slice(0, 24).map(h => h.toFixed(1)).join(", "));

if (result.totalGeneration > 0) {
    console.log("SUCCESS: PV Generation calculated successfully.");
} else {
    console.error("FAILURE: No PV Generation calculated.");
}
