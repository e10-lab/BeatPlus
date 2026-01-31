import { Zone, Surface } from "@/types/project";
import { EnergySource } from "@/types/system";

export interface ProjectStats {
    totalVolume: number;
    totalEnvelopeArea: number;
}

/**
 * Primary Energy Factors (PEF) - DIN/TS 18599:2025-10
 * These factors convert Final Energy (kWh) to Primary Energy (kWh).
 */
export const PEF_FACTORS: Record<EnergySource, number> = {
    electricity: 1.8, // Updated from 2.75 (Modern grid mix)
    natural_gas: 1.1,
    oil: 1.1,
    lpg: 1.1,
    district_heating: 0.6, // Typical modern default
    wood_pellet: 0.2,
    solar_thermal: 0.0,
    heat_pump_air: 1.8, // Driven by electricity
    heat_pump_geo: 1.8  // Driven by electricity
};

/**
 * CO2 Emission Factors (kgCO2/kWh) - DIN/TS 18599:2025-10 / GEG 2024
 */
export const CO2_FACTORS: Record<EnergySource, number> = {
    electricity: 0.380, // Updated from 0.466
    natural_gas: 0.201,
    oil: 0.266,
    lpg: 0.230,
    district_heating: 0.150,
    wood_pellet: 0.020,
    solar_thermal: 0,
    heat_pump_air: 0.380,
    heat_pump_geo: 0.380
};

/**
 * Calculate total building volume and envelope area from zones and surfaces.
 */
export function calculateProjectStats(zones: Zone[], allSurfaces: Surface[]): ProjectStats {
    let totalVolume = 0;
    let totalEnvelopeArea = 0;

    zones.forEach(zone => {
        if (zone.isExcluded) return;
        totalVolume += zone.volume || (zone.area * zone.height);
    });

    const excludedZoneIds = new Set(zones.filter(z => z.isExcluded).map(z => z.id));

    allSurfaces.forEach(surface => {
        if (surface.zoneId && excludedZoneIds.has(surface.zoneId)) return;
        totalEnvelopeArea += surface.area;
    });

    return { totalVolume, totalEnvelopeArea };
}

/**
 * Calculate standard n50 value based on volume and ventilation type.
 * DIN/TS 18599-2:2025-10 Table 6 alignment.
 */
export function calculateStandardN50(
    totalVolume: number,
    totalEnvelopeArea: number,
    ventilationType: "natural" | "mechanical",
    category: "I" | "II" | "III" | "IV" = "I"
): number {
    if (totalVolume <= 0) return 2.0;

    const table6 = {
        "I": {
            small: { natural: 3.0, mechanical: 1.5 },
            large: { natural: 3.0, mechanical: 2.0 }  // q50
        },
        "II": {
            small: { natural: 4.5, mechanical: 3.0 },
            large: { natural: 6.0, mechanical: 3.0 }  // q50
        },
        "III": {
            small: 6.0,
            large: 9.0
        },
        "IV": {
            small: 10.0,
            large: 15.0
        }
    };

    if (totalVolume <= 1500) {
        const val = table6[category].small;
        return typeof val === "number" ? val : val[ventilationType];
    } else {
        const q50Val = table6[category].large;
        const q50 = typeof q50Val === "number" ? q50Val : q50Val[ventilationType];
        return q50 * (totalEnvelopeArea / totalVolume);
    }
}
