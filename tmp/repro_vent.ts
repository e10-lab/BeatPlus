
import { calculateEnergyDemand } from '../src/engine/calculator';
import { ZoneInput, ClimateData } from '../src/engine/types';

const area = 105.7;
const height = 3.4;
const Volume = area * height * 0.95; // 341.4

const zone: ZoneInput = {
    id: 'zone-1',
    name: 'Test Zone',
    usageType: '17_', // Office or similar
    area: area,
    height: height,
    temperatureSetpoints: { heating: 20, cooling: 26 },
    surfaces: [
        { id: 'surf-1', name: 'Wall', area: 100, uValue: 0.2, type: 'wall_exterior', orientation: 'S' },
        { id: 'win-1', name: 'Window', area: 20, uValue: 1.0, type: 'window', orientation: 'S', shgc: 0.5 }
    ],
    thermalBridgeMode: 0.05,
    heatingReducedMode: 'shutdown',
    coolingReducedMode: 'continuous',
    projectId: 'test-p'
};

const climate: ClimateData = {
    location: 'Seoul',
    monthly: Array(12).fill(0).map((_, i) => ({
        month: i + 1,
        Te: 2.0, // Cold month
        Is_Horiz: 50
    })),
    hourly: []
};

const systems = [
    {
        type: 'HEATING',
        linkedZoneIds: ['zone-1']
    }
];

const ventConfig = {
    type: 'mechanical',
    isMeasured: false,
    n50: 1.5,
    ventilationType: 'balanced',
    heatRecoveryEfficiency: 80
};

const results = calculateEnergyDemand(
    [{ ...zone, area: 18, height: 3.0, usageType: '4' }], // Office profile
    climate,
    'medium',
    ventConfig as any,
    [],
    null,
    systems as any,
    [],
    'monthly'
);

const jan = results.zones[0].monthly[0];
console.log('--- REPRO RESULTS ---');
console.log('Area:', area);
console.log('Height:', height);
console.log('Expected Volume (Area * h * 0.95):', Volume);
console.log('Reported V_net:', jan.V_net);
console.log('n_inf (Avg):', jan.n_inf);
console.log('--- USAGE (Op) ---');
console.log('n_win (Op):', jan.n_win);
console.log('n_mech (Op):', jan.n_mech);
console.log('H_ve_op (Bal):', jan.H_ve_op);
console.log('H_ve_tau_h_op (Tau):', jan.H_ve_tau_h_op);
console.log('V_eff_op:', jan.V_hve_op);

console.log('--- NON-USAGE (Non-Op) ---');
console.log('n_win (Non-Op):', jan.n_win_non_op);
console.log('n_mech (Non-Op):', jan.n_mech_non_op);
console.log('H_ve_non_op (Bal):', jan.H_ve_non_op);
console.log('H_ve_tau_h_non_op (Tau):', jan.H_ve_tau_h_non_op);
console.log('V_eff_non_op:', jan.V_hve_non_op);

console.log('--- MONTHLY AVG ---');
console.log('H_ve_curr (Weighted):', jan.H_ve_sys);
