
import { Orientation } from "./project";
import { ControlType } from "../engine/systems/heating-emission-loss";

export type EnergyCarrier =
    | "electricity"
    | "natural_gas"
    | "oil"
    | "lpg"
    | "district_heating"
    | "wood_pellet"
    | "biomass"
    | "solar_thermal"; // Keeps as carrier for consistency with previous use, though debatably a source

export type HeatSource =
    | "outdoor_air"
    | "exhaust_air"
    | "ground_brine"
    | "ground_water"
    | "surface_water"
    | "waste_heat"
    | "solar";

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
        energyCarrier: EnergyCarrier;
        heatSource?: HeatSource;
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
        hasTimer?: boolean; // Circulation pump timer control
        pipeInsulation: "none" | "basic" | "good" | "reinforced";
        pipeLength?: number; // m (Estimated if not provided)
    };
}

// --- Heating System ---
export interface HeatingSystem extends SystemBase {
    type: "HEATING";
    generator: {
        type: "condensing_boiler" | "std_boiler" | "heat_pump" | "ehp" | "split" | "electric" | "district";
        energyCarrier: EnergyCarrier;
        heatSource?: HeatSource;
        efficiency: number; // Nominal Efficiency (0-1+)or COP
        partLoadValue?: number; // Efficiency at 30% load (for curve)
        capacity?: number; // kW (Maximum heating capacity)
    };
    distribution: {
        temperatureRegime: "90/70" | "70/50" | "55/45" | "35/28";
        pumpControl: "const_pressure" | "prop_pressure" | "uncontrolled";
        pipeLength?: number; // m
        pipeInsulation?: "none" | "basic" | "good" | "reinforced";
        operatingMode?: "continuous" | "daytime_only" | "night_setback" | "weekend_shutdown";
    };
    storage?: {
        volume: number; // Liters
        lossFactor?: number; // Wh/(L·d·K) or Watts standing loss
        temperature?: number; // °C
        location?: "conditioned" | "unconditioned";
    };
    emission: {
        // ── 1차 분류: 공간 유형 (천장고 4m 기준) ──
        spaceCategory?: "standard" | "hall";  // 일반 공간 (≤4m) / 대공간·홀 (>4m)

        // ── 2차 분류: 방열기 유형 ──
        // 일반 공간 (표 14~18): radiator, convector, fcu, floor_heating, wall_heating, ceiling_heating, tabs, supply_air, electric_heater
        // 대공간 (표 19): hall_air, infrared_radiant, ceiling_radiant_panel, hall_floor_heating
        type: "radiator" | "convector" | "fcu" | "floor_heating" | "wall_heating" | "ceiling_heating"
        | "tabs" | "supply_air" | "electric_heater"
        | "hall_air" | "infrared_radiant" | "ceiling_radiant_panel" | "hall_floor_heating";

        // ── 노출형 방열기 세부 (표 14) ──
        pipingType?: "two_pipe" | "one_pipe_improved" | "one_pipe" | "distributed";  // 배관 방식 (Δθ_str,1)
        radiatorPosition?: "interior_wall" | "exterior_wall_opaque" | "exterior_wall_transparent";  // 설치 위치 (Δθ_str,2)
        sunProtection?: boolean;  // 투명 창호 설치 시 일사 차단 장치 유무

        // ── 매립형 면난방 세부 (표 15, 16) ──
        embeddingType?: "wet" | "dry" | "low_coverage";      // 시공 방식 (Δθ_emb,1)
        floorInsulation?: "none" | "standard" | "enhanced";   // 하부 단열 수준 (Δθ_emb,2)

        // ── TABS (콘크리트코어 활성화) 전용 세부 (표 16) ──
        tabsControlType?: "constant_temp" | "central_or_electric"; // 일정한 공급 온도 vs 중앙 제어/전기식

        designTempDiff?: string; // 설계 온도차 (Δθ_m,N) (ui options : '60', '42.5', '30', '20')
        isIntermittent?: boolean; // 간헐 운전 실시 여부



        // ── 대공간 세부 (표 19) ──
        hasVerticalFan?: boolean; // 수직순환팬 유무
        hallAirSubType?: "wall_horizontal" | "low_temp_horizontal" | "ceiling_downward" | "low_temp_ceiling" | "ceiling_fan_2pos" | "ceiling_fan_pi";  // 대공간 공기난방 세부
        infraredSubType?: "standard" | "improved";  // 적외선 복사난방 세부
        ceilingPanelSubType?: "general" | "standard" | "improved";  // 천장 복사패널 세부
        roomHeight?: number;  // 대공간 천장고 (m) — 식 41에 사용

        // ── 공통 제어 (표 11, 12) ──
        controlType?: ControlType;
        isCertified?: boolean;   // 제어기 인증 여부 (EN 15500-1 등)
        // ── 수력 균형 (표 10, 배관 방식별 세분화) ──
        // 2관식: none, static, static_group_static, static_group_dynamic, dynamic
        // 1관식: none, static_loop, dynamic_loop, dynamic_return_temp, dynamic_delta_temp
        hydraulicBalancing?: "none" | "static" | "static_group_static" | "static_group_dynamic" | "dynamic"
        | "static_loop" | "dynamic_loop" | "dynamic_return_temp" | "dynamic_delta_temp";
        emitterCount?: number;  // 배관망 내 방열기 개수 n (표 10: n≤10 / n>10 분기)
        roomAutomation?: "none" | "time_control" | "start_stop_optimized" | "full_automation";
        hasVentilationLink?: boolean;  // 환기 설비 연동 여부 (층화 편차 감경)

        // ── 기타 물리적 속성 ──
        fanPower?: number;             // 전력 (W)
        convectiveFraction?: number;   // 대류 비율 0~1
        maxCapacity?: number;          // 최대 출력 (kW)
    };
}

// --- Cooling System ---
export interface CoolingSystem extends SystemBase {
    type: "COOLING";
    generator: {
        type: "compression_chiller" | "absorption_chiller" | "heat_pump" | "ehp" | "split";
        energyCarrier: EnergyCarrier;
        heatSource?: HeatSource;
        efficiency: number; // EER or SEER
        condenserType?: "air_cooled" | "water_cooled"; // Default air_cooled
    };
    distribution: {
        type: "air" | "water" | "refrigerant";
        pipeLength?: number; // m
        pipeInsulation?: "none" | "basic" | "good" | "reinforced";
    };
    storage?: {
        volume: number; // Liters
    };
    emission: {
        type: "surface" | "fan_coil" | "air";
        fanPower?: number; // Watts (Total for connected zones)
        convectiveFraction?: number; // 0.0 - 1.0
        maxCapacity?: number; // kW
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
    supplyAirTempCooling?: number; // C, cooling supply air temperature for 6K Rule

    // Heating Part
    heatingCoil?: {
        generatorType: "boiler" | "heat_pump" | "district" | "electric";
        energyCarrier: EnergyCarrier;
        heatSource?: HeatSource;
        efficiency: number;
    };

    // Cooling Part
    coolingCoil?: {
        generatorType: "chiller" | "heat_pump" | "district";
        energyCarrier: EnergyCarrier;
        heatSource?: HeatSource;
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
