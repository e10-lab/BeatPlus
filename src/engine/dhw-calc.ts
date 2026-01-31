
import { UsageProfile } from "@/lib/din-18599-profiles";
import { ZoneInput } from "./types";
import { DHWSystem } from "@/types/system";

/**
 * Domestic Hot Water Calculation (DIN V 18599-8)
 * Includes Storage Losses (Q_W,s) and Distribution Losses (Q_W,d)
 */

interface DHWResult {
    energyDHW: number; // [Wh] Total Energy Demand (Useful + Losses) -> Q_W,gen,out
    heatGainDHW: number; // [Wh] Internal heat gain from losses -> Q_W,int
    usefulEnergy: number; // [Wh] Pure demand at tap -> Q_W,b
}

export function calculateHourlyDHW(
    zone: ZoneInput,
    profile: UsageProfile,
    hourOfDay: number, // 0-23
    isOccupied: boolean,
    dhwSystem?: DHWSystem,
    ambientTemp: number = 20, // Surrounding temp for storage/pipes (default 20C)
    // In a full implementation, ambientTemp would come from the zone's calculated air temp of the previous step
): DHWResult {

    // --- 1. Useful Energy Demand (Q_W,b) ---
    // Q_W,b,d = q_w,b,spec * A_NGF
    const dhwDemandSpecific = profile.dhwDemand || 0; // Wh/(m²·d)
    const dailyDemand = dhwDemandSpecific * zone.area; // [Wh/d]

    if (dailyDemand <= 0) {
        return { energyDHW: 0, heatGainDHW: 0, usefulEnergy: 0 };
    }

    // Hourly Distribution
    let hourlyFraction = 0;
    if (isOccupied) {
        let usageDuration = 0;
        if (profile.usageHoursEnd > profile.usageHoursStart) {
            usageDuration = profile.usageHoursEnd - profile.usageHoursStart;
        } else {
            usageDuration = (24 - profile.usageHoursStart) + profile.usageHoursEnd;
        }

        if (usageDuration > 0) {
            hourlyFraction = 1 / usageDuration;
        } else {
            // Fallback: Uniform distribution over 24h if occupied but no specific hours?
            // Or usually profile implies demand only during usage hours.
            hourlyFraction = 1 / 24;
        }
    } else {
        hourlyFraction = 0;
        // Note: Some profiles might have small demand during non-occupied (e.g. cleaning),
        // but simplified profiles assume demand ~ occupancy.
    }

    // Check if current hour is within usage window
    // (This acts as a filter on top of isOccupied, strictly following profile times)
    // Simply using isOccupied from the scheduler is safer as it handles day/night logic.
    // So we use the fraction computed above.

    const usefulEnergy = dailyDemand * hourlyFraction; // [Wh]

    // --- 2. System Losses ---

    // If no system defined, assume ideal system (Efficiency=1.0) but apply a generic distribution loss factor
    // to represent heat given off to the room (part of standard calculation).
    if (!dhwSystem) {
        const heatGainDHW = usefulEnergy * 0.2; // Default 20% loss gain
        return {
            energyDHW: usefulEnergy,
            heatGainDHW,
            usefulEnergy
        };
    }

    // A. Storage Losses (Q_W,s)
    let storageLoss = 0;
    let gainsFromStorage = 0;

    if (dhwSystem.storage) {
        const { volume, temperature = 60, location = "conditioned" } = dhwSystem.storage;

        // Standby Heat Loss (Q_B,s in kWh/24h)
        // If lossFactor is provided (e.g. from ErP label), use it. 
        // Note: Our type definition has lossFactor as Wh/(L.d.k) or Watts? 
        // Let's assume the user input or type needs to clearly map. 
        // For now, let's implement the standard approximation formula (DIN 18599-8 Eq 30 roughly)
        // Q_B,s = 0.4 + 0.2 * V^0.4 (Example curve) or modern: 0.3 + 0.045 * V^0.6
        // Let's use a safe approximation for modern tanks:
        // P_standby_watts ~= 2.5 * V^0.45 

        // Let's use standard Standing Loss Power in Watts:
        // q_B,s [W] approx 
        // 200L -> ~50W - 60W
        // 500L -> ~90W
        // Formula: P_loss [W] = 0.6 * volume^0.6 (Rough fit)

        const Q_standby_24h_kWh = 0.3 + 0.045 * Math.pow(volume, 0.6); // kWh/24h
        const P_loss_avg_W = (Q_standby_24h_kWh * 1000) / 24; // Average Watts at test conditions (dT=45K)

        // Adjust for actual delta T
        // Test conditions: T_store=65, T_amb=20 -> dT=45
        // Actual conditions: T_store=temperature, T_amb=ambientTemp
        const dT_actual = temperature - ambientTemp;
        const dT_test = 45;

        const correctionFactor = Math.max(0, dT_actual / dT_test);

        storageLoss = P_loss_avg_W * correctionFactor; // [Wh] for 1 hour

        // Internal Gains from Storage
        if (location === "conditioned") {
            gainsFromStorage = storageLoss;
        } else {
            gainsFromStorage = 0;
        }
    }

    // B. Distribution Losses (Q_W,d)

    // 1. Circulation Loop (Q_W,d,c)
    let circulationLoss = 0;
    const { hasCirculation, pipeInsulation, pipeLength } = dhwSystem.distribution;

    if (hasCirculation) {
        // Linear heat loss coefficient [W/mK] based on insulation class
        let psi_circ = 0.20; // none
        switch (pipeInsulation) {
            case "basic": psi_circ = 0.15; break;
            case "good": psi_circ = 0.10; break;
            case "reinforced": psi_circ = 0.05; break;
        }

        // Pipe Length Estimation (DIN 18599-8 Table 8 or simplified geometry)
        // L_circ = 2 * (L + W + H) * No_of_risers ...
        // Simplified: L_circ approx 0.8 * A_NGF^0.5 * NumberOfStories?
        // Let's use the provided pipeLength or a rough fallback based on zone area.
        const L_circ = pipeLength || (10 + 2 * Math.sqrt(zone.area));

        const T_mean = (dhwSystem.storage?.temperature || 60) - 5; // Flow 60, Return 55 -> Mean 57.5?
        const deltaT_circ = T_mean - ambientTemp;

        // Operation hours: Assume 24h for now unless profile implies otherwise.
        // Or if occupied?
        const hrs = 1;

        circulationLoss = L_circ * psi_circ * Math.max(0, deltaT_circ) * hrs;
    }

    // 2. Individual Lines (Q_W,d,i)
    // Heat lost in the "spur" pipes that cool down between uses.
    // DIN 18599-8 method uses factors or specific pipe geometry.
    // Simplified: Percentage of useful energy.
    // Range 10-30%.
    // Factor depends on pipe length and demand pattern.
    // Let's use a base factor approach.
    const k_ind = 0.15; // 15% loss
    const individualLoss = usefulEnergy * k_ind;


    const distributionLossTotal = circulationLoss + individualLoss;

    // Internal Gains from Distribution
    // Assume 80% of distribution pipes are within conditioned space
    const gainsFromDistribution = distributionLossTotal * 0.8;

    // --- 3. Total Results ---

    // Q_W,gen,out = Q_W,b + Q_W,s + Q_W,d
    const energyDHW = usefulEnergy + storageLoss + distributionLossTotal;

    // Q_W,int = Gains_storage + Gains_distribution
    const heatGainDHW = gainsFromStorage + gainsFromDistribution;

    return {
        energyDHW,
        heatGainDHW,
        usefulEnergy
    };
}
