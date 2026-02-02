
import { calculateEnergyDemand } from '../calculator';
import { ZoneInput } from '../types';

// Helper to create a mock zone
function createMockZone(id: string, usageType: any, area: number, height: number): ZoneInput {
    return {
        id,
        projectId: 'test-project',
        name: `Test Zone ${usageType}`,
        usageType,
        area,
        height,
        volume: area * height,
        surfaces: [
            // Simple box: 10x10m, 3m height.
            // Wall area = 10*3 * 4 = 120. Net wall = 120 - Window.
            // South Window 10m2
            { id: 'w1', zoneId: 'z1', name: 'N', type: 'wall_exterior', area: 30, uValue: 0.24, orientation: 'N', tilt: 90 },
            { id: 'w2', zoneId: 'z1', name: 'S', type: 'wall_exterior', area: 20, uValue: 0.24, orientation: 'S', tilt: 90 },
            { id: 'win1', zoneId: 'z1', name: 'Win S', type: 'window', area: 10, uValue: 1.3, shgc: 0.6, orientation: 'S', tilt: 90 },
            { id: 'w3', zoneId: 'z1', name: 'E', type: 'wall_exterior', area: 30, uValue: 0.24, orientation: 'E', tilt: 90 },
            { id: 'w4', zoneId: 'z1', name: 'W', type: 'wall_exterior', area: 30, uValue: 0.24, orientation: 'W', tilt: 90 },
            { id: 'r1', zoneId: 'z1', name: 'Roof', type: 'roof_exterior', area: 100, uValue: 0.15, orientation: 'S', tilt: 0 },
            { id: 'f1', zoneId: 'z1', name: 'Floor', type: 'floor_ground', area: 100, uValue: 0.3, orientation: 'NoExposure', tilt: 0 }
        ],
        temperatureSetpoints: {
            heating: 20,
            cooling: 26
        },
        ventilationMode: 'natural',
        isMechanical: false,
        // Mock sub-objects for types
        linkedVentilationUnitIds: [],
        lighting: { efficacy: 60, powerDensity: 10 }
    } as ZoneInput;
}

async function runTests() {
    console.log("Running Simulation Verification Suite (DIN/TS 18599:2025)...");

    try {
        // Test Case 1: Standard Office (Profile 1)
        console.log("\n------------------------------------------------");
        console.log("Test Case 1: Standard Office (Profile: 1_office)");
        console.log("------------------------------------------------");
        const officeZone = createMockZone('z1', '1_office', 100, 3);

        // Use default weather (Seoul) by passing undefined
        const resultsOffice = calculateEnergyDemand([officeZone]);
        const yearlyOffice = resultsOffice.zones[0].yearly;

        console.log(`Heating Demand: ${yearlyOffice.specificHeatingDemand.toFixed(2)} kWh/m²a`);
        console.log(`Cooling Demand: ${yearlyOffice.specificCoolingDemand.toFixed(2)} kWh/m²a`);
        const lightingSpecific = yearlyOffice.lightingDemand / 100;
        console.log(`Lighting Demand: ${lightingSpecific.toFixed(2)} kWh/m²a`);
        console.log(`Primary Energy:  ${(yearlyOffice.primaryEnergy?.total || 0) / 100} kWh/m²a`);

        // Assertions
        let passOffice = true;
        if (yearlyOffice.specificHeatingDemand < 10 || yearlyOffice.specificHeatingDemand > 150) {
            console.error("❌ Heating Demand out of expected range (10-150)!");
            passOffice = false;
        }
        if (yearlyOffice.specificCoolingDemand < 5 || yearlyOffice.specificCoolingDemand > 100) {
            console.error("❌ Cooling Demand out of expected range (5-100)!");
            passOffice = false;
        }
        if (lightingSpecific < 2 || lightingSpecific > 30) {
            console.error("❌ Lighting Demand out of expected range (2-30)!");
            passOffice = false;
        }

        if (passOffice) console.log("✅ Office Test Passed");


        // Test Case 2: Residential (Profile 42)
        console.log("\n------------------------------------------------");
        console.log("Test Case 2: Residential Single (Profile: 42_res_single)");
        console.log("------------------------------------------------");
        const resZone = createMockZone('z2', '42_res_single', 100, 3);
        const resultsRes = calculateEnergyDemand([resZone]);
        const yearlyRes = resultsRes.zones[0].yearly;

        console.log(`Heating Demand: ${yearlyRes.specificHeatingDemand.toFixed(2)} kWh/m²a`);
        console.log(`Cooling Demand: ${yearlyRes.specificCoolingDemand.toFixed(2)} kWh/m²a`);
        console.log(`DHW Demand:     ${(yearlyRes.dhwDemand / 100).toFixed(2)} kWh/m²a`);

        let passRes = true;
        // Residential heating often higher than office due to 24h usage (or profile specific)
        if (yearlyRes.specificHeatingDemand < 10) {
            console.error("❌ Residential Heating suspiciously low!");
            passRes = false;
        }
        // Residential DHW should be significant
        if (yearlyRes.dhwDemand < 100) { // < 1 kwh/m2a? too low. 
            // 42_res_single DHW demand ~ 10-15 kWh/m2a usually? 
            // actually yearlyRes.dhwDemand is total kWh. Area 100.
            if ((yearlyRes.dhwDemand / 100) < 5) {
                console.error("❌ DHW Demand too low for residential!");
                passRes = false;
            }
        }

        if (passRes) console.log("✅ Residential Test Passed");

    } catch (e) {
        console.error("CRITICAL ERROR during verification:", e);
    }
}

runTests();
