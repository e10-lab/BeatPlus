import { Layer } from "@/types/project";
import { DEFAULT_MATERIALS } from "./materials";

// Material IDs from materials.ts
const MAT_GLASS_STD = "mat_glass_std";
const MAT_GLASS_LOWE = "mat_glass_lowe";
const MAT_GLASS_LOWE_SOFT = "mat_glass_lowe_soft";
const MAT_GAS_AIR = "mat_gas_air";
const MAT_GAS_ARGON = "mat_gas_argon";

const LOW_E_MATERIALS = [MAT_GLASS_LOWE, MAT_GLASS_LOWE_SOFT];
const ARGON_MATERIALS = [MAT_GAS_ARGON];

interface SHGCData {
    shgc: number;
    // vlt: number; // Visible Light Transmittance (not converting for now as not requested)
}

// Map structure: [GlassCount][GasType][Thickness][GlassType] -> SHGC
// GlassCount: 2 (Double), 3 (Triple), 4 (Quad)
// GasType: 'air', 'argon'
// Thickness: 6, 12, 16 (mm)
// GlassType: 'general', 'lowe'

type GlassType = "general" | "lowe";
type GasType = "air" | "argon";
type Thickness = 6 | 12 | 16;
type LayerCount = 2 | 3 | 4;

// Table Data Source
const SHGC_TABLE: Record<LayerCount, Record<GasType, Record<Thickness, Record<GlassType, number>>>> = {
    // Double Glazing (2 Glass Layers)
    2: {
        air: {
            6: { general: 0.717, lowe: 0.577 },
            12: { general: 0.719, lowe: 0.581 },
            16: { general: 0.719, lowe: 0.583 }
        },
        argon: {
            6: { general: 0.718, lowe: 0.579 },
            12: { general: 0.720, lowe: 0.583 },
            16: { general: 0.720, lowe: 0.584 }
        }
    },
    // Triple Glazing (3 Glass Layers)
    3: {
        air: {
            6: { general: 0.631, lowe: 0.526 },
            12: { general: 0.633, lowe: 0.520 },
            16: { general: 0.634, lowe: 0.518 }
        },
        argon: {
            6: { general: 0.633, lowe: 0.523 },
            12: { general: 0.634, lowe: 0.517 },
            16: { general: 0.635, lowe: 0.515 }
        }
    },
    // Quadruple Glazing (4 Glass Layers)
    4: {
        air: {
            6: { general: 0.563, lowe: 0.484 },
            12: { general: 0.565, lowe: 0.474 },
            16: { general: 0.565, lowe: 0.471 }
        },
        argon: {
            6: { general: 0.564, lowe: 0.479 },
            12: { general: 0.565, lowe: 0.468 },
            16: { general: 0.566, lowe: 0.466 }
        }
    }
};

export function calculateSHGC(layers: Layer[]): number {
    // 1. Identify Layers
    let glassCount = 0;
    let hasLowE = false;
    let hasArgon = false;
    let gasThicknessSum = 0;
    let gasLayerCount = 0;

    for (const layer of layers) {
        const mat = DEFAULT_MATERIALS.find(m => m.id === layer.materialId);
        if (!mat) continue; // Should not happen

        if (mat.category === 'glass' || mat.category === 'door') {
            // Note: Door materials might be generic "Single Sash Door", 
            // but if user builds custom door with Glass layers, this logic applies.
            // If user uses "Single Sash Door" material (which is a composite), we cannot count layers easily inside it.
            // Assuming this logic applies to "Window" construction composed of Glass + Gas layers.
            // If layer.materialId is literally a glass material:
            if (mat.category === 'glass') {
                glassCount++;
                if (LOW_E_MATERIALS.includes(layer.materialId)) {
                    hasLowE = true;
                }
            }
        } else if (mat.category === 'gas' || mat.category === 'air') {
            // Check if it's Argon
            if (ARGON_MATERIALS.includes(layer.materialId)) {
                hasArgon = true;
            }
            // Add thickness (mm)
            gasThicknessSum += layer.thickness * 1000;
            gasLayerCount++;
        }
    }

    // 2. Validate Layer Count
    // Supported: 2 (Double), 3 (Triple), 4 (Quad)
    if (glassCount < 2 || glassCount > 4) {
        return 0;
    }

    // 3. Determine Gas Thickness
    // Gas thickness in table is per gap.
    // If double glazing (2 glass), there is 1 gas gap.
    // If triple glazing (3 glass), there are 2 gas gaps.
    // Usually gaps are equal. We calculate average gap.
    if (gasLayerCount === 0) return 0; // No gap? Not valid insulated glass.

    // In strict construction, Double = Glass-Gas-Glass. (1 gas layer).
    // Triple = Glass-Gas-Glass-Gas-Glass. (2 gas layers).
    // Let's use average thickness.
    const averageGap = gasThicknessSum / gasLayerCount;

    // Map to closest standard thickness (6, 12, 16) with some tolerance
    let mappedThickness: Thickness | null = null;

    // Simple closest match logic or exact match?
    // User said "If configuration not in picture, 0".
    // "12mm" implies exactly around 12mm.
    // Let's allow small tolerance (+- 2mm?)
    if (Math.abs(averageGap - 6) <= 2) mappedThickness = 6;
    else if (Math.abs(averageGap - 12) <= 2) mappedThickness = 12;
    else if (Math.abs(averageGap - 16) <= 2) mappedThickness = 16;

    if (!mappedThickness) return 0;

    // 4. Lookup
    const glassType: GlassType = hasLowE ? 'lowe' : 'general';
    const gasType: GasType = hasArgon ? 'argon' : 'air';
    const count = glassCount as LayerCount;

    try {
        const shgc = SHGC_TABLE[count][gasType][mappedThickness][glassType];
        return shgc;
    } catch (e) {
        console.error("SHGC Lookup failed for", { count, gasType, mappedThickness, glassType });
        return 0;
    }
}
