
import { HeatingSystem, CoolingSystem, EnergySource } from "@/types/system";
import { HourlyResult } from "./types";

/**
 * HVAC System Calculations (DIN V 18599-5 & 7 Detailed)
 * Converts Net Energy Demand (Q_h, Q_c) -> Final Energy (Q_f) -> Primary Energy (Q_p)
 * using hourly curves for part-load efficiency and temperature dependence.
 */

import { PEF_FACTORS, CO2_FACTORS } from "@/lib/standard-values";

export interface HvacResult {
    finalEnergyHeating: number;
    finalEnergyCooling: number;
    primaryEnergyHeating: number;
    primaryEnergyCooling: number;
    auxiliaryEnergyHeating: number; // Pump Energy [kWh]
    auxiliaryEnergyCooling: number; // Pump Energy [kWh]
    co2Heating: number;
    co2Cooling: number;
    systemLossesHeating: number;
    systemLossesCooling: number;
}

// --- Helper: Boiler Efficiency Curves ---
function calculateBoilerEfficiency(
    type: "condensing_boiler" | "std_boiler" | "heat_pump" | "electric" | "district",
    nominalEff: number,
    loadRatio: number
): number {
    // Safety clamp
    const beta = Math.max(0.01, Math.min(1.0, loadRatio));

    if (type === "condensing_boiler") {
        // Eff increases at part load (up to a point)
        // Simple curve approximation
        // 30% load -> +4% efficiency, 100% load -> nominal
        // 10% load -> drops slightly
        if (beta > 0.3) {
            // Linear between 30% (nominal+0.04) and 100% (nominal)
            return (nominalEff + 0.04) + (nominalEff - (nominalEff + 0.04)) * ((beta - 0.3) / 0.7);
        } else {
            // Linear constant approx or slight drop
            return nominalEff + 0.04;
        }
    } else if (type === "std_boiler") {
        // Eff drops at part load (loss constant)
        // Curve: eta = beta / (beta + losses) ?
        // Simplified: 30% load -> nominal - 0.05
        if (beta < 1.0) {
            // Linear degradation
            return nominalEff - (0.05 * (1 - beta));
        }
        return nominalEff;
    }

    return nominalEff; // Electric / District constant
}

// --- Helper: Heat Pump COP Curves ---
function calculateHeatPumpCOP(
    type: string,
    nominalCOP: number,
    sourceTemp: number, // Outdoor Air for HP-Air
    supplyTemp: number
): number {
    // Carnot Efficiency Based model
    // COP_ideal = T_sink / (T_sink - T_source) (Kelvin)
    let T_sink_K = supplyTemp + 273.15;
    let T_source_K = sourceTemp + 273.15;

    // Minimum lift safety
    if (T_sink_K - T_source_K < 5) T_source_K = T_sink_K - 5;

    const cop_carnot = T_sink_K / (T_sink_K - T_source_K);

    // Quality Grade (Guetegrad) depends on type
    // Air-to-Water: ~0.45, Brine-Water: ~0.50
    let eta_carnot = 0.45;
    if (type === 'heat_pump_geo') eta_carnot = 0.50;

    // Calibration: Match Nominal COP at standard rating point
    // A7/W35 for Air-Water, B0/W35 for Geo
    // If user inputs Nominal COP=3.5 (A7/W35), we derive eta_carnot from that specific point?
    // Let's use simplified linear shift from nominal if available.

    // Better simpler model: 2% change per degree Source dT
    // 1.5% change per degree Sink dT

    // Rating point: Air 7C, Water 35C.
    const ratingSource = 7;
    const ratingSupply = 35;

    const dSource = sourceTemp - ratingSource;
    const dSupply = supplyTemp - ratingSupply;

    // COP increases with Source Temp (~2.5% per K)
    // COP decreases with Supply Temp (~2.5% per K)
    let cop = nominalCOP * (1 + 0.025 * dSource) * (1 - 0.025 * dSupply);

    // Limits
    return Math.max(1.0, cop);
}

// --- Helper: EHP (VRF) COP Curves ---
function calculateEhpCOP(
    nominalCOP: number,
    outdoorTemp: number, // Te
    loadRatio: number
): number {
    // VRF / EHP (Air-to-Air)
    // Less dependent on discharge temp (assumed constant control)
    // Strongly dependent on PLR (Inverter) and Outdoor Temp

    // 1. Temp Correction
    // Rated at 7C.
    // COP drops as Te drops. (~2% per K)
    const dT = outdoorTemp - 7;
    const factor_temp = 1.0 + 0.02 * dT;

    // 2. PLR Correction (Inverter)
    // Peak efficiency usually at 40-60% load.
    // Curve: 
    // 100% -> 1.0
    // 50% -> 1.25
    // 20% -> 1.1
    const beta = Math.max(0.1, loadRatio);
    let factor_plr = 1.0;
    if (beta >= 1.0) factor_plr = 1.0;
    else if (beta >= 0.5) factor_plr = 1.0 + 0.5 * (1.0 - beta); // Linear up to 1.25
    else factor_plr = 1.25 - 0.5 * (0.5 - beta); // Drop

    return nominalCOP * factor_temp * factor_plr;
}

// --- Helper: Chiller EER Curves ---
function calculateChillerEER(
    type: string,
    nominalEER: number,
    outdoorTemp: number,
    loadRatio: number
): number {
    // 1. Temperature Dependence (Carnot logic)
    // Rating: 35C Outdoor
    const dTemp = 35 - outdoorTemp;
    // EER improves as outdoor temp drops (~3% per K)
    let eer_temp = nominalEER * (1 + 0.03 * dTemp);

    // 2. Part Load Dependence (ESEER-like curve)
    // Load 100%: 1.0 * EER
    // Load 75%: 1.1 * EER
    // Load 50%: 1.2 * EER
    // Load 25%: 1.15 * EER
    // Very simplified, depends on compressor (Screw vs Scroll vs Inverter)
    // Let's assume typical Inverter curve
    const beta = Math.max(0.1, loadRatio);

    let plv = 1.0;
    if (beta >= 0.75) plv = 1.0 + 0.4 * (1 - beta); // Linear up to 1.1 at 75%
    else if (beta >= 0.50) plv = 1.1 + 0.4 * (0.75 - beta); // Up to 1.2 at 50%
    else plv = 1.2 - 0.4 * (0.50 - beta); // Drop below 50%

    return eer_temp * plv;
}

export function calculateHourlyHvac(
    hourlyResults: HourlyResult[], // To get hourly Load and Te
    heatingSystem?: HeatingSystem,
    coolingSystem?: CoolingSystem
): HvacResult {

    let sum_fe_h = 0;
    let sum_fe_c = 0;
    let sum_aux_h = 0; // Pump Energy
    let sum_aux_c = 0; // Pump Energy

    // Pre-calculate fixed efficiencies
    // Heating Distribution
    let eth_dist_h = 0.93;
    let supplyTempCurveMax = 70; // Default
    let supplyTempCurveMin = 70; // Default

    if (heatingSystem) {
        if (heatingSystem.distribution.temperatureRegime === "55/45") {
            eth_dist_h = 0.96;
            supplyTempCurveMax = 55;
            supplyTempCurveMin = 45; // Weather comp usually 55 at -10C, something lower at 15C
        } else if (heatingSystem.distribution.temperatureRegime === "35/28") {
            eth_dist_h = 0.98;
            supplyTempCurveMax = 35;
            supplyTempCurveMin = 28;
        } else if (heatingSystem.distribution.temperatureRegime === "90/70") {
            eth_dist_h = 0.93;
            supplyTempCurveMax = 80;
            supplyTempCurveMin = 60;
        }
    }

    let eth_em_h = 0.93; // Radiator
    if (heatingSystem?.emission.type === "floor_heating") eth_em_h = 0.97;
    if (heatingSystem?.emission.type === "air_heating") eth_em_h = 0.90;

    // Cooling Distribution
    let eth_dist_c = 0.95;
    if (coolingSystem?.distribution.type === "air") eth_dist_c = 0.90;

    // Iterate Hours
    for (const hr of hourlyResults) {
        const Q_h = hr.Q_heating;
        const Q_c = hr.Q_cooling;
        const Te = hr.Te;

        // --- Heating Calculation ---
        if (Q_h > 0) {
            // Hydraulic Pump Energy (Heating) - Always calc based on Load
            // Standard assumption: dT=15K (Radiator default), dp=35kPa, eta=0.4

            // EXCEPTION: EHP/VRF/Split (Air-to-Air) DOES NOT use hydraulic pump.
            const isAirSystem = heatingSystem && ["ehp", "split"].includes(heatingSystem.generator.type);

            if (!isAirSystem) {
                const dT_h = 15;
                const Q_w = Q_h; // Load approx
                const V_dot = Q_w / (1.16 * 1000 * dT_h);
                const P_pump_hyd = (V_dot * 35) / (3.6 * 0.4);
                const f_pump = 0.5; // Avg part load factor
                sum_aux_h += P_pump_hyd * f_pump;
            }

            if (!heatingSystem) {
                // Reference Generator
                sum_fe_h += Q_h / 0.81;
            } else {
                // System Generator
                // 1. Distribution & Emission Losses
                const Q_gen_out = Q_h / (eth_dist_h * eth_em_h);

                // 2. Generator Efficiency
                // Determine Part Load Ratio (Beta)
                // Assume Oversizing factor 1.2? Or P_design = max(Q_h) for verification?
                // Simplification for now: P_design = 25 kW (Residential) or assume specific W/m2?
                // Better: Use peak load found in scan or assume correct sizing (Beta = Q_gen_out / Q_gen_out_peak)
                // Let's assume system is sized for Peak Load * 1.0 (ideal)
                // PLR = Q_gen_out / (Max_Q_gen_out_of_year) ?
                // For a single pass, we don't know Max. 
                // Let's assume sizing at -12C -> dT=32K. Current dT = 20 - Te.
                // Q_design approx proportional to dT.
                // Beta approx (20 - Te) / 32. 

                const dT_design = 32; // -12C to 20C
                const dT_curr = Math.max(0, 20 - Te);
                let beta = Math.min(1.0, dT_curr / dT_design);

                let eff_gen = heatingSystem.generator.efficiency;

                if (heatingSystem.generator.type.includes("boiler")) {
                    eff_gen = calculateBoilerEfficiency(heatingSystem.generator.type as any, heatingSystem.generator.efficiency, beta);
                } else if (heatingSystem.generator.type === "heat_pump") {
                    // Weather Comp Supply Temp
                    // T_supply = T_min + (T_max - T_min) * ( (20-Te) / (20 - -12) ) ??
                    // Heating Curve:
                    // At Te = 20 (no load), Supply = 20? No usually cutoff.
                    // Let's use a standard slope. At -12C -> Max. At 15C -> Min.
                    const T_design_out = -12;
                    const T_limit = 15;
                    // Linear interp
                    let t_set = supplyTempCurveMin + (supplyTempCurveMax - supplyTempCurveMin) * ((T_limit - Te) / (T_limit - T_design_out));
                    t_set = Math.max(supplyTempCurveMin, Math.min(supplyTempCurveMax, t_set));

                    eff_gen = calculateHeatPumpCOP(heatingSystem.generator.type, heatingSystem.generator.efficiency, Te, t_set);
                } else if (heatingSystem.generator.type === "ehp" || heatingSystem.generator.type === "split") {
                    // EHP / VRF Logic
                    // No Supply Temp Curve (Air to Air)
                    eff_gen = calculateEhpCOP(heatingSystem.generator.efficiency, Te, beta);
                }

                sum_fe_h += Q_gen_out / eff_gen;

                // --- Terminal Fan Power (Heating) ---
                // For EHP/VRF, Terminal Fan is MANDATORY even if emission type is not explicitly set (assumed fan_coil)
                const isEHP = heatingSystem.generator.type === "ehp" || heatingSystem.generator.type === "split";

                if (isEHP || ["fan_coil", "air_heating"].includes(heatingSystem.emission.type)) {
                    // If fanPower provided, use it. Else estimate estimate 30W per kW load?
                    // DIN 18599 Default for FCU: 0.02 - 0.05 kW/kW_th?
                    // Let's assume simpler: 30W per unit? Or proportional to Area?
                    // Without unit count, estimating Total Watts is hard.
                    // Fallback: 2.5% of Peak Load?
                    // Let's use 0.03 kW_el / kW_th_design * Q_h?

                    let P_fan = 0;
                    if (heatingSystem.emission.fanPower) {
                        P_fan = heatingSystem.emission.fanPower; // Total Watts
                    } else {
                        // Estimate: 0.025 * Q_gen_out (approx)
                        P_fan = 0.025 * Q_gen_out;
                    }

                    // Operation Time Factor?
                    // Fan runs when Q_h > 0 (plus overrun?)
                    // Variable Speed?
                    // Assume ON/OFF or VSD prop to load
                    const f_fan = 0.5 + 0.5 * beta; // Min 50% power if ON?

                    sum_aux_h += P_fan * f_fan;
                }
            }
        }

        // --- Cooling Calculation ---
        if (Q_c > 0) {
            // Hydraulic Pump Energy (Cooling)
            // EXCEPTION: EHP/VRF/Split
            const isAirSystemC = coolingSystem && ["ehp", "split"].includes(coolingSystem.generator.type);

            if (!isAirSystemC) {
                const dT_c = 6;
                const Q_c_w = Q_c;
                const V_dot_c = Q_c_w / (1.16 * 1000 * dT_c);
                const P_pump_c = (V_dot_c * 45) / (3.6 * 0.45);
                const f_pump_c = 0.5;
                sum_aux_c += P_pump_c * f_pump_c;
            }

            if (!coolingSystem) {
                // Reference
                sum_fe_c += Q_c / (3.0 * 0.95);
            } else {
                const Q_gen_out = Q_c / eth_dist_c;

                // Beta Estimation
                // Design Temp 35C. Indoor 26C. dT=9
                const dT_design_c = 9;
                const dT_curr_c = Math.max(0, Te - 26);
                const beta = Math.min(1.0, dT_curr_c / dT_design_c);

                let eer = calculateChillerEER(
                    coolingSystem.generator.type,
                    coolingSystem.generator.efficiency,
                    Te,
                    beta
                );

                sum_fe_c += Q_gen_out / eer;

                // --- Terminal Fan Power (Cooling) ---
                const isEHPC = coolingSystem.generator.type === "ehp" || coolingSystem.generator.type === "split";

                if (isEHPC || ["fan_coil", "air"].includes(coolingSystem.emission.type)) {
                    let P_fan_c = 0;
                    if (coolingSystem.emission.fanPower) {
                        P_fan_c = coolingSystem.emission.fanPower;
                    } else {
                        // Estimate: 0.03 * Q_gen_out
                        P_fan_c = 0.03 * Q_gen_out;
                    }

                    const f_fan_c = 0.5 + 0.5 * beta;
                    sum_aux_c += P_fan_c * f_fan_c;
                }

                // --- Heat Rejection (Cooling Tower) ---
                // DIN V 18599-7
                // Only if Water Cooled
                if (coolingSystem.generator.condenserType === "water_cooled") {
                    // 1. Calculate Heat Rejection Load (Q_out)
                    // Q_out = Q_cool + Q_compressor
                    // Q_compressor = Q_cool / EER
                    // Here Q_gen_out is the Cooling Load required from generator
                    // But EER calculated above (eer variable) is the efficiency.
                    // Compressor Power = Q_gen_out / eer
                    const P_comp = Q_gen_out / eer;
                    const Q_reject = Q_gen_out + P_comp; // Total heat to reject

                    // 2. Condenser Pump (Cooling Water Pump)
                    // Flow V_dot_cw [m3/h]. dT ~ 5K (Std)
                    // Q_reject [W]
                    const dT_cw = 5;
                    const V_dot_cw = Q_reject / (1.16 * 1000 * dT_cw);
                    const dp_cw = 50; // kPa (Tower loop usually higher)
                    const eta_cw = 0.45;
                    const P_pump_cw = (V_dot_cw * dp_cw) / (3.6 * eta_cw); // Watts

                    // Control factor (assume variable)
                    const f_cw = 0.2 + 0.8 * beta;
                    sum_aux_c += P_pump_cw * f_cw;

                    // 3. Cooling Tower Fan
                    // DIN 18599-7 Default specific power: 0.04 kW / kW_th_reject?
                    // Verify Standard value for reference fan.
                    // Or Use detailed part load curve.
                    // Simplified: Max Power * PartLoadFactor
                    // Max Power est: 0.03 kW/kW_reject (Axial) to 0.06 (Radial)
                    const spec_fan_power = 0.04; // kW/kW
                    const P_fan_max = (Q_reject / 1000) * spec_fan_power * 1000; // Watts

                    // Fan Part Load (Power ~ Speed^3)
                    // Air flow proportional to Load
                    // Beta_tower ~ Beta_chiller
                    const f_fan = Math.pow(beta, 3); // Cubic law
                    // Or linear with min speed?
                    // Min speed is usually 0.2
                    const f_fan_curve = Math.max(0.05, Math.pow(beta, 3));

                    sum_aux_c += P_fan_max * f_fan_curve;
                }
            }
        }
    }

    // Aggregates
    const fuel_h = heatingSystem?.generator.fuel || 'natural_gas';
    const fuel_c = coolingSystem?.generator.fuel || 'electricity';

    // Convert sum to kWh? (Input Q was Wh? Check hourly result type)
    // HourlyResult Q is Wh.
    // We summed Wh.
    // Convert to kWh for Final Result.
    const fe_h_kWh = sum_fe_h / 1000;
    const fe_c_kWh = sum_fe_c / 1000;

    // Annual Net Demand (sum of Q) from inputs to calc losses
    const net_h_kWh = hourlyResults.reduce((s, h) => s + h.Q_heating, 0) / 1000;
    const net_c_kWh = hourlyResults.reduce((s, h) => s + h.Q_cooling, 0) / 1000;

    // Aux in kWh
    const aux_h_kWh = sum_aux_h / 1000;
    const aux_c_kWh = sum_aux_c / 1000;

    // Add Aux CO2/PEF (Assume Grid Electricity)
    const pef_el = PEF_FACTORS['electricity'];
    const co2_el = CO2_FACTORS['electricity'];

    // Note: Aux is reported separately here, needs to be added to Total Primary/CO2 in calculator.ts?
    // Current interface implies "primaryEnergyHeating" includes aux? 
    // DIN usually sums them up. Let's separate for clarity in result, but calculator.ts aggregates.

    return {
        finalEnergyHeating: fe_h_kWh,
        finalEnergyCooling: fe_c_kWh,
        auxiliaryEnergyHeating: aux_h_kWh, // Exported
        auxiliaryEnergyCooling: aux_c_kWh, // Exported
        // Primary Energy includes Aux?
        // Let's keep P_heating as Generator Primary. 
        // We will sum Aux P separately in calculator.
        primaryEnergyHeating: fe_h_kWh * PEF_FACTORS[fuel_h],
        primaryEnergyCooling: fe_c_kWh * PEF_FACTORS[fuel_c],

        co2Heating: fe_h_kWh * CO2_FACTORS[fuel_h],
        co2Cooling: fe_c_kWh * CO2_FACTORS[fuel_c],

        systemLossesHeating: fe_h_kWh - net_h_kWh, // + aux_h_kWh? No, loss is thermal difference
        systemLossesCooling: fe_c_kWh - net_c_kWh
    };
}
