
import { Orientation } from "./project";

export type EnergySource =
    | "electricity"
    | "natural_gas"
    | "oil"
    | "lpg"
    | "district_heating"
    | "wood_pellet"
    | "solar_thermal"
    | "heat_pump_air"
    | "heat_pump_geo";

export interface SystemBase {
    id: string;
    name: string;
    projectId: string;
    isShared: boolean; // True if shared across multiple zones
    linkedZoneIds?: string[]; // If not shared, linked to specific zones
}

// --- Domestic Hot Water (DHW) ---
export interface DHWSystem extends SystemBase {
    type: "DHW";
    generator: {
        type: "boiler" | "heat_pump" | "electric_heater" | "district" | "solar";
        fuel: EnergySource;
        efficiency: number; // 0-1 (e.g. 0.9 for boiler, 3.0 for HP COP)
        capacity?: number; // kW
    };
    storage?: {
        volume: number; // Liters
        lossFactor?: number; // Wh/(L·d·K) or Watts standing loss
        temperature?: number; // °C (default 60)
        location?: "conditioned" | "unconditioned"; // Affects internal gains
    };
    distribution: {
        hasCirculation: boolean;
        pipeInsulation: "none" | "basic" | "good" | "reinforced";
        pipeLength?: number; // m (Estimated if not provided)
    };
}

// --- Heating System ---
export interface HeatingSystem extends SystemBase {
    type: "HEATING";
    generator: {
        type: "condensing_boiler" | "std_boiler" | "heat_pump" | "ehp" | "split" | "electric" | "district";
        fuel: EnergySource;
        efficiency: number; // Nominal Efficiency (0-1+)or COP
        partLoadValue?: number; // Efficiency at 30% load (for curve)
    };
    distribution: {
        temperatureRegime: "90/70" | "70/50" | "55/45" | "35/28"; // Flow/Return
        pumpControl: "const_pressure" | "prop_pressure" | "uncontrolled";
    };
    emission: {
        type: "radiator" | "floor_heating" | "fan_coil" | "air_heating";
        fanPower?: number; // Watts (Total for connected zones)
    };
}

// --- Cooling System ---
export interface CoolingSystem extends SystemBase {
    type: "COOLING";
    generator: {
        type: "compression_chiller" | "absorption_chiller" | "heat_pump" | "ehp" | "split";
        fuel: EnergySource;
        efficiency: number; // EER or SEER
        condenserType?: "air_cooled" | "water_cooled"; // Default air_cooled
    };
    distribution: {
        type: "air" | "water" | "refrigerant";
    };
    emission: {
        type: "surface" | "fan_coil" | "air";
        fanPower?: number; // Watts (Total for connected zones)
    };
}

// --- PV System ---
export interface PVSystem extends SystemBase {
    type: "PV";
    arrays: {
        name: string;
        capacity: number; // kWp
        moduleType: "crystalline" | "thin_film";
        orientation: Orientation;
        tilt: number;
        performanceRatio: number; // 0.75 default
    }[];
}

// --- AHU System (Unified Ventilation + Thermal) ---
export interface AHUSystem extends SystemBase {
    type: "AHU";
    // Ventilation Part
    airflow: number; // m3/h
    heatRecovery?: {
        heatingEfficiency: number; // 0-1
        coolingEfficiency: number; // 0-1
        type: "plate" | "rotary" | "run_around";
    };
    fanPower: number; // W/(m3/h) SFP

    // Heating Part
    heatingCoil?: {
        generatorType: "boiler" | "heat_pump" | "district" | "electric";
        fuel: EnergySource;
        efficiency: number;
    };

    // Cooling Part
    coolingCoil?: {
        generatorType: "chiller" | "heat_pump" | "district";
        fuel: EnergySource;
        efficiency: number;
    };
}

// --- Lighting System ---
export interface LightingSystem extends SystemBase {
    type: "LIGHTING";
    lightingEfficacy: number; // lm/W
    controlType: "manual" | "occupancy" | "daylight" | "dual" | "constant";
    hasConstantIlluminanceControl: boolean;
    parasiticPowerDensity?: number; // W/m2 standby
}

export type BuildingSystem = DHWSystem | HeatingSystem | CoolingSystem | PVSystem | AHUSystem | LightingSystem;
