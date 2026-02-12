export interface EPWData {
    location: {
        city: string;
        latitude: number;
        longitude: number;
        timezone: number;
        elevation: number;
    };
    hourly: EPWHourlyData[];
}

/**
 * Parses a standard .epw text content into structured data
 */
export function parseEPW(content: string): EPWData {
    const lines = content.split(/\r?\n/);
    const data: EPWData = {
        location: {
            city: '',
            latitude: 0,
            longitude: 0,
            timezone: 0,
            elevation: 0,
        },
        hourly: [],
    };

    let headerPassed = false;

    for (const line of lines) {
        const parts = line.split(',');

        // Parse LOCATION header
        // LOCATION,City,State,Country,Source,WMO,Lat,Lon,TZ,Elev
        if (parts[0].toUpperCase() === 'LOCATION') {
            data.location = {
                city: parts[1],
                latitude: parseFloat(parts[6]),
                longitude: parseFloat(parts[7]),
                timezone: parseFloat(parts[8]),
                elevation: parseFloat(parts[9]),
            };
            continue;
        }

        // Skip other headers until data starts
        // Data lines usually start with Year (e.g. 2017) or standard TMY year
        // Simply check if explicit headers like DESIGN CONDITIONS are passed.
        // A robust way for EPW is checking if the first column is a number or data periods logic.
        // Standard EPW data lines start after the "DATA PERIODS" line + number of periods.
        // But commonly, data lines have many columns (30+).
        if (!headerPassed) {
            if (parts[0].toUpperCase() === 'DATA PERIODS') {
                // The next lines might describe periods, then data starts.
                // But usually simply checking column count is safer for standard EPW.
                // Let's assume lines with > 10 columns and first col being potential year are data.
                headerPassed = true;
                // Skip the DATA PERIODS line itself
                continue;
            }
            // Also explicit check for standard headers to skip
            if (['DESIGN CONDITIONS', 'TYPICAL/EXTREME PERIODS', 'GROUND TEMPERATURES', 'HOLIDAYS/DAYLIGHT SAVINGS', 'COMMENTS 1', 'COMMENTS 2'].some(h => parts[0].toUpperCase().startsWith(h))) {
                continue;
            }
        }

        // Valid data line check: EPW data has 35 columns
        if (parts.length < 30) continue;

        // Additional check: first column should be year (number)
        const year = parseInt(parts[0]);
        if (isNaN(year)) continue;

        // Column indices (0-based from manual):
        // 6: Dry Bulb Temp
        // 7: Dew Point Temp
        // 8: Rel Humidity
        // 13: Global Horizontal Radiation
        // 14: Direct Normal Radiation
        // 15: Diffuse Horizontal Radiation
        // 10: Extraterrestrial Horizontal Radiation (Check standard: usually col 10 or 11 depending on version??)
        // Let's verify commonly accepted index:
        // Year, Month, Day, Hour, Minute, Flags (0-5)
        // 6: Dry Bulb
        // 7: Dew Point
        // 8: Rel Hum
        // 9: Atm Pressure
        // 10: Extraterrestrial Horizontal Radiation
        // 11: Extraterrestrial Direct Normal Radiation
        // 12: Horiz Infrared
        // 13: Global Horizontal Radiation
        // 14: Direct Normal Radiation
        // 15: Diffuse Horizontal Radiation

        // Note: Parsing float
        const dryBulb = parseFloat(parts[6]);
        const dewPoint = parseFloat(parts[7]);
        const relHum = parseFloat(parts[8]);

        const extraHoriz = parseFloat(parts[10]);

        const globalHoriz = parseFloat(parts[13]);
        const directNormal = parseFloat(parts[14]);
        const diffuseHoriz = parseFloat(parts[15]);

        const windDir = parseFloat(parts[20]);
        const windSpeed = parseFloat(parts[21]);

        data.hourly.push({
            dryBulbTemperature: [dryBulb], // wrapping in array if we want structure, but single object is better? Interface says number[] per field which implies column... wait.
            // Interface above defined 'hourly' as array of objects.
            // Let's fix the interface to be clearer in next step if needed, currently implementing as singular values per hour.
            // Wait, interface: hourly: { dryBulb: number[] ... }[] -> This is Array of Objects where each object has arrays? 
            // No, usually it's Array<HourData>.
            // Let's fix the interface definition in the file content.
        } as any);
    }

    // Re-mapping to cleaner structure
    // Actually, let's redefine the implementation to be efficient.

    const structuredHourly: any[] = [];

    // Reset for correct parsing loop
    for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 30 || isNaN(parseInt(parts[0]))) continue;

        structuredHourly.push({
            year: parseInt(parts[0]),
            month: parseInt(parts[1]),
            day: parseInt(parts[2]),
            hour: parseInt(parts[3]),
            dryBulb: parseFloat(parts[6]),
            dewPoint: parseFloat(parts[7]),
            relHum: parseFloat(parts[8]),
            pressure: parseFloat(parts[9]),
            extraHoriz: parseFloat(parts[10]),
            globalHoriz: parseFloat(parts[13]),
            directNormal: parseFloat(parts[14]),
            diffuseHoriz: parseFloat(parts[15]),
            windDir: parseFloat(parts[20]),
            windSpeed: parseFloat(parts[21]),
        });
    }

    // Overwrite the initial data object with correct structure
    return {
        location: data.location,
        hourly: structuredHourly
    } as any;
}

export type EPWHourlyData = {
    year: number;
    month: number;
    day: number;
    hour: number;
    dryBulb: number;
    dewPoint: number;
    relHum: number;
    pressure: number;
    extraHoriz: number;
    globalHoriz: number;
    directNormal: number;
    diffuseHoriz: number;
    windDir: number;
    windSpeed: number;
};

// Fix the interface export to match implementation
export interface ParsedEPW {
    location: {
        city: string;
        latitude: number;
        longitude: number;
        timezone: number;
        elevation: number;
    };
    hourly: EPWHourlyData[];
}
