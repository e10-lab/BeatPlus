import { ClimateData, HourlyClimate, MonthlyClimate } from "./types";

// Seoul Climate Data (Approximate representative year)
const SEOUL_CLIMATE: ClimateData = {
    name: "Seoul",
    monthly: [
        { month: 1, Te: -2.4, Is_Horiz: 65 },  // Jan
        { month: 2, Te: 0.4, Is_Horiz: 90 },   // Feb
        { month: 3, Te: 5.7, Is_Horiz: 125 },  // Mar
        { month: 4, Te: 12.5, Is_Horiz: 155 }, // Apr
        { month: 5, Te: 17.8, Is_Horiz: 170 }, // May
        { month: 6, Te: 22.2, Is_Horiz: 165 }, // Jun
        { month: 7, Te: 24.9, Is_Horiz: 150 }, // Jul
        { month: 8, Te: 25.7, Is_Horiz: 155 }, // Aug
        { month: 9, Te: 21.2, Is_Horiz: 135 }, // Sep
        { month: 10, Te: 14.8, Is_Horiz: 115 }, // Oct
        { month: 11, Te: 7.2, Is_Horiz: 75 },  // Nov
        { month: 12, Te: 0.4, Is_Horiz: 60 }   // Dec
    ]
};

// Helper: Days in each month
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Generates synthetic hourly data from monthly averages.
 * Note: This is a simplified generator for 'Standard Year' simulation when no EPW is available.
 */
export function generateHourlyClimateData(monthly: MonthlyClimate[]): HourlyClimate[] {
    const hourlyData: HourlyClimate[] = [];
    let hourOfYear = 1;

    // Approximate Diurnal Swing for Seoul (K)
    const DIURNAL_SWING = 8.0;

    monthly.forEach((m, index) => {
        const days = DAYS_IN_MONTH[index];
        // Monthly avg solar per day [kWh/m2/day] -> [W/m2/day average]
        const dailySolarAvg_kWh = m.Is_Horiz / days;

        for (let d = 1; d <= days; d++) {
            for (let h = 0; h < 24; h++) {
                // 1. Temperature Generation (Sinusoidal)
                // Min temp around 4-5 AM, Max temp around 2-3 PM (14-15)
                // T = T_avg + (Swing/2) * cos( (h - 15) * 2pi/24 )
                const tempSwing = (DIURNAL_SWING / 2) * Math.cos(((h - 15) * Math.PI) / 12);

                // Add some random variation per day + seasonal drift
                // (Interpolation between months is skipped for simplicity, using step steps)
                const T_hour = m.Te + tempSwing;

                // 2. Solar Generation (Simplified Disaggregation)
                // Hottel-Whillier model or simplified Half-Sine for daylight hours
                // Assuming sunrise ~ 6-7, sunset ~ 18-19. 
                // Peak at noon.
                let I_gh = 0; // Global Horizontal

                // Simple daylight check
                const sunrise = 6;
                const sunset = 19;
                if (h > sunrise && h < sunset) {
                    const totalDaylight = sunset - sunrise;
                    const hourFromNoon = Math.abs(12.5 - h);

                    // Cosine distribution
                    const weight = Math.cos((hourFromNoon / (totalDaylight / 2)) * (Math.PI / 2));
                    if (weight > 0) {
                        // Distribute daily total [kWh] -> W
                        // Total daily kWh = Integral(Power). 
                        // Avg Power ~ Total / (DaylightHours/2) * ... approx.
                        // Let's normalize weights
                        // Roughly: Peak ~ (DailyTotal * 1000) / (DaylightHours * 0.63)
                        const peakIrradiance = (dailySolarAvg_kWh * 1000) / (totalDaylight * 0.65);
                        I_gh = peakIrradiance * weight;
                    }
                }

                // Split Beam/Diffuse (Diff approx 20-50% depending on cloudiness)
                // Seoul average diffuse fraction ~0.4 - 0.5
                const diffuseFraction = 0.5;
                const I_diff = I_gh * diffuseFraction;
                const I_beam = I_gh * (1 - diffuseFraction);

                // Approximate Sun Position (very rough for viz purposes, Calc does its own)
                const sunAlt = h > sunrise && h < sunset ? 45 : 0;
                const sunAz = 180 + (h - 12) * 15;

                hourlyData.push({
                    hourOfYear: hourOfYear++,
                    month: m.month,
                    day: d,
                    hour: h,
                    Te: T_hour,
                    I_beam: I_beam,
                    I_diff: I_diff,
                    sunAltitude: sunAlt,
                    sunAzimuth: sunAz
                });
            }
        }
    });

    return hourlyData;
}


export const getClimateData = (region: string = "Seoul"): ClimateData => {
    // Generate on demand to save memory string stored
    const hourly = generateHourlyClimateData(SEOUL_CLIMATE.monthly);
    return {
        ...SEOUL_CLIMATE,
        hourly: hourly
    };
};

export async function loadClimateData(stationId: number): Promise<ClimateData> {
    try {
        const response = await fetch(`/weather-data/${stationId}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load weather data for station ${stationId}`);
        }
        const data = await response.json();

        // Ensure data matches ClimateData interface
        return {
            name: data.metadata?.name || `Station ${stationId}`,
            monthly: data.monthly,
            hourly: data.hourly
        };
    } catch (error) {
        console.warn(`Failed to load climate data for ${stationId}, falling back to synthetic Seoul data.`, error);
        return getClimateData();
    }
}
