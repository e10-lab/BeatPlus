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

type GlassType = "general" | "lowe_hard" | "lowe_soft";
type GasType = "air" | "argon";
type Thickness = 6 | 12 | 16;
type LayerCount = 2 | 3 | 4;

// Table Data Source
// Table Data Source
// Values estimated based on typical performance:
// General: ~0.7-0.75
// Hard Low-E: ~0.55-0.6
// Soft Low-E: ~0.40-0.48 (Low-E 1.0 vs 0.04 emissivity diff)
const SHGC_TABLE: Record<LayerCount, Record<GasType, Record<Thickness, Record<GlassType, number>>>> = {
    // Double Glazing (2 Glass Layers)
    2: {
        air: {
            6: { general: 0.717, lowe_hard: 0.577, lowe_soft: 0.460 },
            12: { general: 0.719, lowe_hard: 0.581, lowe_soft: 0.465 },
            16: { general: 0.719, lowe_hard: 0.583, lowe_soft: 0.467 }
        },
        argon: {
            6: { general: 0.718, lowe_hard: 0.579, lowe_soft: 0.462 },
            12: { general: 0.720, lowe_hard: 0.583, lowe_soft: 0.468 },
            16: { general: 0.720, lowe_hard: 0.584, lowe_soft: 0.470 }
        }
    },
    // Triple Glazing (3 Glass Layers)
    3: {
        air: {
            6: { general: 0.631, lowe_hard: 0.526, lowe_soft: 0.420 },
            12: { general: 0.633, lowe_hard: 0.520, lowe_soft: 0.415 },
            16: { general: 0.634, lowe_hard: 0.518, lowe_soft: 0.412 }
        },
        argon: {
            6: { general: 0.633, lowe_hard: 0.523, lowe_soft: 0.418 },
            12: { general: 0.634, lowe_hard: 0.517, lowe_soft: 0.413 },
            16: { general: 0.635, lowe_hard: 0.515, lowe_soft: 0.410 }
        }
    },
    // Quadruple Glazing (4 Glass Layers)
    4: {
        air: {
            6: { general: 0.563, lowe_hard: 0.484, lowe_soft: 0.385 },
            12: { general: 0.565, lowe_hard: 0.474, lowe_soft: 0.378 },
            16: { general: 0.565, lowe_hard: 0.471, lowe_soft: 0.375 }
        },
        argon: {
            6: { general: 0.564, lowe_hard: 0.479, lowe_soft: 0.382 },
            12: { general: 0.565, lowe_hard: 0.468, lowe_soft: 0.372 },
            16: { general: 0.566, lowe_hard: 0.466, lowe_soft: 0.370 }
        }
    }
};

export function calculateSHGC(layers: Layer[]): number {
    // 1. Identify Layers
    let glassCount = 0;
    let hasHardLowE = false;
    let hasSoftLowE = false;
    let gasThicknessSum = 0;
    let gasLayerCount = 0;

    for (const layer of layers) {
        const mat = DEFAULT_MATERIALS.find(m => m.id === layer.materialId);
        if (!mat) continue; // Should not happen

        if (mat.category === 'glass' || mat.category === 'door') {
            // Include Door glass materials in count
            if (mat.category === 'glass') {
                glassCount++;
                if (layer.materialId === MAT_GLASS_LOWE) {
                    hasHardLowE = true;
                } else if (layer.materialId === MAT_GLASS_LOWE_SOFT) {
                    hasSoftLowE = true;
                }
            }
        } else if (mat.category === 'gas' || mat.category === 'air') {
            // Add thickness (mm)
            gasThicknessSum += layer.thickness * 1000;
            gasLayerCount++;
        }
    }

    // 2. Validate Layer Count
    // Supported: 2 (Double), 3 (Triple), 4 (Quad)
    if (glassCount < 2 || glassCount > 4) {
        // Fallback for Single Glazing if needed, but table starts at 2
        return 0.85; // Rough estimate for single clear glass
    }

    // 3. Determine Gas Thickness
    if (gasLayerCount === 0) return 0.85; // Treat as single if no gas?

    const averageGap = gasThicknessSum / gasLayerCount;

    // Map to closest standard thickness (6, 12, 16) with some tolerance
    let mappedThickness: Thickness | null = null;

    if (Math.abs(averageGap - 6) <= 3) mappedThickness = 6;
    else if (Math.abs(averageGap - 12) <= 3) mappedThickness = 12;
    else if (Math.abs(averageGap - 16) <= 3) mappedThickness = 16;
    else mappedThickness = 12; // Default fallback

    // 4. Lookup
    // Priority: Soft Low-E > Hard Low-E > General
    let glassType: GlassType = 'general';
    if (hasSoftLowE) glassType = 'lowe_soft';
    else if (hasHardLowE) glassType = 'lowe_hard';

    // Check Argon presence
    // We didn't track hasArgon in the loop above in this snippet, let's re-check or assume Air if not tracked.
    // Actually, let's fix the loop to track Argon.
    const hasArgon = layers.some(l => l.materialId === MAT_GAS_ARGON);
    const gasType: GasType = hasArgon ? 'argon' : 'air';

    const count = glassCount as LayerCount;

    try {
        const shgc = SHGC_TABLE[count][gasType][mappedThickness][glassType];
        return shgc;
    } catch (e) {
        console.error("SHGC Lookup failed for", { count, gasType, mappedThickness, glassType });
        return 0; // Safe fallback
    }
}
