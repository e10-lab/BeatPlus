
import { calculateEnergyDemand } from '../src/engine/calculator';
import { ZoneInput } from '../src/engine/types';
import { DIN_18599_PROFILES } from '../src/lib/din-18599-profiles';
import { ClimateData } from '../src/engine/types';

// Mock Data
const mockZone: ZoneInput = {
    id: 'test-zone',
    projectId: 'test-project',
    name: 'Test Zone',
    area: 100, // Fixed: area instead of floorArea
    volume: 300, // Added: volume
    height: 3,
    usageType: '1_office', // Non-residential
    temperatureSetpoints: { heating: 20, cooling: 24 },
    surfaces: [
        { id: 'w1', zoneId: 'test-zone', name: 'Wall 1', type: 'wall_exterior', area: 20, uValue: 0.2, orientation: 'S', constructionId: 'c1' },
        { id: 'w2', zoneId: 'test-zone', name: 'Window 1', type: 'window', area: 5, uValue: 1.2, orientation: 'S', constructionId: 'c2', shgc: 0.5 }
    ]
};

const mockClimate: ClimateData = {
    name: 'Test Climate',
    monthly: Array(12).fill(0).map((_, i) => ({
        month: i + 1,
        Te: i < 3 || i > 10 ? 0 : 20, // Winter 0C, Summer 20C
        Is_Horiz: 100
    }))
};

// Run Calculation
console.log("Running calculation...");
const result = calculateEnergyDemand([mockZone], mockClimate);

// Check January (Index 0) of the first zone
const zoneResult = result.zones[0];
const jan = zoneResult.monthly[0];
console.log("January Results:");
console.log("H_ve:", jan.H_ve);
console.log("H_ve_tau_h:", jan.H_ve_tau_h);
console.log("H_ve_tau_c:", jan.H_ve_tau_c);
console.log("QT:", jan.QT);
console.log("QV:", jan.QV);

// Check July (Index 6)
const jul = zoneResult.monthly[6];
console.log("July Results:");
console.log("H_ve:", jul.H_ve);
console.log("H_ve_tau_h:", jul.H_ve_tau_h);
console.log("H_ve_tau_c:", jul.H_ve_tau_c);
