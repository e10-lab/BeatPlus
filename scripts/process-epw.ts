
import fs from 'fs';
import path from 'path';
import { HourlyClimate, MonthlyClimate } from '../src/engine/types';

// Constants
const EPW_DIR = path.join(process.cwd(), 'epw');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'weather-data');
const METADATA_FILE = path.join(process.cwd(), 'src', 'lib', 'stations.json');

// Interface for Station Metadata
interface StationMetadata {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    filename: string;
    monthlyTemp: number[];
    monthlySolar: number[];
}

// Function to parse a single EPW file
function parseEpw(filePath: string, filename: string): { metadata: StationMetadata, hourly: HourlyClimate[], monthly: MonthlyClimate[] } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 1. Parse Location Header (Line 1)
    // LOCATION,Seoul.WS,SO,KOR,SRC-TMYx,471080,37.57140,126.9658,9.0,87.1
    const locLine = lines[0].split(',');
    const name = locLine[1];
    const id = parseInt(locLine[5]);
    const latitude = parseFloat(locLine[6]);
    const longitude = parseFloat(locLine[7]);
    const timezone = parseFloat(locLine[8]);
    const elevation = parseFloat(locLine[9]);

    const metadata: StationMetadata = {
        id,
        name,
        latitude,
        longitude,
        elevation,
        filename
    } as any; // Cast for partial init

    // 2. Parse Data (Line 9 onwards)
    const hourly: HourlyClimate[] = [];
    const monthlyAcc: { [key: number]: { tempSum: number, solarSum: number, count: number } } = {};

    let hourOfYear = 1;

    for (let i = 8; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');
        // Standard EPW often has headers or comments interspersed, but usually strictly data after DATA PERIODS
        // Check if numeric
        if (isNaN(parseInt(cols[0]))) continue;

        const month = parseInt(cols[1]);
        const day = parseInt(cols[2]);
        const hour = parseInt(cols[3]);

        // EPW Columns (check valid doc or file inspection)
        // 6: Dry Bulb (C)
        // 13: Global Horizontal (Wh/m2)
        // 14: Direct Normal (Wh/m2)
        // 15: Diffuse Horizontal (Wh/m2)

        const Te = parseFloat(cols[6]);
        const I_gh = parseFloat(cols[13]); // Global Horizontal
        const I_dn = parseFloat(cols[14]); // Direct Normal
        const I_dh = parseFloat(cols[15]); // Diffuse Horizontal

        // Fallback or Checks
        // 5R1C Engine expects I_beam and I_diff (Horizontal or Normal?)
        // Solar Calc usually expects Global Horizontal (to split) OR Beam+Diffuse Horizontal.
        // My calculateHourlyRadiation logic:
        // If I use 'I_beam' and 'I_diff', usually implying Horizontal components or Normal Beam + Horizontal Diffuse.
        // Let's look at `solar-calc.ts` later. Usually EPW gives Direct Normal (I_dn) and Diffuse Horizontal (I_dh).
        // Global Horizontal (I_gh) ~ I_dn * sin(h) + I_dh.

        // Storing generic values. Let's store DN and DH as 'beam' and 'diff' for now, or explicit fields.
        // My `HourlyClimate` interface has `I_beam` and `I_diff`.
        // Let's assume I_beam means Direct Normal Radiation (Solar calc usually projects this).
        // OR does it mean Horizontal Beam?
        // Checking `types.ts`: I_beam: number; // Beam Irradiance (W/m2)
        // Checking `solar-calc.ts` usage:
        // It likely projects beam. 
        // Best practice: Store Direct Normal as beam, Diffuse Horizontal as diff.
        // Note: EPW units are Wh/m2 (Energy per hour) -> effectively W/m2 for hourly steps.

        hourly.push({
            hourOfYear,
            month,
            day,
            hour,
            Te,
            I_beam: I_dn,
            I_diff: I_dh,
            // SunPos will be calculated by the engine on the fly or we can pre-calc? 
            // Engine calculates it based on lat/lon/time. 
            // BUT `HourlyClimate` type has sunAltitude/sunAzimuth.
            // If I leave them 0, does the engine recalc them?
            // `generateHourlyClimateData` was strictly creating them.
            // If I load from EPW, I might need to compute them OR let the engine do it.
            // `calculator.ts` logic needs to be checked. 
            // If `calculator.ts` computes sun pos internally, we are good.
            // If it expects them in input, we need to generate them.
            // Let's verify `calculator.ts` later. For now, I'll pass 0.
            sunAltitude: 0,
            sunAzimuth: 0
        });

        // Monthly Stats Accumulation
        if (!monthlyAcc[month]) monthlyAcc[month] = { tempSum: 0, solarSum: 0, count: 0 };
        monthlyAcc[month].tempSum += Te;
        monthlyAcc[month].solarSum += (I_gh); // Global Horizontal for monthly total check
        monthlyAcc[month].count++;

        hourOfYear++;
    }

    const monthly: MonthlyClimate[] = [];
    const monthlyTemp: number[] = [];
    const monthlySolar: number[] = [];

    for (let m = 1; m <= 12; m++) {
        const stats = monthlyAcc[m];
        if (stats) {
            const avgTemp = stats.tempSum / stats.count;
            const totalSolar = stats.solarSum / 1000;

            monthly.push({
                month: m,
                Te: avgTemp,
                // Monthly Total Solar (kWh/m2/month) = Sum(Wh/m2) / 1000
                Is_Horiz: totalSolar
            });
            monthlyTemp.push(parseFloat(avgTemp.toFixed(1)));
            monthlySolar.push(parseFloat(totalSolar.toFixed(1)));
        } else {
            monthlyTemp.push(0);
            monthlySolar.push(0);
        }
    }

    metadata.monthlyTemp = monthlyTemp;
    metadata.monthlySolar = monthlySolar;

    return { metadata, hourly, monthly };
}

// Main Execution
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const files = fs.readdirSync(EPW_DIR).filter(f => f.endsWith('.epw'));
const stations: StationMetadata[] = [];

console.log(`Processing ${files.length} EPW files...`);

for (const file of files) {
    try {
        const { metadata, hourly, monthly } = parseEpw(path.join(EPW_DIR, file), file);
        stations.push(metadata);

        // Save Weather Data (Hourly + Monthly)
        const weatherData = {
            ...metadata,
            monthly,
            hourly
        };

        fs.writeFileSync(path.join(OUTPUT_DIR, `${metadata.id}.json`), JSON.stringify(weatherData));
        process.stdout.write('.');
    } catch (e) {
        console.error(`\nError processing ${file}:`, e);
    }
}

// Save Metadata Registry
fs.writeFileSync(METADATA_FILE, JSON.stringify(stations, null, 2));

console.log(`\nDone. Processed ${stations.length} stations.`);
