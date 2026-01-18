
import { Project, Zone, Surface, SurfaceType } from "@/types/project";

export interface ZoneInput extends Zone {
    projectId: string; // Ensure projectId is present
    surfaces: Surface[];
}

export interface MonthlyClimate {
    month: number;
    Te: number; // External Temperature (°C)
    Is_Horiz: number; // Global Solar Radiation horizontal (W/m² or kWh/m² depending on logic, let's use W/m² avg or kWh/m² month)
    // Actually DIN 18599 usually works with mean monthly values
}

export interface CalculationResults {
    monthly: MonthlyResult[];
    yearly: {
        heatingDemand: number; // kWh/a
        coolingDemand: number; // kWh/a
        totalArea: number; // m²
        specificHeatingDemand: number; // kWh/m²a
        specificCoolingDemand: number; // kWh/m²a
    };
}

export interface MonthlyResult {
    month: number;
    // Heat Losses
    QT: number; // Transmission (kWh)
    QV: number; // Ventilation (kWh)
    Qloss: number; // Total Loss (kWh)

    // Heat Gains
    QS: number; // Solar (kWh)
    QI: number; // Internal (kWh)
    Qgain: number; // Total Gain (kWh)

    // Ratios
    gamma: number; // Gain/Loss ratio
    eta: number; // Utilization factor

    // Final Demand
    Qh: number; // Heating Energy Demand (kWh)
    Qc: number; // Cooling Energy Demand (kWh)
}

export interface ClimateData {
    name: string;
    monthly: MonthlyClimate[];
}
