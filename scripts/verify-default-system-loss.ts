
import { calculateEnergyDemand } from "../src/engine/calculator";
import { Project, Zone, Construction } from "../src/types/project";
import { ZoneInput, CalculationResults } from "../src/engine/types";

// Mock Data
const mockZone: ZoneInput = {
    id: "zone-1",
    projectId: "proj-1",
    name: "Living Room",
    area: 100, // 100 m2
    volume: 300,
    height: 3,
    usageType: "1_office",
    surfaces: [],
    temperatureSetpoints: { heating: 20, cooling: 26 },
    ventilationMode: "natural"
};

const mockHeatingSystem: any = {
    id: "sys-heat-1",
    type: "HEATING",
    name: "Gas Boiler",
    projectId: "proj-1",
    isShared: false,
    linkedZoneIds: ["zone-1"],
    generator: { type: "std_boiler", energyCarrier: "natural_gas", efficiency: 0.9 },
    distribution: { temperatureRegime: "70/50", pumpControl: "const_pressure" }, // No pipeLength
    emission: { type: "radiator" }
    // No storage defined
};

const mockCoolingSystem: any = {
    id: "sys-cool-1",
    type: "COOLING",
    name: "AC",
    projectId: "proj-1",
    isShared: false,
    linkedZoneIds: ["zone-1"],
    generator: { type: "split", energyCarrier: "electricity", efficiency: 3.0 },
    distribution: { type: "air" }, // No pipeLength
    emission: { type: "air" }
};

const mockProject: Project = {
    id: "proj-1",
    name: "Test Project",
    zones: [mockZone],
    systems: [mockHeatingSystem, mockCoolingSystem],
    activeVariantId: "var-1",
    variants: [],
    userId: "test-user",
    createdAt: new Date(),
    updatedAt: new Date(),
    ventilationConfig: { type: "natural", heatRecoveryEfficiency: 0, n50: 1.5, dailyOperationHours: 24 },
    automationConfig: { automationClass: "C", heatingControl: "manual", ventilationControl: "manual" },
    siteArea: 200, BuildingArea: 100, TotalArea: 100, MainPurpose: "residential", MainStructure: "concrete", Scale: "2F", PermitDate: "2024-01-01"
} as unknown as Project;

// Run Calculation
const results: CalculationResults = calculateEnergyDemand(
    [mockZone],
    undefined, // weather
    undefined, // structure
    undefined, // vent config
    undefined, // vent units
    undefined, // auto config
    [mockHeatingSystem, mockCoolingSystem], // systems
    [], // constructions
    "monthly"
);

const zoneResult = results.zones.find(r => r.zoneId === "zone-1");

if (!zoneResult) {
    console.error("No result found for zone-1");
    process.exit(1);
}

// Inspect January (Month 1)
const jan = zoneResult.monthly.find(m => m.month === 1);

console.log("--- Heating System Loss Verification ---");
if (jan?.systemLosses?.heating?.details) {
    const d = jan.systemLosses.heating.details;
    console.log(`Zone Area: ${mockZone.area} m2`);
    console.log(`L_pipe (calc): ${d.distribution?.L?.toFixed(2)} m`);

    // Manual Check for L_pipe
    // L = 2 * (sqrt(100) + sqrt(100) + 1*3 + 10) = 2 * (10 + 10 + 3 + 10) = 2 * 33 = 66
    const expected_L = 66;
    console.log(`L_pipe (expected): ${expected_L} m`);

    // dT for 70/50 is 60 - 20 = 40 (mean 60)
    // Wait, 70/50 -> mean = 60. 60 - 20 = 40.
    // My implementation: 70/50 -> Theta_mean = 60.
    console.log(`dT_pipe: ${d.distribution?.total?.dT} K (Expected 40K for 70/50 - 20)`);
    console.log(`V_s (storage): ${d.storage?.V_s} L (Expected 100 L for 1.0 * Area)`);
    console.log(`Q_s_loss (Jan): ${d.storage?.total?.Q_loss?.toFixed(3)} kWh`);
} else {
    console.log("No Heating System Loss details found.");
}

console.log("\n--- Cooling System Loss Verification ---");
// Inspect August (Month 8)
const Aug = zoneResult.monthly.find(m => m.month === 8);
if (Aug?.systemLosses?.cooling?.details) {
    const d = Aug.systemLosses.cooling.details;
    console.log(`L_pipe (Cooling): ${d.distribution?.L?.toFixed(2)} m`);
    // Cooling mean 9, ambient 20 -> dT = 11
    console.log(`dT_pipe (Cooling): ${d.distribution?.total?.dT} K (Expected 11K for |20 - 9|)`);
} else {
    console.log("No Cooling System Loss details found.");
}
