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
        hasALD?: boolean; // 공기 전달 장치 (Air Transfer Devices)
        n50: number; // 계산된 표준 n50 값 (또는 조회값)
        isMeasured?: boolean; // true일 경우, n50을 수동으로 입력함
    };
    ventilationUnits?: VentilationUnit[];
    automationConfig?: BuildingAutomationConfig; // DIN 18599-11
}

export interface BuildingAutomationConfig {
    automationClass: "A" | "B" | "C" | "D"; // A: High performance, D: Non-energy efficient
    heatingControl: "manual" | "thermostatic" | "electronic_pi" | "bacs_ref";
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
    | "1_single_office" | "2_group_office" | "3_open_plan_office" | "4_meeting" | "5_counter"
    | "6_retail" | "7_retail_refrig" | "8_classroom" | "9_lecture_hall"
    | "10_bed_room" | "11_hotel_room" | "12_canteen" | "13_restaurant"
    | "14_kitchen" | "15_kitchen_prep" | "16_wc" | "17_common_area"
    | "18_support_store" | "19_corridor_care" | "20_storage_uncond" | "21_datacenter"
    | "22_1_workshop_light" | "22_2_workshop_medium" | "22_3_workshop_heavy"
    | "23_theater_audience" | "24_cloakroom" | "25_theater_foh" | "26_stage" | "27_exhibition"
    | "28_fair" // Note: Added based on search results for consistency if needed, but keeping list strict
    | "29_library_public" | "30_library_stack" | "31_gym"
    | "32_parking_office" | "33_parking_public"
    | "34_sauna" | "35_fitness" | "36_lab" | "37_exam_room" | "38_icu" | "39_corridor_icu"
    | "40_medical_practice" | "41_logistics" | "42_server_room"
    | "residential_single" | "residential_multi" | "residential_general";

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
    thermalBridgeMode?: number; // 0.05, 0.10, or 0.15
    lighting?: {
        powerDensity?: number; // W/m² (Optional override)
        efficacy?: number; // lm/W (Optional override, default ~60)
    };
    orderIndex?: number;
    isExcluded?: boolean;
    linkedVentilationUnitIds?: string[]; // Reference to multiple VentilationUnits
    ventilationMode?: "natural" | "mechanical" | "balanced_mech"; // Explicit mode per zone
    thermalCapacitySpecific?: number; // Wh/(m²·K) - Specific Thermal Capacity
    heatingReducedMode?: "setback" | "shutdown"; // Night/Weekend operation mode
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
    tilt?: number; // 각도 (0 = 수평, 90 = 수직)
    reductionFactor?: number; // 차양 등을 위한 fx 값
    windowArea?: number; // 벽체에 포함된 창호 면적 (약식 계산용)
    absorptionCoefficient?: number; // alpha (0.0 - 1.0), 불투명체 기본값 0.5
    shgc?: number; // 태양열 취득 계수 (창호/문 전용, Envelope Type에서 가져옴)
    shading?: {
        hasDevice: boolean;
        type?: "internal" | "external" | "intermediate"; // 차양 장치 위치
        fcValue: number; // 태양열 취득 감소 계수 (Reduction Factor, 0.0 - 1.0)
        operationMode?: "manual" | "automatic" | "fixed";
    };
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
    orderIndex?: number; // 드래그 앤 드롭 정렬용
}
