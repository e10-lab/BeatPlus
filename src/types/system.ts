
import { Orientation } from "./project";

export type EnergyCarrier =
    | "electricity"
    | "natural_gas"
    | "oil"
    | "lpg"
    | "district_heating"
    | "wood_pellet"
    | "biomass"
    | "solar_thermal";

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
    isShared: boolean;
    linkedZoneIds?: string[];
}

// 신규 설비 시스템 구현을 위한 기초 타입 정의
// 모든 상세 시스템 타입은 삭제되었으며, 추후 새롭게 정의될 예정입니다.

export type BuildingSystem = SystemBase & {
    type: string;
    [key: string]: any;
};
