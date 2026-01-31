import { ZoneInput } from "./types";
import { UsageProfile } from "@/lib/din-18599-profiles";
import { LightingSystem } from "@/types/system";

/**
 * Lighting Calculation Module (DIN/TS 18599:2025-10 Simplified for Hourly Method)
 */

// Luminous Efficacy of Solar Radiation (lm/W)
// Approximation based on standard sky models or explicit values if available in weather file
// Direct: ~90-100 lm/W, Diffuse: ~110-120 lm/W
const EFFICACY_SOLAR_DIRECT = 95;
const EFFICACY_SOLAR_DIFFUSE = 115;

/**
 * Calculates hourly lighting energy demand based on daylight availability, control strategies, and standby power.
 * 
 * @param zone Zone properties (area, dimensions, windows)
 * @param I_beam Direct normal irradiance [W/m²]
 * @param I_diff Diffuse horizontal irradiance [W/m²]
 * @param sunElevation Sun elevation angle [degrees]
 * @param profile Usage profile (illuminance requirements)
 * @param lightingSystem Linked Lighting System properties (optional)
 * @returns { powerLighting: number, heatGainLighting: number } [W]
 */
export function calculateLightingDemand(
    zone: ZoneInput,
    I_beam: number,
    I_diff: number,
    sunElevation: number,
    profile: UsageProfile,
    lightingSystem?: LightingSystem
): { powerLighting: number, heatGainLighting: number } {
    const Area = zone.area;

    // 1. Required Illuminance (Em)
    const E_m = profile.illuminance; // [lux]

    // 2. Installed Power Density Calculation
    // Priority: LightingSystem -> Zone Override -> Profile Estimation
    const efficacy = lightingSystem?.lightingEfficacy || zone.lighting?.efficacy || 60;

    // Installed Power Density [W/m²]
    let p_j = 0;
    if (zone.lighting?.powerDensity !== undefined) {
        p_j = zone.lighting.powerDensity;
    } else {
        // Estimate from illuminance: p_j = E_m / (efficacy * k_L * rho)
        // Simplified DIN V 18599 approach
        const k_L = profile.illuminanceDepreciationFactor || 0.8;
        const rho = 0.6; // Typical utilization factor (room index dependent)
        p_j = E_m / (efficacy * k_L * rho);
    }
    const P_installed = p_j * Area;

    // 3. Operational Factors (DIN/TS 18599:2025-10)

    // 3.1 Constant Illuminance Factor (F_C)
    // If constant illuminance control is active, the lamp is dimmed when new.
    let F_C = 1.0;
    if (lightingSystem?.hasConstantIlluminanceControl || lightingSystem?.controlType === "constant") {
        const k_L = profile.illuminanceDepreciationFactor || 0.8;
        F_C = (1 + k_L) / 2;
    }

    // 3.2 Presence Factor (F_A)
    // Reduction due to occupancy sensors or manual switching during absence.
    // In DIN 18599-10, 'lightingAbsenceFactor' usually represents k_A (Reduction Potential).
    // F_A = 1 - k_A (if system is effective)
    // However, simplified approach: F_A is the multiplier. 
    // If profile has 0.25 (Classroom), it usually means F_A = 1 - 0.25 = 0.75? 
    // Or does it mean F_A = 0.25?
    // Let's assume the profile value is k_A (Saving Factor).
    // So F_A = 1 - k_A.
    // Exception: If manual, F_A = 1.0.
    let F_A = 1.0;
    const controlType = lightingSystem?.controlType || "manual";
    if (controlType === "occupancy" || controlType === "dual") {
        const k_A = profile.lightingAbsenceFactor || 0;
        F_A = 1.0 - k_A;
        if (F_A < 0) F_A = 0; // Integrity check
    }

    // 3.3 Partial Operation Factor (F_Te)
    // Factor considering that lights are not always ON 100% even during occupancy (e.g. non-working areas).
    // New in 2025 implementation.
    const F_Te = profile.partialOperationFactorLighting ?? 1.0;

    // 4. Daylight Availability Calculation
    const sinAlpha = Math.sin(Math.max(0, sunElevation) * Math.PI / 180);
    const I_dir_horiz = I_beam * sinAlpha;
    const E_ext_horiz = I_dir_horiz * EFFICACY_SOLAR_DIRECT + I_diff * EFFICACY_SOLAR_DIFFUSE; // [lux]

    let daylightFactor = 0;
    let windowArea = 0;
    zone.surfaces.forEach(s => {
        if (s.type === 'window') windowArea += s.area;
    });

    if (windowArea > 0 && Area > 0) {
        // Simple DF approximation
        daylightFactor = (windowArea / Area) * 0.1;
    }
    const E_day = E_ext_horiz * daylightFactor;

    // 5. Control Factor (F_D) - Daylight dependent
    let F_D = 1.0;
    const canUseDaylight = (controlType === "daylight" || controlType === "dual") && E_day > 0;

    if (canUseDaylight) {
        if (E_day >= E_m) {
            F_D = 0.0; // Dim to zero (ideally)
        } else {
            F_D = (E_m - E_day) / E_m;
        }
    }

    // 6. Hourly Lighting Power [W]
    // P_h = P_installed * F_C * F_D * F_A * F_Te
    let P_lighting_h = P_installed * F_C * F_D * F_A * F_Te;

    // 7. Standby / Parasitic Power [W]
    if (lightingSystem?.parasiticPowerDensity) {
        P_lighting_h += lightingSystem.parasiticPowerDensity * Area;
    } else if (controlType !== "manual") {
        // Standard standby for automatic controls (~0.1 W/m2)
        P_lighting_h += 0.1 * Area;
    }

    // Heat Gain [W]
    const heatGain = P_lighting_h;

    return {
        powerLighting: P_lighting_h,
        heatGainLighting: heatGain
    };
}
