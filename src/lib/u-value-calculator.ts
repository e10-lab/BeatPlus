import { Layer } from "@/types/project";
import { DEFAULT_MATERIALS } from "@/lib/materials";

// Frame Types: metal_no_break, metal_break, plastic_wood
export type FrameType = "metal_no_break" | "metal_break" | "plastic_wood";

// Helper to pick value based on frame and gap
const pickValue = (row: number[], frameId: string, gap: number): number => {
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
        low_ratio: [3.20, 3.10, 3.00, 3.00, 2.90, 2.80, 2.70, 2.60, 2.50],
        high_ratio: [3.80, 3.50, 3.40, 3.30, 3.10, 3.00, 3.00, 2.80, 2.70],
    }
};

// Internal Logic reused for Window and Door
const getWindowLookupValue = (layers: Layer[], fid: FrameType): number | null => {
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
    const hasArgon = gasLayers.some(l => l.materialId.includes("argon"));

    const hasLowEHard = glassLayers.some(l => l.materialId === "mat_glass_lowe");
    const hasLowESoft = glassLayers.some(l => l.materialId === "mat_glass_lowe_soft");

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

    if (!tableSet) return null;

    const row = (tableSet as any)[typeKey];
    if (!row) return null;

    return pickValue(row, fid, minGap);
};

export const calculateStandardUValue = (
    category: "window" | "door",
    frameId: string | undefined, // frameId from form
    layers: Layer[]
): number | null => {
    if (!frameId) return null;

    // safe cast frameId
    const fid = frameId as FrameType;
    if (!['metal_no_break', 'metal_break', 'plastic_wood'].includes(fid)) return null;

    // First, TRY Window Logic for both Window AND Door (if it has glass layers)
    const windowValue = getWindowLookupValue(layers, fid);
    if (windowValue !== null) {
        return windowValue;
    }

    // Fallback: Door Specific Logic (For non-standard glass formations or solid doors)
    // If it's a door and window logic failed (meaning no glass or weird config),
    // check if it's one of the preset door types.
    if (category === "door") {
        if (layers.length === 0) return null;
        const firstMatId = layers[0].materialId;

        // 1. General Door
        if (firstMatId === "door_gen_thin") {
            const vals = DOOR_DATA.general.low_insul;
            if (fid === "metal_no_break") return vals[0];
            if (fid === "metal_break") return vals[1];
            return vals[2];
        }
        if (firstMatId === "door_gen_thick") {
            const vals = DOOR_DATA.general.high_insul;
            if (fid === "metal_no_break") return vals[0];
            if (fid === "metal_break") return vals[1];
            return vals[2];
        }

        // Note: Glass Door types (Double sash logic etc) might be covered by window logic now
        // if the user builds them with actual glass layers.
        // But the "preset" Double Sash in the UI sets [Door, Air, Door], where "Door" is a material "door_double_low_glass".
        // These materials have category='door', NOT 'glass'.
        // So `getWindowLookupValue` will see 0 glass layers and return null.
        // Thus we still neeed logic for the "Preset Double Sash" which uses special door materials.

        // 2. Single Sash Door
        if (firstMatId === "door_single_low_glass") { // < 50%
            const vals = DOOR_DATA.glass_single.low_ratio;
            if (fid === "metal_no_break") return vals[0];
            if (fid === "metal_break") return vals[1];
            return vals[2];
        }
        if (firstMatId === "door_single_high_glass") { // >= 50%
            const vals = DOOR_DATA.glass_single.high_ratio;
            if (fid === "metal_no_break") return vals[0];
            if (fid === "metal_break") return vals[1];
            return vals[2];
        }

        // 3. Glass Door Double (The "Preset" logic)
        // If the user uses the "Double Sash Door" preset, the layers are [door_double_..., air, door_double...].
        // This is NOT standard glass layers. So we use the Door Table values here.
        // HOWEVER, the user asked to "use the same values as windows" for Doors.
        // But for the "Double Sash Preset", we don't have distinct Glass/LowE coating info encoded in "door_double_low_glass".
        // The material "door_double_low_glass" is generic. 
        // IF the user wants Window values, they should probably build it with Glass+Gas layers?
        // OR, does the user mean even for the "Double Sash Preset", we should map it to some Window value?
        // But "Double Sash Door" usually implies "Double Window" (Bok-cheung).
        // Let's stick to the specific table values for these "Preset" types as they are explicit in the standard.
        // The user likely meant: "If I build a door with glass/gas layers (Custom Glass Door), treat it as a window".
        // Example: User adds 3 layers: Low-E Glass, Argon, Low-E Glass. -> This should be calculated as a Triple Window.
        // My `getWindowLookupValue` handles exactly that because it looks for category="glass".

        if (firstMatId === "door_double_low_glass") { // Logic: < 50%
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
    }

    return null;
};
