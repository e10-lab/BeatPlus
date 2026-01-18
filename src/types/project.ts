export interface Project {
    id?: string;
    userId: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    location: {
        address?: string;
        city: string;
        zipCode?: string;
        latitude?: number;
        longitude?: number;
        climateZone: string; // DIN 18599 Climate Zone (e.g., "TRY 05")
    };
}

export type ZoneUsageType =
    | "residential"
    | "office"
    | "meeting"
    | "classroom"
    | "warehouse"
    | "production";

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
    | "roof"
    | "floor_ground"
    | "floor_interior"
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
}
