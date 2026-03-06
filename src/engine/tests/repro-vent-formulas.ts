import { calculateZoneMonthly, MonthlyClimateIndices } from '../calculator';
import { ZoneInput } from '../types';
import { DIN_18599_PROFILES } from '@/lib/din-18599-profiles';

// Mock Zone
const zone: ZoneInput = {
    id: 'test-zone',
    projectId: 'test-project',
    name: 'Test Zone',
    usageType: '1_office',
    area: 18,
    height: 2.5,
    volume: 18 * 2.5 * 0.95,
    surfaces: [
        { id: 'win1', zoneId: 'test-zone', name: 'Window', type: 'window', area: 2, uValue: 1.3, orientation: 'S', tilt: 90 }
    ],
    temperatureSetpoints: { heating: 20, cooling: 26 },
    heatingReducedMode: 'setback',
    ventilationMode: 'balanced_mech',
    linkedVentilationUnitIds: [],
    isExcluded: false
};

// Mock Climate (Jan)
const mockIndices: MonthlyClimateIndices[] = Array(12).fill(0).map((_, i) => ({
    month: i + 1,
    Te_avg: -5,
    surfaceInsolation: {}
}));

// Mock Ventilation Config
// Screenshot: n_mech 0.867. n_nutz 1.68.
// If n_nutz = 1.68. n_mech = 0.867.
// 0.867 is maybe n_SUP?
const ventConfig = {
    type: 'mechanical' as const,
    systemType: 'exhaust' as const, // or exhaust?
    heatRecoveryEfficiency: 0,
    dailyOperationHours: 24,
    // n_SUP and n_ETA are calculated inside based on profile, but we can try to influence it or just observe.
    isMeasured: true,
    n50: 10 // Added n50 here where it belongs
};

console.log("--- Reproduction: f_e and Delta n_win ---");

// Test 1: Check f_e calculation
// Using internal function if possible, or recreating logic?
// We can't import calculateInfiltrationRate if it's not exported. It is exported in calculator.ts?
// "export function calculateInfiltrationRate..." -> No, it's not exported in the snippet I saw.
// Wait, snippet line 129: "function calculateInfiltrationRate". No export keyword.
// But earlier in the snippet list, I might have missed it.
// Actually `calculateZoneMonthly` is exported.
// I will modify `calculator.ts` to export helper functions for testing, or rely on `calculateZoneMonthly` result details.
// `MonthlyResult` has `n_inf` and `f_e` (fe in details?).
// `MonthlyResult` interface has `f_e`.

// Let's verify f_e with imbalance.
// Zone update for imbalance
const unbalancedConfig = { ...ventConfig, systemType: 'exhaust' as const };
// If exhaust, n_SUP=0, n_ETA > 0.
// Let's force some imbalance in the code or use `n_ETA` inputs if accessible.
// Since we can't easily control n_SUP/n_ETA from outside without modifying profile or logic,
// I'll rely on the fact that `calculateZoneMonthly` uses them.

// But wait, the user's issue is specific to formulas. 
// I will MODIFY calculator.ts to export the functions temporarily or just read the code analysis.
// I'll stick to running `calculateZoneMonthly` and checking output.

// To get n_SUP = 0.867:
// n_nutz = 1.68.
// If Balanced, n_SUP = n_nutz * (1 - recirculation)? 
// Or n_SUP = n_mech_design?
// Profile '1_office' has min outdoor air.
// If I use the same area/volume as screenshot, I get n_nutz = 1.68.

console.log("Running calculateZoneMonthly...");
const result = calculateZoneMonthly(
    zone,
    mockIndices,
    undefined,
    ventConfig,
    undefined,
    undefined,
    [],
    []
);

if (result && result.monthly.length > 0) {
    const jan = result.monthly[0];
    console.log(`n_nutz: ${jan.n_nutz} `);
    console.log(`n_inf: ${jan.n_inf} `); // Check if 0.7
    console.log(`f_e: ${jan.f_e} `); // Computed fe
    console.log(`n_SUP: ${jan.n_SUP} `);
    console.log(`n_ETA: ${jan.n_ETA} `);
    console.log(`Delta_n_win: ${jan.Delta_n_win} `);
    console.log(`Delta_n_win_mech: ${jan.Delta_n_win_mech} `);
    console.log(`Delta_n_win_mech_0: ${jan.Delta_n_win_mech_0} `); // If available in types?

    // Check f_e logic manually
    // n50 = 10. e = 0.07. f = 15. f_ATD = 1 (likely)
    // If Balanced, n_SUP = n_ETA. fe should be 1.
    // If Imbalanced, fe != 1.
}
