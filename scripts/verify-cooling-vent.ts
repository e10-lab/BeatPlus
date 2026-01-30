
import { calculateEnergyDemand } from '../src/engine/calculator';
import { ZoneInput } from '../src/engine/types';
import { Surface } from '../src/types/project';

// Mock Data Structure
const mockZone: ZoneInput = {
    id: 'zone-1',
    projectId: 'proj-1',
    name: 'Office Zone',
    usageType: '1_single_office', // High internal load
    area: 100,
    height: 3,
    volume: 300,
    temperatureSetpoints: { heating: 20, cooling: 26 },
    surfaces: [],
    isExcluded: false,
    linkedVentilationUnitIds: ['ahu-1']
};

const mockUnit = {
    id: 'ahu-1',
    projectId: 'proj-1',
    name: 'AHU',
    type: 'balanced',
    heatRecoveryEfficiency: 0, // No heat recovery for cooling test (simplifies)
    supplyFlowRate: 0, // Allow auto-sizing
    exhaustFlowRate: 0
};

const mockWindow: Surface = {
    id: 'win-1',
    zoneId: 'zone-1',
    name: 'South Window',
    type: 'window',
    area: 30, // Large window for solar gain
    uValue: 1.5,
    orientation: 'S',
    tilt: 90,
    shgc: 0.7,
    shading: { hasDevice: false, fcValue: 1.0 }
};

mockZone.surfaces = [mockWindow];

console.log("--- Running Cooling Ventilation Verification (Eq 91) ---");

// We need to inspect the internal n_mech_design or resulting QV/Qc.
// Since calculateEnergyDemand returns MonthlyResult, we can check QV (Ventilation Loss) and Qc (Cooling Demand).
// If Eq 91 works, QV should be higher in cooling months (e.g. May/Jun/Sep) where Te < 26.
// And Qc should be lower compared to a case where we force low ventilation?
// To test strictly, we can compare two runs:
// 1. Normal Run (Eq 91 active)
// 2. Run with n_mech restricted? We can't restrict it from outside easily without modifying code or config.
// However, we can check if QV is exceptionally high in specific months.

const result = calculateEnergyDemand([mockZone], undefined, undefined, undefined, [mockUnit as any]);

// Find a month where Te < 26 but Solar is high.
// Korean weather (Seoul):
// May (5): Temp 19.5, Solar 158. Perfect.
// June (6): Temp 23.5, Solar 153. Good.
// July (7): Temp 26.5. Too hot (Te > Ti_c - 2), Eq 91 inactive.

const may = result.monthly[4]; // Month 5
console.log(`May (Te=19.5, Solar=158):`);
console.log(`- PV (Ventilation Loss): ${may.QV.toFixed(2)} kWh`);
console.log(`- PH (Heating Demand): ${may.Q_heating.toFixed(2)} kWh`);
console.log(`- PC (Cooling Demand): ${may.Q_cooling.toFixed(2)} kWh`);
console.log(`- Gains (Solar+Int): ${may.Qgain.toFixed(2)} kWh`);

const june = result.monthly[5]; // Month 6
console.log(`June (Te=23.5, Solar=153):`);
console.log(`- PV (Ventilation Loss): ${june.QV.toFixed(2)} kWh`);
console.log(`- PC (Cooling Demand): ${june.Q_cooling.toFixed(2)} kWh`);

// Baseline Calculation (Hand Calc Logic Check)
// Volume = 300 m3.
// Min Hygiene ~ 30 m3/h/person? Or area based.
// If QV is > 1000 kWh in May (744 hours), avg Power = 1.3 kW.
// Delta T = 26 - 19.5 = 6.5 K.
// H_ve = 1300 W / 6.5 = 200 W/K.
// V = 200 / 0.34 = 588 m3/h.
// 588 m3/h is ~ 2 ACH.
// Normal hygiene is usually ~0.5 ACH.
// So if we see ~2 ACH equivalent, it's working.

// Let's derive V_eff from QV
// QV = H_ve * (Ti - Te) * t / 1000
// But wait, QV displayed in result is based on (Ti - Te) for HEATING?
// No, result.QV is calculated as H_ve * (Ti - Te) * t.
// In May, Ti=20, Te=19.5. Delta ~ 0.5.
// QV might be small if referenced to Heating Setpoint.
// BUT for Cooling calc, the logic uses H_ve for Cooling Sink?
// In calculator.ts: Q_sink = H_total * (Ti - Te).
// This is used for Heating Demand Qh.
// For Cooling Qc, it uses Q_sink_c = H_total * (Ti_c - Te).
// But `monthlyResults` output structure only stores `QV` based on Heating Setpoint?
// result.QV = (H_ve * (Ti - Te) * hours / 1000);
// This is not useful for verifying Cooling Ventilation magnitude if Ti ~ Te.

// However, we can start the verification by checking if Qc is 0 or low, meaning ventilation killed the load.
// And checking if `warnings` array appears (I removed warnings for shortage, but maybe I can add a log?)

// Better: Compare May Qc vs July Qc.
// In July (Te=26.5 > 24), Free Cooling is impossible. Qc should be high.
// In May (Te=19.5), Free Cooling is possible. Qc should be low/zero.

const july = result.monthly[6];
console.log(`July (Te=26.5): Cooling Demand = ${july.Q_cooling.toFixed(2)} kWh`);

if (may.Q_cooling < july.Q_cooling && may.Q_cooling < 100) {
    console.log("SUCCESS: Cooling load in May is significantly reduced/eliminated via Ventilation.");
} else {
    console.log("FAILURE? May Cooling Demand is still high.");
}
