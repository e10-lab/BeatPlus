import { Zone, Surface, SurfaceType } from "@/types/project";
import { EnergyCarrier } from "@/types/system";

export interface ProjectStats {
    totalVolume: number; // 총 부피
    totalEnvelopeArea: number; // 총 외피 면적
}

/**
 * 1차 에너지 환산 계수 (Primary Energy Factors, PEF) - DIN/TS 18599:2025-10
 * 최종 에너지(kWh)를 1차 에너지(kWh)로 변환하는 데 사용되는 계수입니다.
 */
export const PEF_FACTORS: Record<EnergyCarrier, number> = {
    electricity: 1.8, // 최신 그리드 환경을 반영하여 2.75에서 1.8로 하향 조정
    natural_gas: 1.1,
    oil: 1.1,
    lpg: 1.1,
    district_heating: 0.6, // 현대적인 지역난방 시스템 기준
    wood_pellet: 0.2,
    biomass: 0.2,
    solar_thermal: 0.0
};

/**
 * 이산화탄소 배출 계수 (kgCO2/kWh) - DIN/TS 18599:2025-10 / GEG 2024
 */
export const CO2_FACTORS: Record<EnergyCarrier, number> = {
    electricity: 0.380, // 0.466에서 0.380으로 하향 조정
    natural_gas: 0.201,
    oil: 0.266,
    lpg: 0.230,
    district_heating: 0.150,
    wood_pellet: 0.020,
    biomass: 0.020,
    solar_thermal: 0
};

/**
 * 기본 온도 보정 계수 (Default Temperature Correction Factors, Fx)
 * DIN/TS 18599-2:2025-10 기반
 */
export const FX_DEFAULTS = {
    DIRECT: 1.0,    // 외기 직접 면함
    INDIRECT: 0.5,  // 비난방 공간 또는 인접 존 간접 면함
    GROUND: 0.6     // 지면 접함 (DIN 18599-2 표 3 참조, 바닥은 0.6, 벽은 0.5~0.6)
};

/**
 * 표면 노출 유형 (Exposure Category)
 * - DIRECT_EXTERIOR: 외기에 직접 면함 (b = 1.0)
 * - INDIRECT_EXTERIOR: 비난방 공간 등에 면함 (b < 1.0)
 * - GROUND_EXTERIOR: 지면에 접함 (b < 1.0)
 * - INTERIOR: 난방 공간 간 접함 (단열적 가정, b = 0)
 */
export enum ExposureCategory {
    DIRECT_EXTERIOR = "DIRECT_EXTERIOR",
    INDIRECT_EXTERIOR = "INDIRECT_EXTERIOR",
    GROUND_EXTERIOR = "GROUND_EXTERIOR",
    INTERIOR = "INTERIOR"
}

/**
 * 표면의 Fx 값과 타입 정보를 바탕으로 노출 유형을 결정합니다.
 */
export function getExposureCategory(surface: Surface): ExposureCategory {
    // 1. Fx 값이 명시적으로 있거나, 없으면 기본값 조회
    const fx = surface.fx !== undefined ? surface.fx : getFxDefault(surface.type);

    // 2. Fx 값에 따른 1차 분류
    if (fx >= 0.9) return ExposureCategory.DIRECT_EXTERIOR; // 1.0
    if (fx === 0.0) return ExposureCategory.INTERIOR;       // 0.0 (Adiabatic/Interior)

    // 3. Fx가 0 < fx < 0.9 인 경우 (Ground or Indirect)
    if (surface.type.includes("ground") || surface.type.includes("floor")) {
        // 바닥이면서 fx < 0.9 이면 Ground로 간주 (표준값 0.6)
        return ExposureCategory.GROUND_EXTERIOR;
    }

    // 그 외 (벽체인데 0.5 등) -> Indirect Exterior
    return ExposureCategory.INDIRECT_EXTERIOR;
}

/**
 * 표면 유형에 따른 기본 Fx 값을 반환합니다.
 */
export function getFxDefault(type: SurfaceType): number {
    if (type.includes("exterior")) return FX_DEFAULTS.DIRECT;
    if (type.includes("ground")) return FX_DEFAULTS.GROUND;
    if (type.includes("interior")) return FX_DEFAULTS.INDIRECT;
    if (type === "window" || type === "door") return FX_DEFAULTS.DIRECT;
    return FX_DEFAULTS.DIRECT;
}

/**
 * 존(Zones)과 표면(Surfaces) 데이터를 집계하여 건축물 총 부피 및 외피 면적을 계산합니다.
 */
export function calculateProjectStats(zones: Zone[], allSurfaces: Surface[]): ProjectStats {
    let totalVolume = 0;
    let totalEnvelopeArea = 0;

    zones.forEach(zone => {
        if (zone.isExcluded) return;
        totalVolume += zone.volume || (zone.area * zone.height);
    });

    const excludedZoneIds = new Set(zones.filter(z => z.isExcluded).map(z => z.id));

    allSurfaces.forEach(surface => {
        if (surface.zoneId && excludedZoneIds.has(surface.zoneId)) return;

        const category = getExposureCategory(surface);
        const isEnvelope = category !== ExposureCategory.INTERIOR;

        if (isEnvelope) {
            totalEnvelopeArea += surface.area;
        }
    });

    return { totalVolume, totalEnvelopeArea };
}

export type AirTightnessCategory = "I" | "II" | "III" | "IV";

/**
 * DIN/TS 18599-2:2025-10 표 8 - 기밀성 등급별 기본 n50 값
 */
export const N50_TABLE: Record<AirTightnessCategory, { n50: number, q50: number, n50_no_mech?: number, q50_no_mech?: number }> = {
    "I": { n50: 1.0, q50: 2.0, n50_no_mech: 2.0, q50_no_mech: 3.0 },
    "II": { n50: 4.0, q50: 6.0 },
    "III": { n50: 6.0, q50: 9.0 },
    "IV": { n50: 10.0, q50: 15.0 }
};

export function calculateStandardN50(
    totalVolume: number,
    totalEnvelopeArea: number,
    ventilationType: "natural" | "mechanical",
    category: AirTightnessCategory = "II"
): number {
    if (totalVolume <= 0) return 2.0;

    const entry = N50_TABLE[category];
    const hasMech = ventilationType === "mechanical";

    let n50_base = entry.n50;
    let q50_base = entry.q50;

    // Category I special case
    if (category === "I" && !hasMech) {
        n50_base = entry.n50_no_mech ?? n50_base;
        q50_base = entry.q50_no_mech ?? q50_base;
    }

    if (totalVolume <= 1500) {
        return n50_base;
    } else {
        // Equation 70: n50 = q50 * (A_E / V)
        return q50_base * (totalEnvelopeArea / totalVolume);
    }
}
