
import { calculateEnergyDemand } from '../src/engine/calculator';
import { ZoneInput } from '../src/engine/types';
import { Surface } from '../src/types/project';

// Base Zone
const baseZone: ZoneInput = {
    id: 'zone-1',
    projectId: 'proj-1',
    name: 'Office',
    usageType: '1_single_office', // 250 days/year (Weekend off)
    area: 100,
    height: 3,
    volume: 300,
    temperatureSetpoints: { heating: 20, cooling: 26 },
    // Override profile for test
    isExcluded: false,
    surfaces: [
        {
            id: 's1', zoneId: 'zone-1', name: 'Wall', type: 'wall_exterior',
            area: 50, uValue: 0.5, orientation: 'S', tilt: 90, absorptionCoefficient: 0.5
        } as Surface
    ],
    // High Mass
    thermalCapacitySpecific: 50 * 50 // ~250 kJ/m2K (Medium-High) -> 50 Wh/m2K
};

// Case 1: Continuous (No Setback)
// Function to run simulation with specific profile overrides
function runTest(setback: number, cm: number) {
    const zone = JSON.parse(JSON.stringify(baseZone));
    // We can't easily override profile constants without mocking the profile dictionary or 
    // passing manual params to calculator?
    // Calculator uses 'usageType' to look up profile.
    // We can modify the LOOKUP in calculator... or simpler:
    // Modify the zone's specific Heat Capacity (C_m).
    // The Setback Temp is in the profile.
    // '1_single_office' has setback = 4.0.
    // '10_bed_room' has setback = 0.0.

    // To test Setback impact, we need to compare two different runs.
    // But profile is hardcoded.
    // Let's use '1_single_office' (Setback 4) as Intermittent Case.
    // And '10_bed_room' (Setback 0) as Continuous Case?
    // No, other params differ too much.

    // Workaround: We can't change profile params from outside easily in current structure.
    // EXCEPT if we assume the user implemented Profile Editor or Override?
    // Not yet.
    // BUT, the Calculator reads `zone.thermalCapacitySpecific`.
    // We can vary C_m.

    // To test Setback=0, I can define a custom profile?
    // Or I can modify `calculator.ts` temporarily? No.
    // I can stick to checking if the logic *ran* by checking logs, or trusting the code.
    // OR I can use a profile that has 0 setback if available?
    // '10_bed_room'. But it has 365 days usage! So Intermittent Logic won't run (d_we = 0).

    // So to test Intermittent logic, I MUST use a profile with annualUsageDays < 365.
    // e.g. Office.
    // I want to see if `Delta_Q_we > 0`.
    // If I set `thermalCapacitySpecific = 0`, then `Delta_Q_we` (Term 1) should be 0.
    // Then `Q_h` should be LOWER? 
    // Wait.
    // Delta_Q_we (Release) is subtracted from Weekend (Demand decreases).
    // And added to Usage (Demand increases).
    // If Delta=0 (No storage), we just have "Weekend with Low Temp" + "Usage with Normal Temp".
    // If Delta>0 (Storage), we shift heat from weekend to usage.
    // Weekend Demand reduced further (or capped). Usage Demand increased.
    // Does this increase or decrease total Q_h?
    // Transferring load from "Low Temp Period" to "High Temp Period"...
    // Theoretically, efficiency might be better/worse?
    // Usually, accounting for "Start-up / Re-heating" INCREASES demand compared to "Ideal Setback".
    // So:
    // Case A: High Mass (C_m high) -> High Delta -> High Recharge Penalty -> Higher Qh?
    // Case B: Zero Mass (C_m 0) -> Delta 0 -> No Recharge Penalty -> Lower Qh?

    zone.thermalCapacitySpecific = cm;
    const res = calculateEnergyDemand([zone]);
    return res.yearly.heatingDemand;
}

console.log("--- Running Intermittent Heating Verification ---");

// Test 1: Light Structure (C_m = 1 Wh/m2K) -> Delta ~ 0
const qh_light = runTest(4.0, 1);
console.log(`QH (Light Structure, C_m=1): ${qh_light.toFixed(2)} kWh`);

// Test 2: Heavy Structure (C_m = 50 Wh/m2K) -> Delta > 0
const qh_heavy = runTest(4.0, 50);
console.log(`QH (Heavy Structure, C_m=50): ${qh_heavy.toFixed(2)} kWh`);

// Test 3: Very Heavy (C_m = 100 Wh/m2K)
const qh_very_heavy = runTest(4.0, 100);
console.log(`QH (Very Heavy, C_m=100): ${qh_very_heavy.toFixed(2)} kWh`);

// Expectation:
// If the "Recharge" logic (Eq 132) works, Heavy structure should require MORE energy than Light structure
// because it "cools down less" (good) BUT "absorbs more heat" to warm up (bad)?
// Actually Eq 131 calculates "Entspeicherbare Wärme" (Heat released).
// This heat covers part of weekend load.
// But we have to pay it back during usage.
// If we have to pay back to a "Heat Sink" during Usage (Eta < 1), vs "Heat Source" during Weekend (Eta ~ 1 for Source? No, load).
// Usually, intermittency saves energy.
// But heavy mass reduces the saving (makes it closer to continuous).
// So Energy Saving: Light > Heavy > Continuous.
// So Demand: Light < Heavy < Continuous.
// Therefore, we expect QH_Light < QH_Heavy.

if (qh_light < qh_heavy) {
    console.log("SUCCESS: Light structure consumes less energy (better setback efficiency).");
} else {
    console.log("RESULT: Light structure consumes MORE/EQUAL? (Check logic)");
}
