import { Layer } from "@/types/project";
import { DEFAULT_MATERIALS } from "@/lib/materials";

// Frame Types: metal_no_break, metal_break, plastic_wood
export type FrameType = "metal_no_break" | "metal_break" | "plastic_wood";

interface UValueRow {
    gap: 6 | 12 | 16;
    metal_no_break: number;
    metal_break: number;
    plastic_wood: number;
}

// Helper to pick value based on frame and gap
const pickValue = (row: number[], frameId: string, gap: number): number => {
    // row format: [Gap6_MetalNB, Gap12_MetalNB, Gap16_MetalNB,  Gap6_MetalB, Gap12_MetalB, Gap16_MetalB,  Gap6_PW, Gap12_PW, Gap16_PW]
    // ...Wait, the table format is columns by Frame, then sub-columns by Gap.
    // Let's restructure data to be simpler.

    // Simplified Data Structure:
    // keys: [MetalNB_6, MetalNB_12, MetalNB_16, MetalB_6, MetalB_12, MetalB_16, PW_6, PW_12, PW_16]
    // Values mapped by index 0-8

    let frameOffset = 0;
    if (frameId === "metal_break") frameOffset = 3;
    if (frameId === "plastic_wood") frameOffset = 6;

    let gapIndex = 0; // 6mm
    if (gap >= 16) gapIndex = 2; // 16mm+
    else if (gap >= 12) gapIndex = 1; // 12mm

    const index = frameOffset + gapIndex;
    return row[index];
};

// Window Table Data (Flat arrays corresponding to the 9 columns in the table)
// [MetalNB-6, MetalNB-12, MetalNB-16, MetalB-6, MetalB-12, MetalB-16, PW-6, PW-12, PW-16]
const WINDOW_DATA = {
    // Double Glazing (2 Glass)
    double: {
        general: [4.0, 3.7, 3.6, 3.7, 3.4, 3.3, 3.1, 2.8, 2.7],
        lowe_hard: [3.6, 3.1, 2.9, 3.3, 2.8, 2.6, 2.7, 2.3, 2.1],
        lowe_soft: [3.5, 2.9, 2.7, 3.2, 2.6, 2.4, 2.6, 2.1, 1.9],
        argon: [3.8, 3.6, 3.5, 3.5, 3.3, 3.2, 2.9, 2.7, 2.6],
        argon_lowe_hard: [3.3, 2.9, 2.8, 3.0, 2.6, 2.5, 2.5, 2.1, 2.0],
        argon_lowe_soft: [3.2, 2.7, 2.6, 2.9, 2.4, 2.3, 2.3, 1.9, 1.8],
    },
    // Triple Glazing (3 Glass)
    triple: {
        general: [3.2, 2.9, 2.8, 2.9, 2.6, 2.5, 2.4, 2.1, 2.0],
        lowe_hard: [2.9, 2.4, 2.3, 2.6, 2.1, 2.0, 2.1, 1.7, 1.6],
        lowe_soft: [2.8, 2.3, 2.2, 2.5, 2.0, 1.9, 2.0, 1.6, 1.5],
        argon: [3.1, 2.8, 2.7, 2.8, 2.5, 2.4, 2.2, 2.0, 1.9],
        argon_lowe_hard: [2.6, 2.3, 2.2, 2.3, 2.0, 1.9, 1.9, 1.6, 1.5],
        argon_lowe_soft: [2.5, 2.2, 2.1, 2.2, 1.9, 1.8, 1.8, 1.5, 1.4],
    },
    // Quadruple Glazing (4 Glass)
    quad: {
        general: [2.8, 2.5, 2.4, 2.5, 2.2, 2.1, 2.1, 1.8, 1.7],
        lowe_hard: [2.5, 2.1, 2.0, 2.2, 1.8, 1.7, 1.8, 1.5, 1.4],
        lowe_soft: [2.4, 2.0, 1.9, 2.1, 1.7, 1.6, 1.7, 1.4, 1.3],
        argon: [2.7, 2.5, 2.4, 2.4, 2.2, 2.1, 1.9, 1.7, 1.6],
        argon_lowe_hard: [2.3, 2.0, 1.9, 2.0, 1.7, 1.6, 1.6, 1.4, 1.3],
        argon_lowe_soft: [2.2, 1.9, 1.8, 1.9, 1.6, 1.5, 1.5, 1.3, 1.2],
    }
};

const SINGLE_WINDOW_VALUES = {
    metal_no_break: 6.6,
    metal_break: 6.1,
    plastic_wood: 5.3
};

// Door Data
// Format: [MetalNB, MetalB, PW] (No gap distinction mostly, except Glass Door uses same gap logic? No, Glass Door has no gap columns in table, just Ratio columns vs Frame columns? 
// Wait, looking at table bottom "Glass Door" (Yuri-mun) section:
// Columns are still "Frame Types" (MetalNB, MetalB, PW).
// But checking closely: "Glass Door" cells have 3 sub-columns?
// No, looking at row "Glass Door - Single - Ratio < 50%": 4.20 | 4.00 | 3.70.
// These correspond to the 3 main Frame columns (MetalNB, MetalB, PW).
// The "Gap" sub-columns (6, 12, 16) are merged or not applicable.
const DOOR_DATA = {
    general: {
        low_insul: [2.70, 2.60, 2.40], // < 20mm
        high_insul: [1.80, 1.70, 1.60], // >= 20mm
    },
    glass_single: {
        low_ratio: [4.20, 4.00, 3.70], // < 50%
        high_ratio: [5.50, 5.20, 4.70], // >= 50%
    },
    glass_double: {
        // Table shows range for Double? "3.20 3.10 3.00" (MetalNB), "3.00 2.90 2.80" (MetalB), "2.70 2.60 2.50" (PW) ??
        // Actually the table shows 3 numbers in the Metal-NB column for "Double Glass Door - Low Ratio"?
        // No, look at header. The header "Gap 6, 12, 16" applies to the whole column.
        // So for Glass Door Double, does Gap matter?
        // Row "Glass Door - Double - Ratio < 50%":
        // MetalNB: 3.20 | 3.10 | 3.00 (corresponding to 6, 12, 16 gap?)
        // Yes, likely Double Glass Door has gap sensitivity.
        // So we use the full 9-column logic for Double Glass Door.
        low_ratio: [3.20, 3.10, 3.00, 3.00, 2.90, 2.80, 2.70, 2.60, 2.50],
        high_ratio: [3.80, 3.50, 3.40, 3.30, 3.10, 3.00, 3.00, 2.80, 2.70],
    }
};

export const calculateStandardUValue = (
    category: "window" | "door",
    frameId: string | undefined, // frameId from form
    layers: Layer[]
): number | null => {
    // Default to 'plastic_wood' if no frame specified? Or 'metal_no_break' (conservative)?
    // Let's assume user must select frame. If undefined, return null (allow default calc).
    if (!frameId) return null;

    // safe cast frameId
    const fid = frameId as FrameType;
    if (!['metal_no_break', 'metal_break', 'plastic_wood'].includes(fid)) return null;

    if (category === "window") {
        const glassLayers = layers.filter(l => {
            const mat = DEFAULT_MATERIALS.find(m => m.id === l.materialId);
            return mat?.category === "glass";
        });
        const gasLayers = layers.filter(l => {
            const mat = DEFAULT_MATERIALS.find(m => m.id === l.materialId);
            return mat?.category === "gas" || mat?.category === "air" || l.materialId === "mat_gas_air";
        });

        const glassCount = glassLayers.length;
        if (glassCount === 0) return null;

        // Single Glazing
        if (glassCount === 1) {
            return SINGLE_WINDOW_VALUES[fid];
        }

        // Gap calculation: Min thickness of any gas layer (converted to mm)
        let minGap = 6;
        if (gasLayers.length > 0) {
            const minThk = Math.min(...gasLayers.map(l => l.thickness));
            minGap = minThk * 1000; // m to mm
        }

        // Determine Type
        const hasArgon = gasLayers.some(l => l.materialId.includes("argon")); // robust check?
        // materials.ts ids: mat_gas_argon

        const hasLowEHard = glassLayers.some(l => l.materialId === "mat_glass_lowe");
        const hasLowESoft = glassLayers.some(l => l.materialId === "mat_glass_lowe_soft");

        // Priority: Soft > Hard
        // Priority: Argon > Air

        let typeKey = "general";
        if (hasArgon) {
            if (hasLowESoft) typeKey = "argon_lowe_soft";
            else if (hasLowEHard) typeKey = "argon_lowe_hard";
            else typeKey = "argon";
        } else {
            if (hasLowESoft) typeKey = "lowe_soft";
            else if (hasLowEHard) typeKey = "lowe_hard";
            else typeKey = "general";
        }

        // Table Lookup
        let tableSet = null;
        if (glassCount === 2) tableSet = WINDOW_DATA.double;
        else if (glassCount === 3) tableSet = WINDOW_DATA.triple;
        else if (glassCount >= 4) tableSet = WINDOW_DATA.quad;

        if (!tableSet) return null; // Should check single earlier? handled.

        // @ts-ignore
        const row = tableSet[typeKey];
        if (!row) return null;

        return pickValue(row, fid, minGap);
    }

    if (category === "door") {
        // Check first layer for door type
        // The automation sets specific materials for door types.
        if (layers.length === 0) return null;
        const firstMatId = layers[0].materialId;

        // 1. General Door
        if (firstMatId === "door_general_insul_low") {
            const vals = DOOR_DATA.general.low_insul;
            // pick by frame index only (0, 1, 2)
            if (fid === "metal_no_break") return vals[0];
            if (fid === "metal_break") return vals[1];
            return vals[2];
        }
        if (firstMatId === "door_general_insul_high") {
            const vals = DOOR_DATA.general.high_insul;
            if (fid === "metal_no_break") return vals[0];
            if (fid === "metal_break") return vals[1];
            return vals[2];
        }

        // 2. Glass Door Single
        if (firstMatId === "door_glass_single") {
            // We don't have existing ratio logic in UI? 
            // "Single Glass Door" usually implies high ratio? Or we need ratio input?
            // For now, let's assume... High Ratio? Or check material name?
            // The materials list has: "door_glass_single" -> "Glass Door (Single)"
            // Let's conservative assume High Ratio (>= 50%) as it's a "Glass Door".
            // (Or maybe I should split the material into two options: Single <50, Single >=50?)
            // For this iteration, I'll default to High Ratio for "Glass Door".
            const vals = DOOR_DATA.glass_single.high_ratio;
            if (fid === "metal_no_break") return vals[0];
            if (fid === "metal_break") return vals[1];
            return vals[2];
        }

        // 3. Glass Door Double
        if (firstMatId === "door_double_low_glass") { // Logic: < 50%
            // Needs gap logic!
            const gasLayers = layers.filter(l => l.materialId === "mat_gas_air");
            let minGap = 6;
            if (gasLayers.length > 0) minGap = Math.min(...gasLayers.map(l => l.thickness)) * 1000;

            return pickValue(DOOR_DATA.glass_double.low_ratio, fid, minGap);
        }
        if (firstMatId === "door_double_high_glass") { // Logic: >= 50%
            const gasLayers = layers.filter(l => l.materialId === "mat_gas_air");
            let minGap = 6;
            if (gasLayers.length > 0) minGap = Math.min(...gasLayers.map(l => l.thickness)) * 1000;

            return pickValue(DOOR_DATA.glass_double.high_ratio, fid, minGap);
        }

        // Single "General Door"? (Not "Glass Door") - The table has "Single" row under Window...
        // Wait, "General Door" rows are "Insul < 20", "Insul >= 20".
        // What if it's just a "General Door - Single"?
        // The table basically covers "General Door" with the insulation rows.
    }

    return null;
};
