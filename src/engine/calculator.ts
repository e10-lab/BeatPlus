import { ZoneInput, CalculationResults, MonthlyResult, ClimateData } from "./types";
import { getClimateData } from "./climate-data";

// DIN V 18599 Parameters (Simplified)
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const HEAT_CAPACITY_AIR = 0.34; // Wh/(m³K) approx (0.34 * 1000 / 3600 ??? No, 1.2 kg/m3 * 1000 J/kgK = 1200 J/m3K. / 3600 = 0.333 Wh/m3K)
// Let's use 0.34 Wh/(m³K)

export function calculateEnergyDemand(zones: ZoneInput[]): CalculationResults {
    const climate = getClimateData("Seoul");
    const monthlyResults: MonthlyResult[] = [];

    // Initialize monthly accumulators
    for (let i = 0; i < 12; i++) {
        monthlyResults.push({
            month: i + 1,
            QT: 0, QV: 0, Qloss: 0,
            QS: 0, QI: 0, Qgain: 0,
            gamma: 0, eta: 0,
            Qh: 0, Qc: 0
        });
    }

    // Loop through each zone
    zones.forEach(zone => {
        const Ti = zone.temperatureSetpoints.heating; // Used for heating demand
        const Ti_cool = zone.temperatureSetpoints.cooling;
        const Area = zone.area;
        const Height = zone.height;
        const Volume = Area * Height * 0.8; // Net volume assumption
        // In DIN 18599-10 standardized: V_air = Area * Height * 0.8 is common, or specific logic.

        // Loop through months
        for (let m = 0; m < 12; m++) {
            const days = DAYS_IN_MONTH[m];
            const hours = days * 24;
            const Te = climate.monthly[m].Te;
            const Is_H = climate.monthly[m].Is_Horiz; // kWh/m²

            // --- 1. Heat Losses (Q_loss) ---

            // Transmission Loss (QT)
            // QT = sum(A * U * Fx) * (Ti - Te) * hours * 0.001 (for kWh if U in W)
            // But we work in kWh directly if coefficients are right.
            // U is W/m²K. 
            // H_T = sum(A * U) [W/K]
            let H_T = 0;
            zone.surfaces.forEach(surf => {
                // Fx factors: 1.0 for exterior, 0.5-0.8 for ground/unheated. 
                // Simplified: 1.0 everywhere for now except ground.
                let Fx = 1.0;
                if (surf.type === "floor_ground") Fx = 0.6; // Simplified ground factor
                if (surf.type === "wall_interior" || surf.type === "floor_interior") Fx = 0.0; // Adiabatic if interior-interior

                H_T += surf.area * surf.uValue * Fx;
            });

            // Ventilation Loss (QV)
            // H_V = V * n * C_p_air
            // n (air change rate) = 0.5 - 0.7 common. Let's use 0.5 1/h standard
            const ach = 0.5;
            const H_V = Volume * ach * HEAT_CAPACITY_AIR; // W/K

            // Total Loss coeff
            const H_total = H_T + H_V;

            // Total Loss Energy (Heating Mode)
            // Q_loss = H_total * (Ti - Te) * hours / 1000 (Wh -> kWh)
            // Note: If Te > Ti, this becomes negative (gain), handling required.
            // Usually we treat Qloss as strictly sum of losses.
            // DIN 18599 uses balance for heating vs cooling separately. 
            // For Heating: Base Temp Ti.
            const Qloss_h = Math.max(0, H_total * (Ti - Te) * hours / 1000);

            // --- 2. Heat Gains (Q_gain) ---

            // Solar Gains (QS)
            // QS = sum(A * I_s * g * Fsh * F_shade ...)
            // Need solar radiation on tilted surface. Simplified here:
            // Vertical South approx 0.8-1.5 * Horizontal depending on month.
            // Let's implement a very basic Factor per orientation
            let QS = 0;
            const g_value = 0.6; // Standard glass g-value
            zone.surfaces.forEach(surf => {
                if (surf.type === 'window') {
                    // Orientation factors (Simple approximation for Seoul latitude)
                    let F_orient = 1.0;
                    const orient = surf.orientation || "S";
                    if (orient === 'S') F_orient = m < 3 || m > 8 ? 1.5 : 0.8; // High in winter, lower in summer
                    else if (orient === 'N') F_orient = 0.2;
                    else if (orient === 'E' || orient === 'W') F_orient = 0.8;
                    else if (orient === 'Horiz') F_orient = 1.0;
                    else F_orient = 0.7; // SE, SW etc

                    // Is_surf = Is_H * F_orient
                    // QS = A * Is_surf * 0.9 (Frame factor) * g_value
                    QS += surf.area * (Is_H * F_orient) * 0.9 * g_value;
                }
            });

            // Internal Gains (QI)
            // Standard residential/office load.
            // Residential: 2-3 W/m². Office: 5-10 W/m².
            // Let's assume generic 4 W/m².
            const q_int = 4; // W/m²
            const QI = (Area * q_int * hours) / 1000; // kWh

            const Qgain_h = QS + QI;

            // --- 3. Utilization Factor (eta) ---
            // gamma = Qgain / Qloss
            // eta = (1 - gamma^a) / (1 - gamma^(a+1))
            // a = 1 + tau / 15 (Time constant)
            // Simple approach: a = 2.5 (Medium thermal mass)
            const gamma_h = Qloss_h > 0 ? Qgain_h / Qloss_h : 1000;
            const a = 3.0; // Parameter
            let eta_h = 1.0;
            if (gamma_h > 0 && Math.abs(gamma_h - 1) > 0.001) {
                eta_h = (1 - Math.pow(gamma_h, a)) / (1 - Math.pow(gamma_h, a + 1));
            } else if (Math.abs(gamma_h - 1) <= 0.001) {
                eta_h = a / (a + 1);
            }
            // Limit eta to 1.0? Calculation usually handles it, but good to be safe.
            // For heating, we want to know how much gain is useful.

            // Q_h_final
            const Qh = Math.max(0, Qloss_h - eta_h * Qgain_h);


            // --- Cooling (Simple Check) ---
            // For cooling, Losses help (are gains removed), Gains hurt.
            // Q_gain_c = QS + QI
            // Q_loss_c = H_total * (Ti_cool - Te) (if Ti_cool < Te, loss is negative/gain from outside)
            // But usually Q_loss_c defined as transmission outwards.
            // If Te > Ti_cool, transmission is INTO the building (Gain). 
            // Simplified: Q_cool_demand approx max(0, Qgain_c - eta_c * Qloss_c)
            // Need recalculate Qloss for cooling setpoint?
            // Yes.
            // Let's keep it very simple: if Te > Ti_cool, Transmission is Gain. 
            // We focus on Heating for this iteration as per task description emphasis on DIN 18599 (Heating).
            // But let's put a placeholder for cooling.
            const Qc = 0; // Placeholder for now

            // Accumulate to global results
            const res = monthlyResults[m];
            res.QT += (H_T * (Ti - Te) * hours / 1000); // Raw transmission
            res.QV += (H_V * (Ti - Te) * hours / 1000); // Raw ventilation
            res.Qloss += Qloss_h;

            res.QS += QS;
            res.QI += QI;
            res.Qgain += Qgain_h;

            res.Qh += Qh;
            res.Qc += Qc;

            // Average out eta/gamma? No, they are zone specific. 
            // For the total result, we might just sum demands. 
            // For specific results per month, we can't sum eta/gamma straightforwardly.
            // We'll leave them as 0 in the aggregate or use the last zone's (bad).
            // Better: CalculationResult should maybe just return the aggregate values. 
        }
    });

    // Calculate yearly totals
    const yearly = {
        heatingDemand: monthlyResults.reduce((acc, curr) => acc + curr.Qh, 0),
        coolingDemand: monthlyResults.reduce((acc, curr) => acc + curr.Qc, 0),
        totalArea: zones.reduce((acc, z) => acc + z.area, 0),
        specificHeatingDemand: 0,
        specificCoolingDemand: 0
    };

    if (yearly.totalArea > 0) {
        yearly.specificHeatingDemand = yearly.heatingDemand / yearly.totalArea;
        yearly.specificCoolingDemand = yearly.coolingDemand / yearly.totalArea;
    }

    return {
        monthly: monthlyResults,
        yearly
    };
}
