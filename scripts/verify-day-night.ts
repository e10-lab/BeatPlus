
import { calculateEnergyDemand } from '../src/engine/calculator';
import { ZoneInput } from '../src/engine/types';
import { Surface } from '../src/types/project';

// Test Case 1: Zone with Windows (Daylight Saving Expected)
const zoneWithWindows: ZoneInput = {
    id: 'zone-win',
    projectId: 'proj-1',
    name: 'Office with Window',
    usageType: '1_office',
    area: 100,
    height: 3,
    volume: 300,
    temperatureSetpoints: { heating: 20, cooling: 26 },
    surfaces: [
        {
            id: 's1', zoneId: 'zone-win', name: 'Win', type: 'window',
            area: 20, uValue: 1.5, orientation: 'S', tilt: 90, shgc: 0.7
        } as Surface
    ],
    isExcluded: false,
    lighting: { efficacy: 50, powerDensity: 10 } // 10 W/m2
};

const lightingSystem = {
    id: 'light-1',
    projectId: 'proj-1',
    name: 'Daylight Control System',
    type: 'LIGHTING',
    isShared: true,
    lightingEfficacy: 50,
    controlType: 'daylight',
    hasConstantIlluminanceControl: false,
    linkedZoneIds: ['zone-win', 'zone-no-win']
};

// Test Case 2: Zone without Windows (No Daylight Saving)
const zoneNoWindows: ZoneInput = {
    ...zoneWithWindows,
    id: 'zone-no-win',
    name: 'Office No Window',
    surfaces: [] // No surfaces = No windows
};

console.log("--- Running Day/Night Lighting Verification ---");

const resultWin = calculateEnergyDemand([zoneWithWindows], undefined, undefined, undefined, undefined, undefined, [lightingSystem as any]);
const resultNoWin = calculateEnergyDemand([zoneNoWindows], undefined, undefined, undefined, undefined, undefined, [lightingSystem as any]);

// Check Internal Gains (QI) for a month
// QI = Q_lighting + Q_people + Q_equip
// Since Q_people/equip is identical, difference must be from Q_lighting.

const qi_win = resultWin.monthly[0].QI; // Jan
const qi_no_win = resultNoWin.monthly[0].QI;

console.log(`Internal Heat Gain (Jan):`);
console.log(`- With Windows: ${qi_win.toFixed(2)} kWh`);
console.log(`- No Windows:   ${qi_no_win.toFixed(2)} kWh`);

const diff = qi_no_win - qi_win;
console.log(`Daylight Saving Effect: ${diff.toFixed(2)} kWh`);

if (diff > 0) {
    console.log("SUCCESS: Zone with windows has lower internal heat gain due to daylight saving.");
} else {
    console.error("FAILURE: No difference detected. Check F_D implementation.");
}
