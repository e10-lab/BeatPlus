export interface Project {
    id?: string;
    userId: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    location?: {
        address?: string; // 기본 주소 (Road Address)
        detailAddress?: string; // 상세 주소 (User Input, e.g. Apt Unit)
        city?: string;
        zipCode?: string;
        latitude?: number;
        longitude?: number;
        climateZone?: string; // DIN 18599 Climate Zone (e.g., "TRY 05")
    };
    siteArea?: number; // 대지면적 (m²)
    buildingArea?: number; // 건축면적 (m²)
    totalArea?: number; // 연면적 (m²)
    mainPurpose?: string; // 주 용도 (e.g., 업무시설)
    mainStructure?: string; // 주 구조 (e.g., 철근콘크리트)
    scale?: string; // 규모 (e.g., 지하1층 지상3층)
    permitDate?: string; // 허가일 (YYYY-MM-DD)
    constructionStartDate?: string; // 착공일 (YYYY-MM-DD)
    usageApprovalDate?: string; // 사용승인일 (YYYY-MM-DD)
    weatherStationId?: number; // 기상 관측소 ID (Foreign Key to WeatherStation)
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
}

export type SurfaceType =
    | "wall_exterior"
    | "wall_interior"
    | "wall_ground" // New: Wall against ground
    | "roof"
    | "roof_interior" // For indirect exposure (e.g. ceiling under unconditioned space, though usually floor_interior covers this, but for Top roof structure it might be needed)
    | "roof_ground" // For underground roof? Or similar.
    | "floor_ground"
    | "floor_interior"
    | "floor_exterior" // New: Floor exposed to outside (e.g. pilotis)
    | "window"
    | "door";

export type Orientation = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | "Horiz";

export interface Surface {
    id?: string;
    zoneId: string; // Surfaces belong to a zone
    name: string;
    type: SurfaceType;
    area: number; // m²
    uValue: number; // W/(m²K)
    orientation?: Orientation;
    tilt?: number; // degrees (0 = horizontal, 90 = vertical)
    reductionFactor?: number; // fx values for shading etc.
    windowArea?: number; // if wall contains Window, simplified approach
    constructionId?: string; // Reference to a Construction
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
}

export interface Construction {
    id: string;
    projectId: string; // Belongs to a project (or "global" if we want templates later)
    name: string;
    type: SurfaceType; // Construction is specific to wall, roof, floor, etc.
    layers: Layer[];

    // Surface Heat Transfer Resistances (m²K/W)
    r_si: number; // Internal
    r_se: number; // External

    // Frame (Window/Door only)
    frameId?: string;

    // Computed
    uValue: number; // W/m²K
    totalThickness: number; // m
}
