
export function calculateSolarRadiation(
    I_H: number, // Monthly Global Horizontal Irradiance [kWh/m²/month]
    monthIndex: number, // 0 = Jan, 11 = Dec
    latitude: number, // Decimal Degrees
    azimuth: number, // Surface Azimuth (0 = South, -90 = East, 90 = West, 180 = North)
    tilt: number // Surface Tilt (0 = Horizontal, 90 = Vertical)
): number {
    if (I_H <= 0) return 0;

    // 0. Constants
    const PI = Math.PI;
    const DEG2RAD = PI / 180.0;
    const latRad = latitude * DEG2RAD;
    const tiltRad = tilt * DEG2RAD;
    const azRad = azimuth * DEG2RAD;
    const groundReflectance = 0.2; // Albedo

    // 1. Representative Day of Month (Klein)
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const n_day = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344][monthIndex];

    // 2. Solar Declination (delta)
    const declination = 23.45 * Math.sin(DEG2RAD * (360 * (284 + n_day) / 365));
    const decRad = declination * DEG2RAD;

    // 3. Sunset Hour Angle (omega_s) on horizontal
    // cos(omega_s) = -tan(lat) * tan(dec)
    const tanLatTanDec = Math.tan(latRad) * Math.tan(decRad);
    // Ensure value is within -1 to 1 (Polar night/day handling)
    let omega_s_rad = Math.acos(Math.max(-1, Math.min(1, -tanLatTanDec)));

    // 4. Extraterrestrial Radiation on Horizontal (H_0) [kWh/m²/day]
    // G_sc = 1.367 kW/m² (Solar Constant)
    const G_sc = 1.367;
    const dr = 1 + 0.033 * Math.cos(DEG2RAD * (360 * n_day / 365));

    // H0 = (24/PI) * G_sc * dr * (cos(lat)cos(dec)sin(omega_s) + omega_s*sin(lat)sin(dec))
    const H0_daily = (24 / PI) * G_sc * dr * (
        Math.cos(latRad) * Math.cos(decRad) * Math.sin(omega_s_rad) +
        omega_s_rad * Math.sin(latRad) * Math.sin(decRad)
    );

    const H0_monthly = H0_daily * daysInMonth[monthIndex];

    // 5. Clearness Index (K_T)
    if (H0_monthly <= 0) return 0; // Polar night
    let KT = I_H / H0_monthly;
    KT = Math.max(0.1, Math.min(0.8, KT)); // constrain KT

    // 6. Diffuse Fraction (H_d / H) - Erbs et al. Correlation (Monthly Avg)
    // Using Collares-Pereira & Rabl simplified or Erbs
    // For monthly average, estimating Kd from KT:
    // Page model implies: Kd = 1 - 1.13*KT (simple)
    // Or Erbs monthly:
    let Kd = 0;
    const omega_s_deg = omega_s_rad * (180 / PI);

    // Use Liu & Jordan / Collares-Pereira and Rabl model adapted for monthly
    if (KT <= 0.17) {
        Kd = 0.99;
    } else if (KT < 0.75) {
        Kd = 1.188 - 2.272 * KT + 9.473 * Math.pow(KT, 2) - 21.865 * Math.pow(KT, 3) + 14.648 * Math.pow(KT, 4);
    } else {
        Kd = 0.17; // Replaced 0.63 with approx lower bound for clear sky
        // Actually for high KT, diffuse is low. 0.2 is common. Let's use simple logic if simplified.
        // Let's stick to the polynomial it's robust enough.
    }
    // Clamp Kd
    Kd = Math.max(0.1, Math.min(0.99, Kd));

    const I_diff = I_H * Kd;
    const I_beam = I_H - I_diff;

    // 7. Tilt Factor for Beam Radiation (R_b)
    // R_b = (cos(lat-beta)cos(dec)sin(omega_ss) + omega_ss*sin(lat-beta)sin(dec)) / (cos(lat)cos(dec)sin(omega_s) + omega_s*sin(lat)sin(dec)) for south facing
    // For arbitrary azimuth, it is more complex.
    // Using simple ratio of cosines for representative hour is widely used for monthly methods, 
    // but calculating the day-integral R_b is better.

    // Calculate R_b using the hour-angle integration method
    // a = (sin(dec) * sin(lat) * cos(beta)) - (sin(dec) * cos(lat) * sin(beta) * cos(az))
    // b = (cos(dec) * cos(lat) * cos(beta)) + (cos(dec) * sin(lat) * sin(beta) * cos(az))
    // c = cos(dec) * sin(beta) * sin(az)

    // This integration is complex. 
    // Simple isotropic model approximations often use R_b calculated at noon or mid-afternoon? No.
    // Let's use the explicit R_b formula for monthly average (Liu & Jordan extended).

    // To allow arbitrary azimuth, we check sunrise/sunset on the surface.
    // This is mathematically heavy for a TS function but necessary for accuracy.
    // Simplifying: Use the projection at solar noon? No, too inaccurate for East/West.

    // Let's use the formula from Duffie & Beckman Eq 2.20.5 (Approximate R_b)
    // But exact analytic form is:
    // Num = integral(cos_theta dot d_omega)
    // Denom = integral(cos_theta_z dot d_omega)

    // Let's implement numerical integration (hourly) for the characteristic day. It's fast enough.
    let beam_tilt_sum = 0;
    let beam_horiz_sum = 0;

    // Loop from sunrise to sunset (horizontal)
    const loop_start_deg = -omega_s_deg;
    const loop_end_deg = omega_s_deg;

    for (let w = loop_start_deg + 0.5; w < loop_end_deg; w += 1) { // 1-degree steps
        const w_rad = w * DEG2RAD;

        // Horizontal Incidence cos(theta_z)
        const cos_theta_z = Math.cos(latRad) * Math.cos(decRad) * Math.cos(w_rad) + Math.sin(latRad) * Math.sin(decRad);

        if (cos_theta_z > 0) {
            // Tilted Incidence cos(theta)
            // cos(theta) = sin(dec)sin(lat)cos(beta) - sin(dec)cos(lat)sin(beta)cos(gam) 
            //            + cos(dec)cos(lat)cos(beta)cos(w) + cos(dec)sin(lat)sin(beta)cos(gam)cos(w)
            //            + cos(dec)sin(beta)sin(gam)sin(w)

            const cos_theta =
                Math.sin(decRad) * Math.sin(latRad) * Math.cos(tiltRad)
                - Math.sin(decRad) * Math.cos(latRad) * Math.sin(tiltRad) * Math.cos(azRad)
                + Math.cos(decRad) * Math.cos(latRad) * Math.cos(tiltRad) * Math.cos(w_rad)
                + Math.cos(decRad) * Math.sin(latRad) * Math.sin(tiltRad) * Math.cos(azRad) * Math.cos(w_rad)
                + Math.cos(decRad) * Math.sin(tiltRad) * Math.sin(azRad) * Math.sin(w_rad);

            // Only add if sun is in front of surface
            if (cos_theta > 0) {
                beam_tilt_sum += cos_theta;
            }
            beam_horiz_sum += cos_theta_z;
        }
    }

    const Rb = beam_horiz_sum > 0 ? (beam_tilt_sum / beam_horiz_sum) : 0;

    // 8. Total Tilted Radiation (Isotropic Sky Model - Liu & Jordan)
    // I_T = I_beam * Rb + I_diff * ((1 + cos(beta))/2) + I_H * rho * ((1 - cos(beta))/2)

    const I_tilt_beam = I_beam * Rb;
    const I_tilt_diff = I_diff * ((1 + Math.cos(tiltRad)) / 2);
    const I_tilt_ref = I_H * groundReflectance * ((1 - Math.cos(tiltRad)) / 2);

    return I_tilt_beam + I_tilt_diff + I_tilt_ref;
}
