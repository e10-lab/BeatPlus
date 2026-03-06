
import { calculateEnergyDemand } from '../calculator';
import { ZoneInput } from '../types';
import { Project } from '../../types/project';

async function runTest() {
    console.log("Verifying Δθ_EMS Impact on Effective Temperature and Heating Demand...");

    const baseZone: ZoneInput = {
        id: 'test-zone',
        projectId: 'test-project',
        name: 'Test Office',
        usageType: '1_office',
        area: 1000,
        height: 3,
        volume: 3000,
        surfaces: [
            { id: 'wall1', type: 'wall_exterior', area: 500, uValue: 0.2, fx: 1.0 },
            { id: 'win1', type: 'window', area: 100, uValue: 1.2, fx: 1.0, shgc: 0.5 } as any
        ],
        temperatureSetpoints: { heating: 20, cooling: 24 },
        ventilationMode: 'natural'
    } as any;

    const mockClimate = {
        monthly: Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            Te: -5, // Cold winter
            Is_Horiz: 20,
            phi: 50,
            windSpeed: 3
        })),
        latitude: 37.5,
        stationName: "Mock"
    };

    // Case 1: No Automation (Category C/D or undefined)
    const resultsD = calculateEnergyDemand([baseZone], mockClimate as any, undefined, undefined, undefined, undefined);
    const heatingD = resultsD.zones[0].monthly[0].Q_h_b;
    const Ti_h_op_D = resultsD.zones[0].monthly[0].Theta_i_h_op;

    // Case 2: Automation Class A (Delta_theta_EMS = 0.5)
    const automationA: Project['automationConfig'] = {
        automationClass: 'A',
        heatingControl: 'electronic_pi',
        heatingTempControl: 'auto_adapt'
    } as any;

    const resultsA = calculateEnergyDemand([baseZone], mockClimate as any, undefined, undefined, undefined, automationA);
    const heatingA = resultsA.zones[0].monthly[0].Q_h_b;
    const Ti_h_op_A = resultsA.zones[0].monthly[0].Theta_i_h_op;

    console.log(`\nResults comparison:`);
    console.log(`Class D (None) -> Ti_h_op: ${Ti_h_op_D?.toFixed(2)} °C, Heating: ${heatingD.toFixed(0)} kWh`);
    console.log(`      Breakdown -> Op: ${resultsD.zones[0].monthly[0].Q_h_b_op?.toFixed(0)} kWh, Non-Op: ${resultsD.zones[0].monthly[0].Q_h_b_non_op?.toFixed(0)} kWh`);
    console.log(`      Storage Transfer: ${resultsD.zones[0].monthly[0].Q_storage_transfer?.toFixed(0)} kWh`);

    console.log(`Class A (High) -> Ti_h_op: ${Ti_h_op_A?.toFixed(2)} °C, Heating: ${heatingA.toFixed(0)} kWh`);
    console.log(`      Breakdown -> Op: ${resultsA.zones[0].monthly[0].Q_h_b_op?.toFixed(0)} kWh, Non-Op: ${resultsA.zones[0].monthly[0].Q_h_b_non_op?.toFixed(0)} kWh`);
    console.log(`      Storage Transfer: ${resultsA.zones[0].monthly[0].Q_storage_transfer?.toFixed(0)} kWh`);

    const tempDiff = (Ti_h_op_D || 0) - (Ti_h_op_A || 0);
    console.log(`Effective Temperature Gap: ${tempDiff.toFixed(2)} K`);

    // The gap is expected to be around ~0.35K because:
    // 1. Delta_theta_EMS reduces setpoint by 0.5K (Lower temp)
    // 2. f_adapt reduces the setback factor f_NA by 10% (Higher temp / Less drop)
    // Combined result is a net decrease in temperature and a significant decrease in energy.
    if (tempDiff > 0.3) {
        console.log("✅ PASSED: Effective temperature decreased significantly (Combined EMS + Adaptive Control).");
    } else {
        console.log("❌ FAILED: Effective temperature reduction impact is too low.");
    }

    if (heatingA < heatingD) {
        console.log("✅ PASSED: Heating energy demand decreased as expected.");
    } else {
        console.log("❌ FAILED: Heating energy demand did not decrease.");
    }
}

runTest().catch(console.error);
