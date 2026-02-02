import { Zone, Surface } from "@/types/project";
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
        totalEnvelopeArea += surface.area;
    });

    return { totalVolume, totalEnvelopeArea };
}

/**
 * 환기 방식 및 건물 부피에 따른 표준 기밀 성능(n50, 침기율) 값을 계산합니다.
 * DIN/TS 18599-2:2025-10 표 6 기준을 적용합니다.
 */
export function calculateStandardN50(
    totalVolume: number,
    totalEnvelopeArea: number,
    ventilationType: "natural" | "mechanical",
    category: "I" | "II" | "III" | "IV" = "I"
): number {
    if (totalVolume <= 0) return 2.0;

    const table6 = {
        "I": {
            small: { natural: 3.0, mechanical: 1.5 },
            large: { natural: 3.0, mechanical: 2.0 }  // q50 기준
        },
        "II": {
            small: { natural: 4.5, mechanical: 3.0 },
            large: { natural: 6.0, mechanical: 3.0 }  // q50 기준
        },
        "III": {
            small: 6.0,
            large: 9.0
        },
        "IV": {
            small: 10.0,
            large: 15.0
        }
    };

    if (totalVolume <= 1500) {
        const val = table6[category].small;
        return typeof val === "number" ? val : val[ventilationType];
    } else {
        const q50Val = table6[category].large;
        const q50 = typeof q50Val === "number" ? q50Val : q50Val[ventilationType];
        return q50 * (totalEnvelopeArea / totalVolume);
    }
}
