
import { Project, Zone, Surface, SurfaceType } from "@/types/project";

export interface ZoneInput extends Zone {
    projectId: string;
    surfaces: Surface[];
}

export interface MonthlyClimate {
    month: number;
    Te: number; // Mean monthly external temperature (°C)
    Is_Horiz: number; // Global Solar Irradiance on horizontal (kWh/m²/month)
}

export interface HourlyClimate {
    hourOfYear: number; // 1-8760
    month: number;
    day: number;
    hour: number;
    Te: number; // External Temperature (°C)
    I_beam: number; // Beam Irradiance (W/m²)
    I_diff: number; // Diffuse Irradiance (W/m²)
    sunAltitude: number; // Degrees
    sunAzimuth: number; // Degrees
}

export interface ClimateData {
    name: string;
    monthly: MonthlyClimate[];
    hourly?: HourlyClimate[]; // Optional, generated on runtime
}


export interface HourlyResult {
    hour: number;
    Te: number; // Outdoor Temp
    Ti: number; // Indoor Temp (Operative/Air)
    Q_heating: number; // Heating Load (Wh)
    Q_cooling: number; // Cooling Load (Wh)
    // Detailed 5R1C node temperatures for debugging
    theta_m?: number;
    theta_s?: number;
    theta_air?: number;
}

export interface MonthlyResult {
    month: number;
    // Aggregated from Hourly
    Q_heating: number; // kWh (Qh)
    Q_cooling: number; // kWh (Qc)
    avg_Ti: number; // Average Indoor Temp

    // Detailed Energy Balance (aggregated from hourly)
    QT: number; // Transmission Loss (kWh)
    QV: number; // Ventilation Loss (kWh)
    Qloss: number; // Total Loss (kWh)
    QS: number; // Solar Gain (kWh)
    QI: number; // Internal Gain (kWh)
    Qgain: number; // Total Gain (kWh)
    gamma: number; // Gain/Loss Ratio (Optional)
    eta: number; // Utilization Factor (Optional)

    // Legacy support (optional)
    Qh?: number;
    Qc?: number;

    warnings?: string[]; // Verification warnings (e.g. ventilation shortage)
}

export interface YearlyResult {
    heatingDemand: number; // kWh/a
    coolingDemand: number; // kWh/a
    totalArea: number;
    specificHeatingDemand: number; // kWh/(m²a)
    specificCoolingDemand: number; // kWh/(m²a)
}

export interface ZoneResult {
    zoneId: string;
    zoneName: string;
    hourly: HourlyResult[]; // 8760 entries
    monthly: MonthlyResult[]; // 12 entries
    yearly: YearlyResult;
}

export interface CalculationResults {
    zones: ZoneResult[];
    yearly: YearlyResult; // Project level aggregation
    monthly: MonthlyResult[]; // Project level aggregation
}

