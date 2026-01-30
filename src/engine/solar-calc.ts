/**
 * Calculate Hourly Incident Solar Radiation on Tilted Surface
 * Based on Isotropic Sky Model (Liu & Jordan) for Hourly Data
 */
export function calculateHourlyRadiation(
    I_beam_h: number, // Hourly Beam Irradiance on Horizontal [W/m²]
    I_diff_h: number, // Hourly Diffuse Irradiance on Horizontal [W/m²]
    dayOfYear: number, // 1-365
    hour: number, // 0-23 (Local Time) - Simplified, ideally Solar Time
    latitude: number, // Decimal Degrees
    surfaceAzimuth: number, // 0=South, -90=East, 90=West, 180=North
    surfaceTilt: number // 0=Horizontal, 90=Vertical
): number {
    if (I_beam_h <= 0 && I_diff_h <= 0) return 0;

    const DEG2RAD = Math.PI / 180.0;
    const latRad = latitude * DEG2RAD;
    const tiltRad = surfaceTilt * DEG2RAD;
    const surfAzRad = surfaceAzimuth * DEG2RAD;
    const groundReflectance = 0.2;

    // 1. Sun Position Calculation
    // Declination (delta)
    const delta = 23.45 * Math.sin(DEG2RAD * (360 * (284 + dayOfYear) / 365));
    const decRad = delta * DEG2RAD;

    // Hour Angle (omega)
    // Local Time -> Solar Time approximation (Skipping Equation of Time/Longitude correction for MVP simplification)
    // Noon = 12:00
    const omega = (hour - 12) * 15; // Degrees
    const omegaRad = omega * DEG2RAD;

    // Zenith Angle (theta_z) cosine
    // cos(theta_z) = sin(lat)sin(dec) + cos(lat)cos(dec)cos(omega)
    const cosThetaZ = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(omegaRad);

    // Sun Altitude (alpha_s)
    const sunAltitude = Math.asin(Math.max(-1, Math.min(1, cosThetaZ))) * (180 / Math.PI);

    // If sun is down, Beam is 0 (Diffuse might exist slightly post-sunset but simplified to 0)
    if (sunAltitude <= 0) return 0;

    // Solar Azimuth (gamma_s)
    // cos(gamma_s) = (sin(alpha_s)sin(lat) - sin(dec)) / (cos(alpha_s)cos(lat))
    // Note: Sign handling is tricky. Using standard formulas for south=0.
    const cosGammaS = (Math.sin(sunAltitude * DEG2RAD) * Math.sin(latRad) - Math.sin(decRad)) /
        (Math.cos(sunAltitude * DEG2RAD) * Math.cos(latRad));

    // Azimuth check for +/- (morning/afternoon) based on hour angle
    // If omega < 0 (morning), azimuth is negative (East)
    // If omega > 0 (afternoon), azimuth is positive (West)
    // Caution: arccos returns 0..PI.
    let gammaS_rad = Math.acos(Math.max(-1, Math.min(1, cosGammaS)));
    if (hour < 12) gammaS_rad = -gammaS_rad;

    // Angle of Incidence (theta)
    // cos(theta) = cos(theta_z)cos(beta) + sin(theta_z)sin(beta)cos(gamma_s - gamma_surf)
    // beta = tilt, gamma_surf = surfaceAzimuth
    const cosTheta = cosThetaZ * Math.cos(tiltRad) +
        Math.sin(Math.acos(Math.max(-1, Math.min(1, cosThetaZ)))) * Math.sin(tiltRad) * Math.cos(gammaS_rad - surfAzRad);

    // 2. Beam Radiation on Tilted
    // Rb = cos(theta) / cos(theta_z)
    // I_beam_t = I_beam_h * Rb
    // Avoid division by zero close to horizon
    let I_beam_t = 0;
    if (cosThetaZ > 0.05 && cosTheta > 0) { // Limit huge factors near sunrise/sunset
        const Rb = cosTheta / cosThetaZ;
        I_beam_t = I_beam_h * Rb;
    }

    // 3. Diffuse Radiation (Isotropic)
    // I_diff_t = I_diff_h * (1 + cos(beta))/2
    const I_diff_t = I_diff_h * (1 + Math.cos(tiltRad)) / 2;

    // 4. Reflected Radiation
    // I_ref_t = (I_beam_h + I_diff_h) * rho * (1 - cos(beta))/2
    const I_ref_t = (I_beam_h + I_diff_h) * groundReflectance * (1 - Math.cos(tiltRad)) / 2;

    return Math.max(0, I_beam_t + I_diff_t + I_ref_t);
}

// Keeping legacy function for compile safety during transition if strictly needed, 
// but Plan says 'Refactor', meaning we can replace it if all callers are updated.
// The main caller is calculator.ts which we are about to rewrite. 
// So it is safe to remove the old function.

