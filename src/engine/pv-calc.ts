
import { PVSystem } from "@/types/system";
import { HourlyResult } from "./types";
import { calculateHourlyRadiation } from "./solar-calc";

/**
 * Hourly PV Generation Calculation (DIN V 18599-9)
 * Calculates AC energy generation [Wh]
 */

export interface PVResult {
    hourlyGeneration: number[]; // Wh for each hour
    totalGeneration: number; // Wh
}

export function calculateHourlyPV(
    system: PVSystem,
    hourlyWeather: { Te: number, I_beam: number, I_diff: number, day: number, hour: number }[],
    latitude: number = 37.5
): PVResult {
    const hourlyGen = new Array(hourlyWeather.length).fill(0);
    let totalGen = 0;

    // Iterate over each array in the system
    system.arrays.forEach(array => {
        const capacityW = array.capacity * 1000; // kWp -> Wp
        const pr = array.performanceRatio || 0.75;
        let tilt = array.tilt;

        // Map Orientation string to Azimuth degrees
        let azimuth = 0; // S=0
        switch (array.orientation) {
            case 'S': azimuth = 0; break;
            case 'E': azimuth = -90; break;
            case 'W': azimuth = 90; break;
            case 'N': azimuth = 180; break;
            case 'SE': azimuth = -45; break;
            case 'SW': azimuth = 45; break;
            case 'NE': azimuth = -135; break;
            case 'NW': azimuth = 135; break;
            case 'Horiz': azimuth = 0; break; // tilt 0 anyway
            default: azimuth = 0;
        }
        if (array.orientation === 'Horiz') tilt = 0; // Override tilt

        for (let i = 0; i < hourlyWeather.length; i++) {
            const w = hourlyWeather[i];

            // 1. Calculate Incident Radiation
            const I_surf = calculateHourlyRadiation(
                w.I_beam,
                w.I_diff,
                w.day,
                w.hour,
                latitude,
                azimuth,
                tilt
            );

            // 2. Generation Formula
            // E_pv = I_surf * (P_pk / I_stc) * PR
            // I_stc = 1000 W/m2
            // P_pk in Watts
            // Result in Wh (since step is 1h)

            // Simplified Temperature Correction (if moduleType known? Ignored for MVP plan)

            if (I_surf > 0) {
                const gen = I_surf * (capacityW / 1000) * pr;
                hourlyGen[i] += gen;
                totalGen += gen;
            }
        }
    });

    return {
        hourlyGeneration: hourlyGen,
        totalGeneration: totalGen
    };
}
