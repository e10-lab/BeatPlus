import { Zone, Surface } from "@/types/project";

export interface ProjectStats {
    totalVolume: number;
    totalEnvelopeArea: number;
}

/**
 * Calculate total building volume and envelope area from zones and surfaces.
 * Note: Should receive ALL zones and their surfaces in the project.
 */
export function calculateProjectStats(zones: Zone[], allSurfaces: Surface[]): ProjectStats {
    let totalVolume = 0;
    let totalEnvelopeArea = 0;

    zones.forEach(zone => {
        if (zone.isExcluded) return;
        // Volume: If zone.volume is not set, approximate? 
        // Our app sets zone.volume on save (area * height).
        // Standard n50 refers to Net Air Volume (V_net)? 
        // User request says "Volume is building volume and sum of all zone volumes".
        // Usually Gross Volume * 0.8 or 0.7 for V_net. 
        // But user instructions imply using the "Zone Volume" directly.
        // Assuming zone.volume is the value to sum.
        totalVolume += zone.volume || (zone.area * zone.height);
    });

    // Create a set of excluded zone IDs for fast lookup
    const excludedZoneIds = new Set(zones.filter(z => z.isExcluded).map(z => z.id));

    allSurfaces.forEach(surface => {
        // Skip surface calculation if it belongs to an excluded zone
        if (surface.zoneId && excludedZoneIds.has(surface.zoneId)) return;

        // Envelope Area: Sum of areas of surfaces constituting the thermal envelope.
        // Usually Exterior Walls, Roofs, Floors (to ground/outside), Windows, Doors.
        // Interior walls/floors are usually excluded unless they border unconditioned spaces.
        // Simple logic: exclude "interior" type? or check strict types.
        // User instruction: "Building envelope area (sum of zone envelope areas)".
        // We'll count everything except purely internal components if possible.
        // Current surface types: 
        // wall_exterior, wall_ground, roof, floor_ground, floor_exterior, window, door
        // wall_interior (usually excluded if within thermal boundary)

        // Let's assume types starting with 'wall_interior' are strictly internal partitions within the thermal envelope for now?
        // But in our app 'wall_interior' sets Fx=0.5 -> Indirect. Meaning it IS an envelope part (to unheated space).
        // If it was truly internal (room to room), we usually don't model it or Fx=0.
        // So we count ALL surfaces in our Surface list as Envelope Area.
        totalEnvelopeArea += surface.area;
    });

    return { totalVolume, totalEnvelopeArea };
}

/**
 * Calculate standard n50 value based on volume and ventilation type.
 * 
 * Criteria:
 * 1. Volume <= 1500 m3:
 *    - Natural (No Mech): 4.5
 *    - Mechanical: 2.5
 * 2. Volume > 1500 m3:
 *    - Natural: q50 = 6.0 -> n50 = 6.0 * (A/V)
 *    - Mechanical: q50 = 3.0 -> n50 = 3.0 * (A/V)
 */
export function calculateStandardN50(
    totalVolume: number,
    totalEnvelopeArea: number,
    ventilationType: "natural" | "mechanical",
    category: "I" | "II" | "III" | "IV" = "I" // Default to I (New/Verified)
): number {
    if (totalVolume <= 0) return 2.0;

    // DIN/TS 18599-2:2011-09 Table 6
    const table6 = {
        "I": {
            small: { natural: 2, mechanical: 1 },  // Ref: Table 6 a) 2, b) 1
            large: { natural: 3, mechanical: 2 }   // Ref: Table 6 a) 3, b) 2
            // Note: The previous Standard Values (3.0/1.5) were slightly higher than Pure Cat I.
            // But we follow Table 6 strictly now as requested.
            // Cat I means "Verified Tightness".
            // Cat II is "New Building without verification".
        },
        "II": {
            small: 4, // n50
            large: 6  // q50
        },
        "III": {
            small: 6,
            large: 9
        },
        "IV": {
            small: 10,
            large: 15
        }
    };

    if (totalVolume <= 1500) {
        // Case A: V <= 1500 m3 -> Use n50 directly
        if (category === "I") {
            return ventilationType === "mechanical" ? 1.0 : 2.0;
        } else {
            // For Cat II, III, IV, same value for mech/natural (building property)
            // But mechanical systems usually require tightness...
            // Table 6 doesn't split by mech/nat for II-IV, just gives n50.
            return table6[category].small as number;
        }
    } else {
        // Case B: V > 1500 m3 -> Use q50 -> Convert to n50
        let q50 = 0;
        if (category === "I") {
            // @ts-ignore
            q50 = ventilationType === "mechanical" ? 2.0 : 3.0; // From Table 6 inner a/b
        } else {
            // @ts-ignore
            q50 = table6[category].large as number;
        }

        // n50 = q50 * (A / V)
        // Eq (63)
        return q50 * (totalEnvelopeArea / totalVolume);
    }
}
