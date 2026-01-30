
import { calculateEnergyDemand } from '../src/engine/calculator';
import { ZoneInput } from '../src/engine/types';
import { Surface } from '../src/types/project';

// --- Helper to Create Zones ---
function createZone(name: string, overrides: Partial<ZoneInput> = {}, surfaceOverrides: Partial<Surface> = {}): ZoneInput {
    const defaultSurface: Surface = {
        id: `s-${name}`, zoneId: name, name: 'South Window', type: 'window',
        area: 20, uValue: 1.5, orientation: 'S', tilt: 90, shgc: 0.6,
        shading: { hasDevice: false, fcValue: 1.0 }
    };

    return {
        id: name,
        projectId: 'proj-1',
        name: name,
        usageType: '1_single_office', // Usage: 11h/day, 250d/yr. Setback 4K.
        area: 100,
        height: 3,
        volume: 300,
        temperatureSetpoints: { heating: 20, cooling: 26 },
        thermalCapacitySpecific: 50 * 50, // Medium Mass (~50 Wh/m2K)
        surfaces: [{ ...defaultSurface, ...surfaceOverrides }],
        isExcluded: false,
        ...overrides
    };
}

// --- Test Cases ---

// 1. Shading Logic
const caseBase = createZone('Base');
const caseShaded = createZone('Shaded', {}, {
    shading: { hasDevice: true, fcValue: 0.25 } // Exterior Blind
});

// 2. Cooling Ventilation (Eq 91)
// Need High Gains and valid Fan.
const coolingVentUnit = {
    id: 'ahu-1', projectId: 'proj-1', name: 'AHU', type: 'balanced',
    efficiency: 0.75, supplyFlowRate: 0, exhaustFlowRate: 0
};
const caseFreeCool = createZone('FreeCool', {
    // usageType: '21_datacenter', // Replaced by 9_lecture_hall below
    // Let's stick to Office but override internal gains if possible? 
    // Types don't allow easy override of metabolicHeat.
    // Use '9_lecture_hall' (High Density)
    usageType: '9_lecture_hall',
    linkedVentilationUnitIds: ['ahu-1']
});

// 3. Day/Night Lighting
const caseWindow = createZone('Daylight', {}, { type: 'window' });
const caseNoWindow = createZone('NoDaylight', {}, { type: 'wall_exterior' }); // Opaque

// 4. Intermittent Heating (Structure Mass)
// Realistic values per DIN 18599-2 Table 9 approx:
// Light: ~15-50 Wh/m2K | Heavy: ~130-260 Wh/m2K
const caseLight = createZone('LightMass', { thermalCapacitySpecific: 15 });
const caseHeavy = createZone('HeavyMass', { thermalCapacitySpecific: 150 });

// --- Run Simulations ---
console.log("=== 1. Solar Shading Verification ===");
const resBase = calculateEnergyDemand([caseBase]);
const resShaded = calculateEnergyDemand([caseShaded]);
console.log(`Base Solar Gain (Jan): ${resBase.monthly[0].QS.toFixed(1)} kWh`);
console.log(`Shaded Solar Gain (Jan): ${resShaded.monthly[0].QS.toFixed(1)} kWh`);
console.log(`Reduction: ${((1 - resShaded.monthly[0].QS / resBase.monthly[0].QS) * 100).toFixed(1)}% (Expected ~75% if simple math, but g_eff has other factors)`);

console.log("\n=== 2. Cooling Load Ventilation (Eq 91) ===");
// Eq 91 triggers when Te < Ti_c - 2 (e.g. May in Seoul: Te=19.5, Ti_c=26)
const resFreeCool = calculateEnergyDemand([caseFreeCool], undefined, undefined, undefined, [coolingVentUnit as any]);
const may = resFreeCool.monthly[4];
console.log(`May (Te=19.5):`);
console.log(`- Vent Loss (QV): ${may.QV.toFixed(1)} kWh (Should be high due to free cooling boost)`);
console.log(`- Cooling (Qc): ${may.Q_cooling.toFixed(1)} kWh`);
// Compare with Jan (Te=-1.6, Minimal Vent)
const jan = resFreeCool.monthly[0];
console.log(`Jan (Te=-1.6):`);
console.log(`- Vent Loss (QV): ${jan.QV.toFixed(1)} kWh`);

console.log("\n=== 3. Day/Night Lighting ===");
const resWin = calculateEnergyDemand([caseWindow]);
const resNoWin = calculateEnergyDemand([caseNoWindow]);
const qiWin = resWin.monthly[0].QI;
const qiNoWin = resNoWin.monthly[0].QI;
console.log(`Internal Gain w/ Window: ${qiWin.toFixed(1)} kWh`);
console.log(`Internal Gain No Window: ${qiNoWin.toFixed(1)} kWh`);
console.log(`Diff: ${(qiNoWin - qiWin).toFixed(1)} kWh (Daylight Saving)`);

console.log("\n=== 4. Intermittent Heating (Structure Mass) ===");
const resLight = calculateEnergyDemand([caseLight]);
const resHeavy = calculateEnergyDemand([caseHeavy]);
const qhLight = resLight.yearly.heatingDemand;
const qhHeavy = resHeavy.yearly.heatingDemand;
console.log(`Heating Demand (Light Mass): ${qhLight.toFixed(1)} kWh/a`);
console.log(`Heating Demand (Heavy Mass): ${qhHeavy.toFixed(1)} kWh/a`);
console.log(`Saving: ${(qhLight - qhHeavy).toFixed(1)} kWh`);
if (qhHeavy < qhLight) console.log("SUCCESS: Heavy mass saves energy.");
else console.log("FAIL: Heavy mass did not save energy.");

