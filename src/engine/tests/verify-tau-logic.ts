
import { calculateEnergyDemand, calculateZoneMonthly } from '../calculator';
import { ZoneInput, MonthlyClimate as ClimateDataMonth } from '../types';
import { Project } from '../../types/project';
import { DIN_18599_PROFILES, UsageProfile } from '../../lib/din-18599-profiles';

async function runTest() {
    console.log("Verifying Time Constant (Tau) Logic Separation...");

    const zoneResMech: ZoneInput = {
        id: 'zone-res-mech',
        projectId: 'test-project',
        name: 'Residential Mech',
        usageType: '42_res_single', // Use a type starting with 4 to trigger isResidential=true
        area: 100,
        height: 3,
        volume: 300,
        surfaces: [
            { id: 'wall1', type: 'wall_exterior', area: 50, uValue: 0.2, fx: 1.0 },
            { id: 'win1', type: 'window', area: 10, uValue: 1.5, fx: 1.0 } as any
        ],
        temperatureSetpoints: { heating: 20, cooling: 26 },
        ventilationMode: 'mechanical',
        isResidential: true
    } as any;

    const mockClimate = {
        monthly: Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            Te: (i === 0) ? -5 : 20,
            Is_Horiz: 20,
            phi: 50,
            windSpeed: 3
        })),
        latitude: 37.5,
        stationName: "Mock"
    };

    const ventConfig = {
        type: 'mechanical',
        systemType: 'balanced',
        heatRecoveryEfficiency: 0.8,
        dailyOperationHours: 24
    };

    const results = calculateEnergyDemand(
        [zoneResMech],
        mockClimate as any,
        undefined,
        ventConfig as any
    );

    if (!results || !results.zones || results.zones.length === 0) {
        console.log("❌ Failed to calculate results.");
        return;
    }

    const jan = results.zones[0].monthly[0];

    // Check availability
    if (jan.H_tot === undefined || jan.tau === undefined || !jan.balanceDetails || jan.balanceDetails.Cm === undefined) {
        console.log("⚠️ Verification FAILED: Missing results (H_tot, Cm, or tau).");
        return;
    }

    const H_tot_balance = jan.H_tot;
    const Cm = jan.balanceDetails.Cm;
    const tau_actual = jan.tau;

    // Calculate what Tau WOULD be if we used H_tot_balance
    // If H_tot_tau was used, and it is larger (due to n_win_tau > n_win_balance), then Tau_actual < Tau_balance.
    const tau_if_wrong = Cm / H_tot_balance;

    console.log(`Cm: ${Cm}`);
    console.log(`H_tot (Balance): ${H_tot_balance.toFixed(2)}`);
    console.log(`Tau (Actual): ${tau_actual.toFixed(2)} hours`);
    console.log(`Tau (If using Balance H): ${tau_if_wrong.toFixed(2)} hours`);

    if (tau_actual < tau_if_wrong) {
        console.log("✅ Verification PASSED: Tau is smaller than it would be if using Balance H.");
        console.log("   (Implies H used for Tau was LARGER, i.e., seasonal factor excluded/higher n_win used).");
    } else if (Math.abs(tau_actual - tau_if_wrong) < 0.01) {
        console.log("⚠️ Verification FAILED: Tau matches Balance calculation exactly. Separation invalid or seasonal factor not impactful?");
    } else {
        console.log("❓ Unexpected result: Tau is larger? Check logic.");
    }

    // [New] Verification for Non-Usage Ventilation Logic
    // Scenario: Mechanical Ventilation active (Usage) vs Inactive (Non-Usage/Weekend)
    // We expect QV_we (Weekend) < QV_nutz (Weekday) per day if Mech is active.

    // 1. Setup Zone with Mechanical Ventilation and Weekend Setback
    const zoneMechSetback: ZoneInput = {
        id: 'zone-mech-setback',
        projectId: 'test-project',
        name: 'Mechanical Setback Zone',
        usageType: '42_res_single', // Residential
        area: 100,
        height: 3,
        volume: 300,
        surfaces: [], // [Fixed] Added missing property
        temperatureSetpoints: { heating: 20, cooling: 24 },
        heatingReducedMode: 'setback', // Enable setback
        ventilationMode: 'mechanical'
    };

    const mechSystem: Project['systems'] = [{
        id: 'ahu-1',
        type: 'AHU',
        name: 'AHU',
        projectId: 'test-project',
        isShared: true,
        heatRecovery: { heatingEfficiency: 0.8, coolingEfficiency: 0.8, type: 'plate' }, // High efficiency
        airflow: 1000,
        fanPower: 1.5
    }];

    const profileSetback: UsageProfile = {
        ...DIN_18599_PROFILES['42_res_single'],
        annualUsageDays: 260, // 5 days/week -> 2 days weekend
        hvacDailyOperationHours: 10,
        minOutdoorAir: 0 // Force calc based on usage
        // defined values: metabolic 80, equip 60
    };

    // Mock Monthly Indices (Pre-processed)
    // We need to match MonthlyClimateIndices interface: { month, Te_avg, ... }
    // But wait, MonthlyClimateIndices is internal? Or exported?
    // It's likely exported or we can just mock the shape if we know it.
    // Let's assume the loop uses d.Te_avg and d.surfaceInsolation.

    // We need to import MonthlyClimateIndices or look at its definition.
    // It's likely in types.ts or calculator.ts.
    // Step 553 showed: processMonthlyWeather returns it.
    // Let's just create an object that satisfies the find() in calculator.

    const mockIndices = [{
        month: 1,
        Te_avg: -5,
        surfaceInsolation: {} // Empty for now
    }];

    // 2. Run Calculation (Case A: 260 days)
    const resultA = calculateZoneMonthly(
        zoneMechSetback, // has annualUsageDays = 260
        mockIndices as any,
        undefined, undefined, undefined, undefined,
        mechSystem
    );

    if (!resultA) {
        console.log("❌ Failed to calculate resultA.");
        return;
    }

    const H_ve_260 = resultA.monthly[0].H_ve!;

    // 3. Run Calculation (Case B: 365 days - Always Usage)
    // We can't easily modify the profile inside calculateZoneMonthly as it looks it up.
    // But we can modify the imported profile? No, that's global.
    // We can pass a zone with a different usageType that maps to a customized profile?
    // Or we can hack: The profile is looked up via DIN_18599_PROFILES[zone.usageType].
    // If we define a CUSTOM usage type in the map?
    // Or, we assume calculateZoneMonthly uses the profile we passed?
    // No, calculateZoneMonthly: const profile = DIN_18599_PROFILES[zone.usageType] ...

    // Check if we can overwrite the profile lookup?
    // Actually, for testing, we can modify the global object temporarily.

    const originalProfile = DIN_18599_PROFILES['42_res_single'];
    DIN_18599_PROFILES['42_res_single_365'] = {
        ...originalProfile,
        annualUsageDays: 365,
        hvacDailyOperationHours: 10
    };

    const zoneMech365: ZoneInput = {
        ...zoneMechSetback,
        id: 'zone-mech-365',
        usageType: '42_res_single_365' as any // Cast to bypass enum check
    };

    const resultB = calculateZoneMonthly(
        zoneMech365,
        mockIndices as any,
        undefined, undefined, undefined, undefined,
        mechSystem
    );

    if (!resultB) {
        console.log("❌ Failed to calculate resultB.");
        return;
    }

    const H_ve_365 = resultB.monthly[0].H_ve!;

    console.log(`H_ve (260 days - Weekend Off): ${H_ve_260.toFixed(2)}`);
    console.log(`H_ve (365 days - Always On): ${H_ve_365.toFixed(2)}`);

    if (Math.abs(H_ve_260 - H_ve_365) > 0.1) {
        console.log("✅ Verification PASSED: H_ve differs between Usage and Non-Usage scenarios.");
        console.log("   Difference implies split logic is working.");
    } else {
        console.log("❌ Verification FAILED: H_ve is identical. Usage/Non-Usage split logic might not be effective.");
    }

}

runTest();
