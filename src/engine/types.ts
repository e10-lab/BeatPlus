
import { Project, Zone, Surface, SurfaceType } from "@/types/project";

export interface ZoneInput extends Zone {
    projectId: string; // 프로젝트 ID 필수
    surfaces: Surface[];
}

export interface MonthlyClimate {
    month: number;
    Te: number; // 외기 온도 (°C)
    Is_Horiz: number; // 수평 전일사량 (W/m² 또는 kWh/m²)
    // DIN 18599는 일반적으로 월평균 값을 사용함
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
    warnings?: string[];
}

export interface MonthlyResult {
    month: number;
    // 열 손실 (Heat Losses)
    QT: number; // 전열 손실 (kWh)
    QV: number; // 환기 손실 (kWh)
    Qloss: number; // 총 열손실 (kWh)

    // 열 획득 (Heat Gains)
    QS: number; // 일사 획득 (kWh)
    QI: number; // 내부 발열 획득 (kWh)
    Qgain: number; // 총 열획득 (kWh)

    // 효율 및 비율 (Ratios)
    gamma: number; // 획득/손실 비 (Gain/Loss ratio)
    eta: number; // 이용 효율 (Utilization factor)

    // 최종 요구량 (Final Demand)
    Qh: number; // 난방 에너지 요구량 (kWh)
    Qc: number; // 냉방 에너지 요구량 (kWh)
    warnings?: string[];
}

export interface ClimateData {
    name: string;
    monthly: MonthlyClimate[];
}
