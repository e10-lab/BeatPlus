export interface Project {
    id?: string;
    userId: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    location?: {
        address?: string; // 기본 주소 (도로명 주소)
        detailAddress?: string; // 상세 주소 (사용자 입력, 예: 동/호수)
        city?: string;
        zipCode?: string;
        latitude?: number;
        longitude?: number;
        climateZone?: string; // DIN 18599 기후 구역 (예: "TRY 05")
    };
    siteArea?: number; // 대지면적 (m²)
    buildingArea?: number; // 건축면적 (m²)
    totalArea?: number; // 연면적 (m²)
    mainPurpose?: string; // 주 용도 (예: 업무시설)
    mainStructure?: string; // 주 구조 (예: 철근콘크리트)
    scale?: string; // 규모 (예: 지하1층 지상3층)
    permitDate?: string; // 허가일 (YYYY-MM-DD)
    constructionStartDate?: string; // 착공일 (YYYY-MM-DD)
    usageApprovalDate?: string; // 사용승인일 (YYYY-MM-DD)
    weatherStationId?: number; // 기상 관측소 ID (WeatherStation 외래 키)
    ventilationConfig?: {
        type: "natural" | "mechanical";
        systemType?: "balanced" | "exhaust"; // 신규: 열회수와 분리됨
        heatRecoveryEfficiency: number; // 0-100%
        infiltrationCategory?: "I" | "II" | "III" | "IV"; // DIN/TS 18599-2 표 6
        hasALD?: boolean; // 공기 전달 장치 (Air Transfer Devices) - ATD
        n50: number; // 계산된 표준 n50 값 (또는 조회값)
        isMeasured?: boolean; // true일 경우, n50을 수동으로 입력함
        dailyOperationHours?: number; // t_v,mech: 기계환기 일일 운전시간 (기본 24h)
    };
    ventilationUnits?: VentilationUnit[];
    automationConfig?: BuildingAutomationConfig; // DIN 18599-11
    simulationMethod?: "monthly" | "hourly"; // "monthly": DIN 18599 Normal, "hourly": 5R1C (ISO 13790)
    systems?: BuildingSystem[]; // Centralized list of all technical systems
}

import { BuildingSystem } from "./system";

export interface BuildingAutomationConfig {
    automationClass: "A" | "B" | "C" | "D"; // A: High performance, D: Non-energy efficient
    heatingControl: "manual" | "thermostatic" | "electronic_pi" | "bacs_ref";
    heatingTempControl?: "fixed" | "auto_adapt"; // New: Temperature setpoint control strategy
    coolingControl?: "manual" | "thermostatic" | "electronic_pi" | "bacs_ref";
    ventilationControl?: "manual" | "time_scheduled" | "demand_controlled";
}

export interface VentilationUnit {
    id: string;
    name: string;
    type: "balanced" | "exhaust" | "supply";
    category?: "fan" | "erv" | "ahu"; // UI 분류 카테고리
    heatRecoveryEfficiency: number; // 0-100%
    supplyFanPower?: number; // SFP [Wh/m³] 또는 전력 [kW] - 현재는 선택 사항
    supplyFlowRate?: number; // m³/h (선택 사항: 명시적 급기 풍량)
    exhaustFlowRate?: number; // m³/h (선택 사항: 명시적 배기 풍량)
}

export type ZoneUsageType =
    | "1_office" | "2_group_office" | "3_open_plan" | "4_meeting" | "5_counter_hall"
    | "6_retail" | "7_retail_refrig" | "8_classroom" | "9_lecture_hall" | "10_bed_room"
    | "11_hotel_room" | "12_canteen" | "13_restaurant" | "14_kitchen" | "15_kitchen_prep"
    | "16_wc" | "17_other_rooms" | "18_ancillary" | "19_traffic" | "20_storage_tech"
    | "21_datacenter" | "22_workshop_heavy" | "23_workshop_medium" | "24_workshop_light"
    | "25_auditorium_theater" | "26_foyer_theater" | "27_stage_theater" | "28_trade_fair"
    | "29_museum" | "30_library_reading" | "31_library_open" | "32_library_storage"
    | "33_gym" | "34_parking_office" | "35_parking_public" | "36_sauna" | "37_fitness"
    | "38_lab" | "39_exam_room" | "40_special_care" | "41_logistics" | "42_res_single"
    | "43_res_multi" | "44_dorm";

export interface Zone {
    id?: string;
    projectId: string;
    name: string;
    usageType: ZoneUsageType;
    area: number; // m² (Net Floor Area)
    height: number; // m
    volume: number; // m³
    temperatureSetpoints: {
        heating: number; // °C
        cooling: number; // °C
    };
    thermalBridgeMode?: number; // Delta_U_WB [W/(m²K)]: 0.05, 0.10 (Default), 0.15, or 0.03 (Cat B)
    lighting?: {
        powerDensity?: number; // W/m² (Optional override)
        efficacy?: number; // lm/W (Optional override, default ~60)
    };
    linkedLightingSystemId?: string; // Optional link to a shared LightingSystem
    orderIndex?: number;
    isExcluded?: boolean;
    linkedVentilationUnitIds?: string[]; // Reference to multiple VentilationUnits
    ventilationMode?: "natural" | "mechanical" | "balanced_mech"; // Explicit mode per zone
    thermalCapacitySpecific?: number; // Wh/(m²·K) - Specific Thermal Capacity
    heatingReducedMode?: "setback" | "shutdown"; // 야간/주말 운전 모드 (저감/정지)
    isPartialHeating?: boolean; // 6.1.2.4 공간적 부분 난방 (Teilbeheizung)
    partiallyHeatedAreaRatio?: number; // a_tb: 부분 난방 면적 비율 (0.0 - 1.0)
    partialHeatingLoadMax?: number; // Phi_h_max: 최대 난방 부하 밀도 (W/m², 선택 사항)

    // Geometry Visualization Properties (Removed)
    // coordinates/dimensions removed as per request
    color?: string;
}

export type SurfaceType =
    | "wall_exterior"
    | "wall_interior"
    | "wall_ground" // New: Wall against ground
    | "roof_exterior" // Renamed from 'roof' for clarity
    | "roof_interior" // For indirect exposure (e.g. ceiling under unconditioned space, though usually floor_interior covers this, but for Top roof structure it might be needed)
    | "roof_ground" // For underground roof? Or similar.
    | "floor_ground"
    | "floor_interior"
    | "floor_exterior" // New: Floor exposed to outside (e.g. pilotis)
    | "window"
    | "door";

export type Orientation = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | "Horiz" | "NoExposure";

export interface Surface {
    id?: string;
    zoneId: string; // 표면이 속한 존
    name: string;
    type: SurfaceType;
    area: number; // m²
    uValue: number; // W/(m²K)
    orientation?: Orientation;
    tilt?: number; // Tilt angle (90=vertical, 0=horizontal)

    // 6.2.2 Transmission to Unheated Space
    fx?: number; // Temperature Correction Factor (F_x), DIN V 18599-2. Default: 1.0 (outdoor) or 0.5 (unheated)

    // 6.2.3 Transmission to Adjacent Zone
    adjacentZoneId?: string; // ID of adjacent zone (if applicable)
    windowArea?: number; // 벽체에 포함된 창호 면적 (약식 계산용)
    absorptionCoefficient?: number; // alpha (0.0 - 1.0), 불투명체 기본값 0.5
    shgc?: number; // 태양열 취득 계수 (창호/문 전용, Envelope Type에서 가져옴)
    constructionId?: string; // 구조체(Construction) 참조
    orderIndex?: number;
}

export interface Material {
    id: string;
    name: string;
    category: "construction" | "iso_4898" | "f_5660" | "m_3871_1" | "l_9102" | "glass" | "air" | "gas" | "door";
    thermalConductivity: number; // λ (W/mK)
    density?: number; // kg/m³
    specificHeat?: number; // J/kgK
    defaultThickness?: number; // m (helper for UI)
}

export interface Layer {
    id: string;
    materialId: string;
    thickness: number; // m
    // Computed/Cached values for display
    name?: string;
    thermalConductivity?: number;
    density?: number;
    specificHeat?: number;
}

export interface Construction {
    id: string;
    projectId: string; // 프로젝트 소속 (템플릿 확장을 위해 'global' 가능)
    name: string;
    type: SurfaceType; // 구조체는 벽, 지붕, 바닥 등 특정 유형에 속함
    layers: Layer[];

    // 표면 열전달 저항 (m²K/W)
    r_si: number; // 내부
    r_se: number; // 외부

    // 프레임 (창호/문 전용)
    frameId?: string;

    // 계산된 값
    uValue: number; // W/m²K
    shgc?: number; // 태양열 취득 계수 (창호/문 전용)
    absorptionCoefficient?: number; // 태양 복사 흡수율 (불투명 외피 전용)
    totalThickness: number; // m

    // Override Flags
    isUValueManual?: boolean;
    isShgcManual?: boolean;

    orderIndex?: number; // 드래그 앤 드롭 정렬용
}
