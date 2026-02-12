
import { calculateEnergyDemand } from '../calculator';
import { ZoneInput } from '../types';

function createTestZone(usageDays: number): ZoneInput {
    return {
        id: 'test-zone',
        projectId: 'test-project',
        name: 'Storage Test Zone',
        usageType: '1_office', // Default 250 days usually
        area: 100,
        height: 3,
        volume: 300,
        surfaces: [
            { id: 'wall1', zoneId: 'test-zone', name: 'Wall', type: 'wall_exterior', area: 100, uValue: 0.2, fx: 1.0 }
        ],
        temperatureSetpoints: {
            heating: 20,
            cooling: 26
        },
        profileOverride: {
            annualUsageDays: usageDays,
            heatingSetbackTemp: 10 // Large setback to make effect visible
        }
    } as any;
}

// Mock DIN_18599_PROFILES if needed, or rely on internal logic to use override
// internal logic uses 'profile.annualUsageDays'. If I pass override, does it apply?
// In calculateZoneMonthly: const profile = DIN_18599_PROFILES[zone.usageType] ...
// I need to make sure I can override usage days.
// The code says: `profile.annualUsageDays`.
// It doesn't look like `profileOverride` is mixed in automatically for annualUsageDays in the current code I saw.
// Let's check calculator loop:
// `const profile = DIN_18599_PROFILES[zone.usageType] || ...`
// It doesn't look like it merges `zone.profileOverride`.
// Use a usage type that has specific days, or I might need to hack the profile object in test.

async function runTest() {
    console.log("Verifying Heat Storage Transfer (Section 6.6)...");

    // We can't easily override profile data without modifying the source or using a type that matches.
    // Let's assume '1_office' has < 260 days.
    // Standard office is 250 days.

    // Test 1: Office (Standard ~250 days) -> Logic should trigger
    const zoneOff = createTestZone(250);
    // Manually inject annualUsageDays into the profile object used by the calculator?
    // The calculator imports DIN_18599_PROFILES. I can't modify it easily here unless I mock.
    // But '1_office' profile typically has annualUsageDays = 250.

    const mockClimate = {
        monthly: Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            Te: 5, // Cold
            Is_Horiz: 20,
            phi: 50
        })),
        latitude: 37.5
    };

    const results = calculateEnergyDemand([zoneOff], mockClimate as any);
    const jan = results.zones[0].monthly[0]; // January

    console.log(`\nMonth: ${jan.month}`);
    console.log(`d_nutz: ${jan.d_nutz}`);
    console.log(`d_we: ${jan.d_we}`);
    console.log(`Q_heating: ${jan.Q_heating.toFixed(2)} kWh`);

    if (jan.d_we && jan.d_we > 0) {
        console.log("✅ Use of Non-Usage Days confirmed.");

        // Expected d_we:
        // Jan has 31 days.
        // Office usage 250 days/year -> 5 days/week?
        // 250 / 52 = 4.8 days/week.
        // Wait, standard profiles are fixed.
        // Let's check what '1_office' actually has: 250 days.
        // d_op_week = 250 / 52 = 4.807
        // d_non_op_week = 7 - 4.807 = 2.19
        // frac_non_op = 2.19 / 7 = 0.313
        // d_we = 31 * 0.313 = 9.7 approx.
        const expected_d_we = 31 * ((7 - (250 / 52)) / 7);
        console.log(`Expected d_we (approx): ${expected_d_we.toFixed(2)}`);

        if (Math.abs(jan.d_we - expected_d_we) < 0.5) {
            console.log("✅ d_we calculation matches expectation.");
        } else {
            console.error(`❌ d_we mismatch. Expected ${expected_d_we}, got ${jan.d_we}`);
        }

    } else {
        console.error("❌ Logic did not trigger (d_we is 0 or undefined).");
    }
}

runTest();
