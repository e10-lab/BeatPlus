
import { calculateEnergyDemand } from '../src/engine/calculator';
import { ZoneInput } from '../src/engine/types';
import { Surface } from '../src/types/project';

// Mock Data
const mockZone: ZoneInput = {
    id: 'zone-1',
    projectId: 'proj-1',
    name: 'Test Zone',
    usageType: '1_single_office',
    area: 100,
    height: 3,
    volume: 300,
    temperatureSetpoints: { heating: 20, cooling: 26 },
    surfaces: [],
    isExcluded: false
};

const mockWindow: Surface = {
    id: 'win-1',
    zoneId: 'zone-1',
    name: 'South Window',
    type: 'window',
    area: 20,
    uValue: 1.5,
    orientation: 'S',
    tilt: 90,
    shgc: 0.6,
    shading: {
        hasDevice: false,
        fcValue: 1.0 // No Shading
    }
};

mockZone.surfaces = [mockWindow];

console.log("--- Running Solar Shading Verification ---");

// Case 1: No Shading
const resultNoShading = calculateEnergyDemand([mockZone]);
const coolingNoShading = resultNoShading.yearly.coolingDemand;
console.log(`Cooling Demand (No Shading): ${coolingNoShading.toFixed(2)} kWh`);

// Case 2: With Shading (Fc = 0.25)
const mockWindowWithShading = { ...mockWindow, shading: { hasDevice: true, fcValue: 0.25 } };
const mockZoneWithShading = { ...mockZone, surfaces: [mockWindowWithShading] };

const resultShading = calculateEnergyDemand([mockZoneWithShading]);
const coolingShading = resultShading.yearly.coolingDemand;
console.log(`Cooling Demand (With Shading Fc=0.25): ${coolingShading.toFixed(2)} kWh`);

// Verification
if (coolingShading < coolingNoShading) {
    console.log("SUCCESS: Solar shading reduced cooling demand.");
    console.log(`Reduction: ${(coolingNoShading - coolingShading).toFixed(2)} kWh (${((1 - coolingShading / coolingNoShading) * 100).toFixed(1)}%)`);
} else {
    console.error("FAILURE: Solar shading did not reduce cooling demand.");
}
