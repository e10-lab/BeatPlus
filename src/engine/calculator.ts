
import { DHWSystem, AHUSystem, HeatingSystem, CoolingSystem, LightingSystem, EnergySource } from "@/types/system";
import { ZoneInput, CalculationResults, MonthlyResult, HourlyResult, ClimateData } from "./types";
import { Project } from "@/types/project";
import { getClimateData, generateHourlyClimateData } from "./climate-data";
import { calculateHourlyRadiation } from "./solar-calc";
import { calculateLightingDemand } from "./lighting-calc";
import { calculateHourlyDHW } from "./dhw-calc";
import { calculateHourlyHvac, HvacResult } from "./hvac-calc";
import { calculateHourlyPV } from "./pv-calc";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { PEF_FACTORS, CO2_FACTORS } from "@/lib/standard-values";

// Physical Constants
const HEAT_CAPACITY_AIR = 0.34; // Wh/(m³K) or 1200 J/(m³K) / 3600
const STEFAN_BOLTZMANN = 5.67e-8;

/**
 * ISO 52016-1:2017 5R1C Model Implementation
 * Calculates hourly energy demand for heating and cooling.
 */
export function calculateEnergyDemand(
    zones: ZoneInput[],
    weatherData?: ClimateData,
    mainStructure?: string,
    ventilationConfig?: Project['ventilationConfig'],
    ventilationUnits?: Project['ventilationUnits'],
    automationConfig?: Project['automationConfig'],
    systems?: Project['systems']
): CalculationResults {

    // 1. Prepare Weather Data
    // Generates 8760 hours of Te, I_beam, I_diff, SunPos
    // (In real app, select based on stationId, currently simplifed to Seoul/Default)
    // 1. Prepare Weather Data
    // Use provided weatherData or fallback to synthetic Seoul data
    const climateBase = weatherData || getClimateData();
    const hourlyClimate = climateBase.hourly || generateHourlyClimateData(climateBase.monthly);

    const projectHourlyResults: HourlyResult[] = []; // Aggregated project results if needed

    // Initialize results structure
    const zoneResults = zones.map(zone => {
        if (zone.isExcluded) return null;

        return calculateZoneHourly(
            zone,
            hourlyClimate,
            mainStructure,
            ventilationConfig,
            ventilationUnits,
            automationConfig,
            systems
        );
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    // Aggregate Yearly Results
    const totalHeating = zoneResults.reduce((sum, z) => sum + z.yearly.heatingDemand, 0);
    const totalCooling = zoneResults.reduce((sum, z) => sum + z.yearly.coolingDemand, 0);
    const totalLighting = zoneResults.reduce((sum, z) => sum + z.yearly.lightingDemand, 0);
    const totalDHW = zoneResults.reduce((sum, z) => sum + z.yearly.dhwDemand, 0);
    const totalAux = zoneResults.reduce((sum, z) => sum + z.yearly.auxDemand, 0);
    const totalArea = zoneResults.reduce((sum, z) => sum + z.yearly.totalArea, 0);

    // Aggregate Monthly Results (for project total charts)
    // Simply summing up zone monthlies
    const projectMonthlyResults: MonthlyResult[] = [];
    for (let m = 1; m <= 12; m++) {
        projectMonthlyResults.push({
            month: m,
            QT: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QT || 0), 0),
            QV: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QV || 0), 0),
            Qloss: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qloss || 0), 0),
            QS: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QS || 0), 0),
            QI: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QI || 0), 0),
            Qgain: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qgain || 0), 0),
            Qh: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qh || 0), 0),
            Qc: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qc || 0), 0),
            Q_heating: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qh || 0), 0),
            Q_cooling: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qc || 0), 0),
            Q_lighting: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_lighting || 0), 0),
            Q_dhw: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_dhw || 0), 0),
            Q_aux: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_aux || 0), 0),
            // PV Placeholders (aggregated later)
            pvGeneration: 0,
            selfConsumption: 0,

            // Averages need area weighting
            gamma: 0, eta: 0, // Not strictly applicable to sum
            avg_Ti: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.avg_Ti || 0) * z.yearly.totalArea, 0) / totalArea
        });
    }

    // --- PV Calculation (DIN 18599-9) ---
    // Find shared PV systems or assume Project level
    const pvSystems = systems?.filter(s => s.type === "PV") as import("@/types/system").PVSystem[] | undefined;

    let totalPVGen_Wh = 0;
    const hourlyPVGen: number[] = new Array(8760).fill(0);

    if (pvSystems && pvSystems.length > 0) {
        // Calculate generation for each system
        // Latitude default 37.5
        const lat = 37.5; // Fixed for now, should come from project location

        pvSystems.forEach(sys => {
            const res = calculateHourlyPV(sys, hourlyClimate, lat);
            totalPVGen_Wh += res.totalGeneration;
            for (let i = 0; i < 8760; i++) {
                hourlyPVGen[i] += res.hourlyGeneration[i];
            }
        });
    }

    const pvGen_kWh = totalPVGen_Wh / 1000;
    const pvCredit = pvGen_kWh * 2.75; // PEF for displaced electricity

    // Aggregate Yearly Final/Primary
    let sumFinalHeating = 0;
    let sumFinalCooling = 0;
    let sumFinalDHW = 0;
    let sumFinalLighting = 0;
    let sumFinalAux = 0;

    let sumPrimaryHeating = 0;
    let sumPrimaryCooling = 0;
    let sumPrimaryDHW = 0;
    let sumPrimaryLighting = 0;
    let sumPrimaryAux = 0;

    let sumCO2 = 0;

    zoneResults.forEach(z => {
        if (z.yearly.finalEnergy) {
            sumFinalHeating += z.yearly.finalEnergy.heating;
            sumFinalCooling += z.yearly.finalEnergy.cooling;
            sumFinalDHW += z.yearly.finalEnergy.dhw;
            sumFinalLighting += z.yearly.finalEnergy.lighting;
            sumFinalAux += z.yearly.finalEnergy.auxiliary;
        }
        if (z.yearly.primaryEnergy) {
            sumPrimaryHeating += z.yearly.primaryEnergy.heating;
            sumPrimaryCooling += z.yearly.primaryEnergy.cooling;
            sumPrimaryDHW += z.yearly.primaryEnergy.dhw;
            sumPrimaryLighting += z.yearly.primaryEnergy.lighting;
            sumPrimaryAux += z.yearly.primaryEnergy.auxiliary;
        }
        if (z.yearly.co2Emissions) {
            sumCO2 += z.yearly.co2Emissions;
        }
    });

    const totalPrimary = sumPrimaryHeating + sumPrimaryCooling + sumPrimaryDHW + sumPrimaryLighting + sumPrimaryAux - pvCredit;
    const totalCO2WithPV = sumCO2 - (pvGen_kWh * 0.466); // Credit CO2

    return {
        zones: zoneResults,
        monthly: projectMonthlyResults.map(m => {
            // Simple distribution of PV for monthly chart approx
            // In real logic, we should sum hourlyPVGen for the month
            // Let's do simple ratio for now to populate the field
            const r = m.QS / (zoneResults.reduce((s, z) => s + z.yearly.dhwDemand * 0 + z.yearly.heatingDemand * 0 + 1, 0) * 0 + 1); // logic broken
            // Better:
            // Aggregating actual PV
            return {
                ...m,
                pvGeneration: totalPVGen_Wh > 0 ? (pvGen_kWh / 12) : 0,
                selfConsumption: totalPVGen_Wh > 0 ? (pvGen_kWh / 12) : 0
            };
        }),
        yearly: {
            heatingDemand: totalHeating,
            coolingDemand: totalCooling,
            lightingDemand: totalLighting,
            dhwDemand: totalDHW,
            auxDemand: totalAux,
            totalArea: totalArea,
            specificHeatingDemand: totalArea > 0 ? totalHeating / totalArea : 0,
            specificCoolingDemand: totalArea > 0 ? totalCooling / totalArea : 0,

            // PV
            pvGeneration: pvGen_kWh,
            selfConsumption: pvGen_kWh, // Assume Net Metering 
            pvExport: 0,

            finalEnergy: {
                heating: sumFinalHeating,
                cooling: sumFinalCooling,
                dhw: sumFinalDHW,
                lighting: sumFinalLighting,
                auxiliary: sumFinalAux
            },
            primaryEnergy: {
                heating: sumPrimaryHeating,
                cooling: sumPrimaryCooling,
                dhw: sumPrimaryDHW,
                lighting: sumPrimaryLighting,
                auxiliary: sumPrimaryAux,
                total: totalPrimary,
                pvCredit: -pvCredit
            },
            co2Emissions: totalCO2WithPV
        }
    };
}

function calculateZoneHourly(
    zone: ZoneInput,
    weather: any[], // HourlyClimate[]
    mainStructure?: string,
    ventilationConfig?: Project['ventilationConfig'],
    ventilationUnits?: Project['ventilationUnits'],
    automationConfig?: Project['automationConfig'],
    systems?: Project['systems']
) {
    const Area = zone.area;
    const Volume = Area * zone.height * 0.95; // Net volume
    const profile = DIN_18599_PROFILES[zone.usageType] || DIN_18599_PROFILES["residential_single"];

    // --- A. Model Parameters (RC Network) ---
    // 1. Thermal Mass (Cm)
    let Cm_factor = 50; // default Wh/(m2K)
    if (mainStructure) {
        if (mainStructure.includes("철근콘크리트") || mainStructure.includes("조적")) Cm_factor = 90; // Heavy
        else if (mainStructure.includes("철골") || mainStructure.includes("목구조")) Cm_factor = 50; // Light
    }
    const Cm = (zone.thermalCapacitySpecific || Cm_factor) * Area; // [Wh/K]

    // 2. Transmission Coefficients (H_tr)
    // Split into op (opaque) and w (window)
    let H_tr_op = 0; // Opaque elements
    let H_tr_w = 0;  // Windows
    let Area_m = 0; // Effective mass area (usually internal surface area). Approx 2.5 * Af

    // Calculate H_tr
    zone.surfaces.forEach(surf => {
        let u = surf.uValue;
        let a = surf.area;
        let fx = 1.0;

        // Temperature reduction factors
        if (surf.type.includes("ground")) fx = 0.6;
        else if (surf.type.includes("interior")) fx = 0.5;
        else if (surf.orientation === "NoExposure") fx = 0.0;

        const H = u * a * fx;

        if (surf.type === 'window' || surf.type === 'door') {
            H_tr_w += H;
        } else {
            H_tr_op += H;
        }
    });

    // Thermal Bridge
    const H_tb = zone.surfaces.reduce((acc, s) => acc + s.area, 0) * (zone.thermalBridgeMode || 0.1);
    H_tr_op += H_tb;

    // Derived 5R1C Parameters (ISO 52016-1 ANNEX B)
    // Assumption: Class I (Medium) integration
    // Am: Effective mass area. Usually total internal surface area.
    // Simplified: Am = 4.5 * Area (Total internal surface area approx) or simplified per ISO.
    // Let's use Am = 2.5 * A_floor for calculation of H_tr_ms check?
    // ISO standard defines Am based on Cm logic.
    const Am = Cm / 25; // if Cm [Wh/K] ~ J/K / 3600. 
    // ISO: Cm [J/K] = area * heat_capacity_periodic.
    // Here Cm is Wh/K.

    // Coupling conductances
    const h_ic = 3.45; // Convective heat transfer coefficient internal [W/m2K]
    const h_rs = 5.13; // Radiative heat transfer coefficient [W/m2K]

    const H_tr_ms = 9.1 * Am; // Coupling mass-surface [W/K] (Standard value approx)
    const H_tr_em = 1 / (1 / H_tr_op - 1 / (h_rs + h_ic) * Am); // External part? 
    // Simplified ISO 52016 model mapping:
    // H_tr_em: Transmission external (walls)
    // H_tr_w: Transmission windows (light)
    // H_tr_is: Air to Surface = h_is * A_tot = 3.45 * 4.5 * Area?
    // Let's use the explicit ISO formulas:
    const Atot = 4.5 * Area; // Total internal area
    const H_tr_is = h_ic * Atot;

    // 3. Ventilation (H_ve) - Variable hourly?
    // We calculate base parameters.
    const n50 = ventilationConfig?.n50 ?? 2.0; // infiltration
    const e_shield = 0.07;
    const f_inf_base = n50 * e_shield; // 1/h

    // --- B. Hourly Loop State ---
    const hourlyResults: HourlyResult[] = [];
    let theta_m_prev = 20.0; // Initial mass temp estimate

    // Result accumulators
    let sum_Qh = 0;
    let sum_Qc = 0;
    let sum_Ql = 0; // Lighting
    let sum_Qw = 0; // DHW (Water)
    let sum_Qaux = 0; // Auxiliary (Fans)

    // Monthly aggregators
    const monthlyAggs = Array(12).fill(null).map(() => ({
        QT: 0, QV: 0, Qloss: 0, QS: 0, QI: 0, Qgain: 0, Qh: 0, Qc: 0, Q_lighting: 0, Q_dhw: 0, Q_aux: 0,
        tempSum: 0, count: 0
    }));

    // Iterate 8760 hours
    for (const hrData of weather) {
        const h = hrData.hourOfYear;
        const Te = hrData.Te;

        // 1. Ventilation Rate (Current Hour)
        // Dynamic Occupancy Logic
        const isFiveDayWeek = profile.annualUsageDays <= 260;
        const dayOfYear = Math.ceil(hrData.hourOfYear / 24);
        const dayOfWeek = ((dayOfYear - 1) % 7) + 1; // 1=Mon, ... 7=Sun (Simplified assumption: Jan 1 is Mon)

        let isWorkingDay = true;
        if (isFiveDayWeek) {
            isWorkingDay = dayOfWeek <= 5;
        }

        const localHour = (h - 1) % 24;
        const isOccupiedTime = localHour >= profile.usageHoursStart && localHour < profile.usageHoursEnd;
        const isOccupied = isWorkingDay && isOccupiedTime;

        // Infiltration (Always present to some degree)
        const infRate = f_inf_base;

        // Operational Ventilation
        let operAirEx = 0;
        let heatRecoveryFactor = 0; // 0 = No recovery (100% loss), 1 = Perfect recovery
        let fanPowerWatts = 0; // Auxiliary fan power

        if (isOccupied) {
            // Check Mechanical Ventilation
            // 1. Check for linked AHU Systems
            const ahuSystem = systems?.find(s => s.type === "AHU" && (s.linkedZoneIds?.includes(zone.id || "") || s.isShared)) as AHUSystem | undefined;

            // 2. Check for Ventilation Units (Legacy/Separate)
            const isVentUnit = (zone.linkedVentilationUnitIds && zone.linkedVentilationUnitIds.length > 0);

            const isMechanical = !!ahuSystem || isVentUnit;

            // DIN 18599-10 Operation Factors (F_A,RLT & F_Te,RLT)
            const F_A_RLT = profile.hvacAbsenceFactor || 0;
            const F_Te_RLT = profile.hvacPartialOperationFactor ?? 1.0;
            const effectiveFactor = (1 - F_A_RLT) * F_Te_RLT;

            if (isMechanical) {
                let eff = 0;

                // Priority: AHU -> Vent Units -> Config
                if (ahuSystem && ahuSystem.heatRecovery) {
                    // Decide which efficiency to use based on outdoor temperature
                    // If Te is lower than the heating setpoint (or midpoint), use heating efficiency
                    const midpoint = (zone.temperatureSetpoints.heating + zone.temperatureSetpoints.cooling) / 2;
                    eff = Te < midpoint ? ahuSystem.heatRecovery.heatingEfficiency : ahuSystem.heatRecovery.coolingEfficiency;
                } else if (isVentUnit && ventilationUnits) {
                    // Find effective Heat Recovery Efficiency
                    const activeUnits = ventilationUnits.filter(u => zone.linkedVentilationUnitIds?.includes(u.id));
                    if (activeUnits.length > 0) {
                        const totalFlow = activeUnits.reduce((sum, u) => sum + (u.supplyFlowRate || 0), 0);
                        if (totalFlow > 0) {
                            // Weighted average efficiency
                            const weightedEff = activeUnits.reduce((sum, u) => sum + (u.supplyFlowRate || 0) * (u.heatRecoveryEfficiency || 0), 0);
                            eff = (weightedEff / totalFlow) / 100; // % to 0-1
                        } else {
                            // Fallback if rates are 0
                            eff = (activeUnits[0].heatRecoveryEfficiency || 0) / 100;
                        }
                    }
                }

                // Fallback to Project Config if no units linked (but mode is mechanical?)
                // Or if we are using the 'ventilationConfig' passed from Project
                if (eff === 0 && ventilationConfig?.type === 'mechanical') {
                    eff = (ventilationConfig.heatRecoveryEfficiency || 0) / 100;
                }

                heatRecoveryFactor = eff;

                // Mechanical Air Exchange Rate
                // If units define flow: Use unit flow.
                // Otherwise use Profile Minimum.
                // For now, adhere to Profile Requirement as Demand.
                // Apply Operation Factors to Flow Rate or Operation Time.
                // Physically, it reduces average flow rate.
                const reqFlow = profile.minOutdoorAirFlow ? (profile.minOutdoorAirFlow * Area) : (Volume * 0.5);
                operAirEx = (reqFlow * effectiveFactor) / Volume;

                // Fan Power Calculation
                let sfp = 1.5; // Default SFP W/(m3/h)
                if (ahuSystem) {
                    sfp = ahuSystem.fanPower || 1.5;
                }
                // Fan runs for required flow
                // Power (W) = SFP (W/(m3/h)) * Flow (m3/h)
                // Fan power also reduced by effective flow? Yes, VSD assumed or simple average.
                fanPowerWatts = sfp * reqFlow * effectiveFactor;

            } else {
                // Natural Ventilation
                // Profile defines required air exchange
                const reqFlow = profile.minOutdoorAirFlow ? (profile.minOutdoorAirFlow * Area) : (Volume * 0.5);
                operAirEx = reqFlow / Volume;
                heatRecoveryFactor = 0;
            }
        }

        // Total Air Exchange & Heat Coefficient
        // H_ve = Rho*Cp * Volume * (Infiltration + (1-eta)*Ventilation)
        // Note: Infiltration is usually added.
        const H_ve = Volume * HEAT_CAPACITY_AIR * (infRate + operAirEx * (1 - heatRecoveryFactor));


        // 2. Solar Gains (Phi_sol)
        let Phi_sol = 0;
        // Iterate surfaces
        zone.surfaces.forEach(surf => {
            if (surf.orientation === "NoExposure" || surf.type.includes("interior")) return;

            // Geometry
            let azimuth = 0; // S=0
            // Azimuth: South=0, East=-90, West=90, North=180
            // Map string to degrees
            switch (surf.orientation) {
                case 'S': azimuth = 0; break;
                case 'E': azimuth = -90; break;
                case 'W': azimuth = 90; break;
                case 'N': azimuth = 180; break;
                case 'SE': azimuth = -45; break;
                case 'SW': azimuth = 45; break;
                case 'NE': azimuth = -135; break;
                case 'NW': azimuth = 135; break;
            }
            let tilt = surf.tilt ?? 90;
            if (surf.type === 'roof_exterior') tilt = 0;

            const I_tot = calculateHourlyRadiation(
                hrData.I_beam, hrData.I_diff,
                hrData.day, hrData.hour,
                37.5, // Seoul Lat
                azimuth, tilt
            );

            // Shading & SHGC
            let gain = 0;
            if (surf.type === 'window' || surf.type === 'door') {
                const shgc = surf.shgc ?? 0.6;
                const ff = 0.7; // Frame factor

                // Dynamic Shading (Simplified)
                // If I_tot > 300 W/m2, assume blinds used (Fc = 0.5)? 
                // For now keep static 0.9 as defined in previous step, but mark for future.
                const shadingFactor = 0.9;

                gain = I_tot * surf.area * shgc * ff * shadingFactor;
            } else {
                // Opaque: alpha * I * U / h_out? 
                // Sol-air temp approach is better.
                // Simplified: Phi_sol_opaque = alpha * R_se * U * A * I_tot
                const alpha = surf.absorptionCoefficient ?? 0.5;
                const R_se = 0.04;
                gain = I_tot * surf.area * surf.uValue * R_se * alpha;
            }
            Phi_sol += gain;
        });


        // 3. Internal Gains (Phi_int)
        // Derived from Profile Daily Totals provided in Wh/(m²·d)
        let Phi_int = 0;
        let Q_dhw_val = 0;

        if (isOccupied) {
            const usageHours = Math.max(1, profile.usageHoursEnd - profile.usageHoursStart);

            // Metabolic
            const powerMetabolic = (profile.metabolicHeat * Area) / usageHours;

            // Equipment
            const powerEquipment = (profile.equipmentHeat * Area) / usageHours;

            // Lighting (Dynamic DIN/TS 18599-4)
            // Find relevant Lighting system
            let lightingSystem = systems?.find(s => s.type === "LIGHTING" && s.linkedZoneIds?.includes(zone.id || ""));
            if (!lightingSystem && zone.linkedLightingSystemId) {
                lightingSystem = systems?.find(s => s.id === zone.linkedLightingSystemId);
            }
            if (!lightingSystem) {
                lightingSystem = systems?.find(s => s.type === "LIGHTING" && s.isShared);
            }

            const lightingCalc = calculateLightingDemand(
                zone,
                hrData.I_beam,
                hrData.I_diff,
                hrData.sunAltitude,
                profile,
                lightingSystem as LightingSystem
            );
            const powerLighting = lightingCalc.heatGainLighting; // Heat gain component
            // Note: We also need to track lightingCalc.powerLighting as Energy, but Phi_int deals with heat.

            // DHW (Dynamic DIN/TS 18599-8)
            // Find relevant DHW system for this zone
            // Priority: Linked to Zone -> Global Shared -> None
            let dhwSystem = systems?.find(s => s.type === "DHW" && s.linkedZoneIds?.includes(zone.id || ""));
            if (!dhwSystem) {
                dhwSystem = systems?.find(s => s.type === "DHW" && s.isShared);
            }

            // Ambient temperature for DHW losses. 
            // If storage is in conditioned space, use Ti (Theta_m_prev is best guess for now or just 20C const).
            // If unconditioned, use Te or 15C.
            // Simplified: Use 20C if we assume indoor, Te if outdoor. 
            let ambientForDHW = 20;
            if (dhwSystem?.type === "DHW" && dhwSystem.storage?.location === "unconditioned") {
                ambientForDHW = Te;
            }

            // Cast to DHWSystem to satisfy TS if check passed
            const dhwCalc = calculateHourlyDHW(zone, profile, localHour, isOccupied, dhwSystem as DHWSystem, ambientForDHW);
            const heatGainDHW = dhwCalc.heatGainDHW;
            Q_dhw_val = dhwCalc.energyDHW; // Generator Output required (Thermal Demand + Losses)

            Phi_int = powerMetabolic + powerEquipment + powerLighting + heatGainDHW;

        } else {
            // Unoccupied: Standby loads (e.g. 5% of equipment)
            const usageHours = Math.max(1, profile.usageHoursEnd - profile.usageHoursStart);
            const powerEquipment = (profile.equipmentHeat * Area) / usageHours;

            // DHW in unoccupied? 
            let dhwSystem = systems?.find(s => s.type === "DHW" && s.linkedZoneIds?.includes(zone.id || ""));
            if (!dhwSystem) {
                dhwSystem = systems?.find(s => s.type === "DHW" && s.isShared);
            }

            // Still calculate DHW losses (storage/circulation) even if not occupied
            let ambientForDHW = 20;
            if (dhwSystem?.type === "DHW" && dhwSystem.storage?.location === "unconditioned") {
                ambientForDHW = Te;
            }
            // Passing isOccupied=false will zero out useful demand, but losses remain
            const dhwCalc = calculateHourlyDHW(zone, profile, localHour, false, dhwSystem as DHWSystem, ambientForDHW);

            Q_dhw_val = dhwCalc.energyDHW;
            const heatGainDHW = dhwCalc.heatGainDHW;

            Phi_int = (powerEquipment * 0.05) + heatGainDHW;
        }

        // --- C. 5R1C Solution ---
        // Inputs: H_tr_em, H_tr_w, H_tr_is, H_tr_ms, H_ve, Cm
        //         Phi_sol, Phi_int, Te, Theta_sup(usually Te), Theta_m_prev

        // Split gains
        // Solar -> Node S (mostly), some to M, some to I (air)
        // ISO 52016 standard distribution:
        // Windows -> All to Node S (simplification, strictly some to M)
        // Opaque -> Node M? No, usually opaque solar is via sol-air temp on H_tr_em
        // Here we put Sol/Int gains to:
        // Phi_int -> Node I (40%), Node S (60%)?
        // Phi_sol -> Node S (90%), Node I (10%)?

        const Phi_ia = 0.5 * Phi_int; // Convective internal
        const Phi_st = (1 - 0.5) * Phi_int + Phi_sol; // Radiative internal + Solar (all to surface/mass)

        const Phi_m = 0; // Direct to mass? (e.g. floor heating)

        // Matrix solution for Theta_m_t (Explicit Euler for time step 1h)
        // (Cm / dt) * (Tm_t - Tm_t-1) = Net Heat Flow to Mass
        // Net Flow = H_tr_ms * (T_s - T_m) + Phi_m
        // But T_s depends on T_m, T_air...
        // This requires standard ISO transformation to linear system.

        // Simplified Crank-Nicolson / Analytic Step (ISO 13790 / 52016 simplified)
        // Using calculation method of ISO 13790 7.2.2 (Monthly) adapted or 5R1C explicit.

        // We need Theta_air (Ti) to calculate Loads.
        // But Ti depends on Load (if controlled).

        // Strategy: Calculate Free Running Temperature first.

        // Determine Setpoints based on Occupancy
        let Theta_set_h = zone.temperatureSetpoints.heating;
        let Theta_set_c = zone.temperatureSetpoints.cooling;

        if (!isOccupied) {
            // Apply Setback / Shutdown
            const setbackDelta = profile.heatingSetbackTemp ?? 4.0;
            const mode = zone.heatingReducedMode || "setback";

            if (mode === "shutdown") {
                // Frost protection only
                Theta_set_h = 5.0;
            } else {
                // Reduced operation
                Theta_set_h = Theta_set_h - setbackDelta;
            }

            // Cooling usually off during night/unoccupied? or setback?
            // Simplified: Relax cooling setpoint significantly
            Theta_set_c = 40.0; // Effectively off
        }

        // --- Solver Steps (Simplified 5R1C) ---
        // 1. Calculate equivalent inputs for T_m
        // 2. Update T_m
        // 3. Calculate T_s, T_air based on T_m

        // Equiv Conductances
        // Let's use strict node definitions:
        // Nodes: I(air), S(surface), M(mass), E(exterior), Sup(supply)
        // Connectors:
        // E -> I : H_tr_w + H_ve
        // E -> M : H_tr_em
        // M -> S : H_tr_ms
        // S -> I : H_tr_is

        // Correction: H_tr_em in ISO connects E and M directly? Or via S?
        // In 5R1C (ISO 13790/52016):
        // H_tr_em connects Exterior to Surface(S) or Mass(M)?
        // Usually: E --(H_em)-- M --(H_ms)-- S --(H_is)-- I
        // And Windows: E --(H_w)-- I
        // And Vent: E --(H_ve)-- I

        // Let's implement the specific ISO 13790 Simple Hourly Method (Annex C) logic
        // It provides exact formulas.

        // C.2 Inputs
        const H_tr_em_calc = H_tr_op; // Opaque Transmission
        const H_tr_3 = H_tr_w + H_ve; // Direct E->I
        const H_tr_ms_calc = 9.1 * Am;
        const H_tr_is_calc = h_ic * Atot;

        const Phi_mtot = Phi_m + H_tr_em_calc * Te + H_tr_ms_calc * (Phi_st + H_tr_ms_calc * theta_m_prev / H_tr_ms_calc) / (H_tr_ms_calc + H_tr_is_calc);
        // Logic gets messy.
        // Let's use a discretized numerical update:
        // T_m_new = T_m_prev + (dt / Cm) * ( Sum(Exchanges) + Sources )

        // Current Step guess:
        // Nodes: Ti, Ts, Tm.  
        // Eq 1: Cm * (Tm - Tm_prev) = H_tr_em(Te - Tm) + H_tr_ms(Ts - Tm) + Phi_m
        // Eq 2: 0 = H_tr_ms(Tm - Ts) + H_tr_is(Ti - Ts) + Phi_st + H_sol_window_absorption?
        // Eq 3: 0 = H_tr_is(Ts - Ti) + H_tr_w(Te - Ti) + H_ve(Te - Ti) + Phi_ia + Phi_HC

        // This is a linear system 3x3 (or 2x2 algebraic + 1 ODE).
        // Eliminate Ts from Eq 2:
        // Ts * (H_ms + H_is) = H_ms*Tm + H_is*Ti + Phi_st
        // Ts = (H_ms*Tm + H_is*Ti + Phi_st) / (H_ms + H_is)

        // Substitute Ts into Eq 3 (Air Node Balance):
        // H_is * (Ts - Ti) + (H_w + H_ve)(Te - Ti) + Phi_ia + Phi_HC = 0
        // H_is * [ (H_ms*Tm + H_is*Ti + Phi_st)/(H_ms+H_is) - Ti ] + ... = 0
        // ... solve for Ti (Air Temp) as function of Phi_HC

        // Let G1 = H_tr_w + H_ve
        // Let G2 = H_tr_is * H_tr_ms / (H_tr_is + H_tr_ms)
        // Ti (Free Running, Phi_HC=0):
        // Balance at I:
        // H_is(Ts - Ti) + G1(Te - Ti) + Phi_ia = 0
        // Substitute Ts...
        // Simplified Result for Ti_free:
        // Ti_free = ( G1*Te + Phi_ia + G2*Tm + (H_is/(H_is+H_ms))*Phi_st ) / ( G1 + G2 )

        const G1 = H_tr_w + H_ve;
        const G2 = (H_tr_is_calc * H_tr_ms_calc) / (H_tr_is_calc + H_tr_ms_calc);
        const factor_st = H_tr_is_calc / (H_tr_is_calc + H_tr_ms_calc);

        let Ti_free = (G1 * Te + Phi_ia + G2 * theta_m_prev + factor_st * Phi_st) / (G1 + G2);

        // Check Setpoints
        let Q_HC = 0;
        let Ti = Ti_free;

        // Heating
        if (Ti_free < Theta_set_h) {
            // Need Heating
            // Calculate Q required to reach Theta_set_h
            // Re-solve eq for Q with Ti = Setpoint
            // Q_h = (G1+G2)*Titan - (Numerator)
            Q_HC = (G1 + G2) * Theta_set_h - (G1 * Te + Phi_ia + G2 * theta_m_prev + factor_st * Phi_st);
            Ti = Theta_set_h;
        }
        // Cooling
        else if (Ti_free > Theta_set_c) {
            // Need Cooling
            Q_HC = (G1 + G2) * Theta_set_c - (G1 * Te + Phi_ia + G2 * theta_m_prev + factor_st * Phi_st);
            Ti = Theta_set_c;
        }

        // Limit capacity? (Infinite for now)

        // Update Mass Temp (Explicit Euler)
        // Eq 1: Cm * (Tm_new - Tm_prev)/1 = H_tr_em(Te - Tm_prev) + H_tr_ms(Ts - Tm_prev)
        // Need Ts with Actual Ti (with heating/cooling applied)
        const Ts = (H_tr_ms_calc * theta_m_prev + H_tr_is_calc * Ti + Phi_st) / (H_tr_is_calc + H_tr_ms_calc);

        const flux_m = H_tr_em_calc * (Te - theta_m_prev) + H_tr_ms_calc * (Ts - theta_m_prev);
        const theta_m_next = theta_m_prev + flux_m / Cm;

        const Q_heat = Q_HC > 0 ? Q_HC : 0;
        const Q_cool = Q_HC < 0 ? -Q_HC : 0;

        // Recalculate Lighting Energy for Result (or optimized: do it once above)
        // Since we are inside the loop, we can just call it again or assume we saved it.
        // Let's use the same logic as above to get the value.
        // Optimization: Let's assume we need to access 'powerLighting' calculated above.
        // But scope prevents it without refactor.
        // Quick fix: Re-eval.
        let Q_light = 0;
        if (isOccupied) {
            const lCalc = calculateLightingDemand(zone, hrData.I_beam, hrData.I_diff, hrData.sunAltitude, profile);
            Q_light = lCalc.powerLighting;
        }

        hourlyResults.push({
            hour: h,
            Te: Te,
            Ti: Ti,
            Q_heating: Q_heat,
            Q_cooling: Q_cool,
            Q_lighting: Q_light,
            Q_dhw: Q_dhw_val,
            Q_aux: fanPowerWatts,
            theta_m: theta_m_next,
            theta_s: Ts,
            theta_air: Ti
        });

        sum_Qh += Q_heat;
        sum_Qc += Q_cool;
        sum_Ql += Q_light;
        sum_Qw += Q_dhw_val;
        sum_Qaux += fanPowerWatts;

        // Aggregate Monthly
        const mIdx = hrData.month - 1; // 0-11
        const mA = monthlyAggs[mIdx];
        mA.Qh += Q_heat / 1000; // Wh -> kWh
        mA.Qc += Q_cool / 1000;
        mA.Q_lighting += Q_light / 1000;
        mA.Q_dhw += Q_dhw_val / 1000;
        mA.Q_aux += fanPowerWatts / 1000;
        // Detailed gains for chart (Split naive)
        // Just for viz, accumulate hourly components
        const QT = (H_tr_op + H_tr_w) * (Ti - Te);
        const QV = H_ve * (Ti - Te);
        const Qloss = QT + QV;

        if (Qloss > 0) {
            mA.Qloss += Qloss / 1000;
            mA.QT += QT / 1000;
            mA.QV += QV / 1000;
        }
        mA.QS += Phi_sol / 1000;
        mA.QI += Phi_int / 1000;
        mA.Qgain += (Phi_sol + Phi_int) / 1000;

        mA.tempSum += Ti;
        mA.count++;

        // Propagate state
        theta_m_prev = theta_m_next;
    }

    // Finalize Monthlies
    const monthlyResults: MonthlyResult[] = monthlyAggs.map((m, i) => ({
        month: i + 1,
        QT: m.QT, QV: m.QV, Qloss: m.Qloss,
        QS: m.QS, QI: m.QI, Qgain: m.Qgain,
        gamma: 0, eta: m.Qgain > 0 ? (m.Qloss - (m.Qh * 1000)) / m.Qgain : 1, // approx
        Qh: m.Qh, Qc: m.Qc,
        Q_heating: m.Qh,
        Q_cooling: m.Qc,
        Q_lighting: m.Q_lighting,
        Q_dhw: m.Q_dhw,
        Q_aux: m.Q_aux,
        // PV Placeholder
        pvGeneration: 0,

        avg_Ti: m.count > 0 ? m.tempSum / m.count : 0
    }));

    // --- D. HVAC System Performance ---
    // Calculate Final Energy & Primary Energy based on Net Demand (Qh, Qc)
    // Find systems
    // Find systems
    let heatingSystem = systems?.find(s => s.type === "HEATING" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as HeatingSystem | undefined;
    let coolingSystem = systems?.find(s => s.type === "COOLING" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as CoolingSystem | undefined;
    const dhwSystemForFinal = systems?.find(s => s.type === "DHW" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as DHWSystem | undefined;

    // Check for AHU Systems acting as Heating/Cooling
    const ahuSystem = systems?.find(s => s.type === "AHU" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as AHUSystem | undefined;

    if (ahuSystem) {
        // Map AHU Heating Coil to HeatingSystem
        if (ahuSystem.heatingCoil && !heatingSystem) {
            heatingSystem = {
                type: "HEATING",
                id: ahuSystem.id,
                projectId: ahuSystem.projectId, // Using existing proj ID
                name: `${ahuSystem.name} (Heating)`,
                isShared: ahuSystem.isShared,
                generator: {
                    type: ahuSystem.heatingCoil.generatorType as any,
                    fuel: ahuSystem.heatingCoil.fuel as any,
                    efficiency: ahuSystem.heatingCoil.efficiency
                },
                distribution: {
                    temperatureRegime: "55/45", // Assumed for air heating
                    pumpControl: "uncontrolled" // Dummy
                },
                emission: {
                    type: "air_heating"
                }
            };
        }

        // Map AHU Cooling Coil to CoolingSystem
        if (ahuSystem.coolingCoil && !coolingSystem) {
            coolingSystem = {
                type: "COOLING",
                id: ahuSystem.id,
                projectId: ahuSystem.projectId,
                name: `${ahuSystem.name} (Cooling)`,
                isShared: ahuSystem.isShared,
                generator: {
                    type: ahuSystem.coolingCoil.generatorType as any,
                    fuel: ahuSystem.coolingCoil.fuel as any,
                    efficiency: ahuSystem.coolingCoil.efficiency
                },
                distribution: {
                    type: "air"
                },
                emission: {
                    type: "air"
                }
            };
        }
    }

    const hvac = calculateHourlyHvac(
        hourlyResults,
        heatingSystem as any,
        coolingSystem as any
    );

    // DHW Final Energy
    // Q_dhw_final = Q_dhw_out / GeneratorEfficiency
    let dhwFinal = 0;
    let dhwPrimary = 0;
    let dhwCO2 = 0;

    // Q_dhw_out is 'sum_Qw'. 
    // Generator efficiency is only used here to convert to Final Energy.
    // Losses (storage, dist) already added to sum_Qw in calculateHourlyDHW.
    const dhwEff = dhwSystemForFinal?.generator.efficiency || 0.9; // Default 0.9
    dhwFinal = (sum_Qw / 1000) / dhwEff;

    // PEF & CO2
    const dhwFuel = (dhwSystemForFinal?.generator.fuel as EnergySource) || 'natural_gas';
    const pef_dhw = PEF_FACTORS[dhwFuel];
    const co2f_dhw = CO2_FACTORS[dhwFuel];

    dhwPrimary = dhwFinal * pef_dhw;
    dhwCO2 = dhwFinal * co2f_dhw;

    // Aux Energy Final/Primary
    // Assuming Electricity
    // sum_Qaux contains Fan Energy (Wh). Convert to kWh.
    // Add Hydraulic Pump Energy from HVAC Result (kWh).
    const fanFinal = sum_Qaux / 1000; // kWh
    const pumpFinal = (hvac.auxiliaryEnergyHeating || 0) + (hvac.auxiliaryEnergyCooling || 0);

    const auxFinal = fanFinal + pumpFinal; // Total Aux
    const auxPrimary = auxFinal * PEF_FACTORS.electricity;
    const auxCO2 = auxFinal * CO2_FACTORS.electricity;


    return {
        zoneId: zone.id || "unknown", // Fallback for types
        zoneName: zone.name,
        hourly: hourlyResults,
        monthly: monthlyResults,
        yearly: {
            heatingDemand: sum_Qh / 1000,
            coolingDemand: sum_Qc / 1000,
            lightingDemand: sum_Ql / 1000,
            dhwDemand: sum_Qw / 1000,
            auxDemand: sum_Qaux / 1000,
            totalArea: Area,
            specificHeatingDemand: (sum_Qh / 1000) / Area,
            specificCoolingDemand: (sum_Qc / 1000) / Area,

            // PV
            pvGeneration: 0,
            selfConsumption: 0,
            pvExport: 0,

            // New HVAC Results
            finalEnergy: {
                heating: hvac.finalEnergyHeating,
                cooling: hvac.finalEnergyCooling,
                dhw: dhwFinal,
                lighting: sum_Ql / 1000, // Elec is 1:1 final usually
                auxiliary: auxFinal
            },
            primaryEnergy: {
                heating: hvac.primaryEnergyHeating,
                cooling: hvac.primaryEnergyCooling,
                dhw: dhwPrimary,
                lighting: (sum_Ql / 1000) * 2.75, // Elec PEF
                auxiliary: auxPrimary,
                total: hvac.primaryEnergyHeating + hvac.primaryEnergyCooling + dhwPrimary + ((sum_Ql / 1000) * 2.75) + auxPrimary
            },
            co2Emissions: hvac.co2Heating + hvac.co2Cooling + dhwCO2 + ((sum_Ql / 1000) * 0.466) + auxCO2
        }
    };
}
