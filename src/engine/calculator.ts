
import { DHWSystem, AHUSystem, HeatingSystem, CoolingSystem, LightingSystem, EnergyCarrier } from "@/types/system";
import { ZoneInput, CalculationResults, MonthlyResult, HourlyResult, ClimateData } from "./types";
import { Project, Construction } from "@/types/project";
import { getClimateData, generateHourlyClimateData } from "./climate-data";
import { calculateHourlyRadiation } from "./solar-calc";
import { calculateLightingDemand } from "./lighting-calc";
import { calculateHourlyDHW } from "./dhw-calc";
import { calculateHourlyHvac, HvacResult } from "./hvac-calc";
import { calculateHourlyPV } from "./pv-calc";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { PEF_FACTORS, CO2_FACTORS } from "@/lib/standard-values";

// 물리 상수
const HEAT_CAPACITY_AIR = 0.34; // 공기의 비열 Wh/(m³K) (또는 1200 J/(m³K) / 3600)
const STEFAN_BOLTZMANN = 5.67e-8;

/**
 * 구조체의 레이어 정보를 바탕으로 실내측 유효 열용량(Wh/m²K)을 계산합니다.
 * DIN V 18599-2 및 ISO 13786 기준을 참고합니다.
 */
export function calculateEffectiveThermalCapacity(construction: Construction): number {
    if (!construction.layers || construction.layers.length === 0) return 0;

    let totalKappa = 0; // [J/m²K]

    // 외피 구성 레이어 (1부터 n까지, 외측에서 내측 순서)
    // 열용량 산정 시에는 보통 실내측에서부터 유효한 질량을 합산합니다.
    // layers 배열이 [외측 ... 내측] 순서이므로 역순(내측부터)으로 처리합니다.
    const layers = [...construction.layers].reverse();

    for (const layer of layers) {
        const d = layer.thickness; // m
        const rho = layer.density || 0; // kg/m³
        const c = layer.specificHeat || 0; // J/kgK
        const thermalCond = layer.thermalConductivity || 0;

        // 단열재 레이어를 만나면 그 이후(더 바깥쪽) 레이어는 실내 열용량에 기여하지 않는 것으로 간주
        // (간략법: 열전도율이 0.06 W/mK 이하인 경우 단열재로 간주)
        if (thermalCond > 0 && thermalCond < 0.06) {
            // 단열재의 절반 정도까지만 유효하다고 보는 경우도 있으나, 
            // 여기서는 단열재 이전(내측) 레이어만 합산하는 보수적 방식을 채택합니다.
            break;
        }

        totalKappa += (d * rho * c);

        // 유효 깊이 제한 (보통 10cm(0.1m) 정도를 유효 두께로 봅니다.)
        // 여기서는 모든 레이어를 합산하되, 단열재에서 차단되는 방식을 우선 적용합니다.
    }

    // J/m²K -> Wh/m²K (1 Wh = 3600 J)
    return totalKappa / 3600;
}

/**
 * ISO 52016-1:2017 5R1C 모델 구현
 * 난방 및 냉방을 위한 시간당 에너지 소요량을 계산합니다.
 */
export function calculateEnergyDemand(
    zones: ZoneInput[],
    weatherData?: ClimateData,
    mainStructure?: string,
    ventilationConfig?: Project['ventilationConfig'],
    ventilationUnits?: Project['ventilationUnits'],
    automationConfig?: Project['automationConfig'],
    systems?: Project['systems'],
    constructions?: Construction[]
): CalculationResults {

    // 1. 기상 데이터 준비
    // 제공된 기상 데이터를 사용하거나 서울 표준 기상 데이터(Synthetic)를 기본값으로 사용
    const climateBase = weatherData || getClimateData();
    const hourlyClimate = climateBase.hourly || generateHourlyClimateData(climateBase.monthly);

    const projectHourlyResults: HourlyResult[] = []; // 필요한 경우 집계된 프로젝트 결과 저장

    // 결과 구조 초기화 (각 존별 시간당 계산 수행)
    const zoneResults = zones.map(zone => {
        if (zone.isExcluded) return null;

        return calculateZoneHourly(
            zone,
            hourlyClimate,
            mainStructure,
            ventilationConfig,
            ventilationUnits,
            automationConfig,
            systems,
            constructions
        );
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    // 연간 결과 집계
    const totalHeating = zoneResults.reduce((sum, z) => sum + z.yearly.heatingDemand, 0);
    const totalCooling = zoneResults.reduce((sum, z) => sum + z.yearly.coolingDemand, 0);
    const totalLighting = zoneResults.reduce((sum, z) => sum + z.yearly.lightingDemand, 0);
    const totalDHW = zoneResults.reduce((sum, z) => sum + z.yearly.dhwDemand, 0);
    const totalAux = zoneResults.reduce((sum, z) => sum + z.yearly.auxDemand, 0);
    const totalArea = zoneResults.reduce((sum, z) => sum + z.yearly.totalArea, 0);

    // 월간 결과 집계 (프로젝트 전체 차트용)
    const projectMonthlyResults: MonthlyResult[] = [];
    for (let m = 1; m <= 12; m++) {
        projectMonthlyResults.push({
            month: m,
            QT: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QT || 0), 0),
            QV: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QV || 0), 0),
            Qloss: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qloss || 0), 0),
            QS: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QS || 0), 0),
            QI: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.QI || 0), 0),
            Qgain: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qgain || 0), 0),
            Qh: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qh || 0), 0),
            Qc: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qc || 0), 0),
            Q_heating: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qh || 0), 0),
            Q_cooling: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Qc || 0), 0),
            Q_lighting: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_lighting || 0), 0),
            Q_dhw: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_dhw || 0), 0),
            Q_aux: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.Q_aux || 0), 0),
            // 태양광 발전 (나중에 집계)
            pvGeneration: 0,
            selfConsumption: 0,

            // 평균값 산출 (면적 가중 평균)
            gamma: 0, eta: 0,
            avg_Ti: zoneResults.reduce((s, z) => s + (z.monthly.find(zm => zm.month === m)?.avg_Ti || 0) * z.yearly.totalArea, 0) / totalArea
        });
    }

    // --- 태양광 발전 계산 (DIN 18599-9) ---
    // 공유 태양광 시스템이 있는지 확인하거나 프로젝트 레벨로 가정
    const pvSystems = systems?.filter(s => s.type === "PV") as import("@/types/system").PVSystem[] | undefined;

    let totalPVGen_Wh = 0;
    const hourlyPVGen: number[] = new Array(8760).fill(0);

    if (pvSystems && pvSystems.length > 0) {
        // 각 시스템별 발전량 계산
        const lat = 37.5; // 서울 위도 (향후 프로젝트 위치 정보에서 가져와야 함)

        pvSystems.forEach(sys => {
            const res = calculateHourlyPV(sys, hourlyClimate, lat);
            totalPVGen_Wh += res.totalGeneration;
            for (let i = 0; i < 8760; i++) {
                hourlyPVGen[i] += res.hourlyGeneration[i];
            }
        });
    }

    const pvGen_kWh = totalPVGen_Wh / 1000;
    const pvCredit = pvGen_kWh * PEF_FACTORS.electricity; // 에너지원별 가중치(PEF) 적용 (전력 기준)

    // 연간 최종 에너지 및 1차 에너지 집계
    let sumFinalHeating = 0;
    let sumFinalCooling = 0;
    let sumFinalDHW = 0;
    let sumFinalLighting = 0;
    let sumFinalAux = 0;

    let sumPrimaryHeating = 0;
    let sumPrimaryCooling = 0;
    let sumPrimaryDHW = 0;
    let sumPrimaryLighting = 0;
    let sumPrimaryAux = 0;

    let sumCO2 = 0;

    zoneResults.forEach(z => {
        if (z.yearly.finalEnergy) {
            sumFinalHeating += z.yearly.finalEnergy.heating;
            sumFinalCooling += z.yearly.finalEnergy.cooling;
            sumFinalDHW += z.yearly.finalEnergy.dhw;
            sumFinalLighting += z.yearly.finalEnergy.lighting;
            sumFinalAux += z.yearly.finalEnergy.auxiliary;
        }
        if (z.yearly.primaryEnergy) {
            sumPrimaryHeating += z.yearly.primaryEnergy.heating;
            sumPrimaryCooling += z.yearly.primaryEnergy.cooling;
            sumPrimaryDHW += z.yearly.primaryEnergy.dhw;
            sumPrimaryLighting += z.yearly.primaryEnergy.lighting;
            sumPrimaryAux += z.yearly.primaryEnergy.auxiliary;
        }
        if (z.yearly.co2Emissions) {
            sumCO2 += z.yearly.co2Emissions;
        }
    });

    const totalPrimary = sumPrimaryHeating + sumPrimaryCooling + sumPrimaryDHW + sumPrimaryLighting + sumPrimaryAux - pvCredit;
    const totalCO2WithPV = sumCO2 - (pvGen_kWh * 0.466); // PV 발전에 의한 탄소 배출 감소분

    return {
        zones: zoneResults,
        monthly: projectMonthlyResults.map(m => {
            // 월간 차트용 PV 발전량 합산
            return {
                ...m,
                pvGeneration: totalPVGen_Wh > 0 ? (pvGen_kWh / 12) : 0,
                selfConsumption: totalPVGen_Wh > 0 ? (pvGen_kWh / 12) : 0
            };
        }),
        yearly: {
            heatingDemand: totalHeating,
            coolingDemand: totalCooling,
            lightingDemand: totalLighting,
            dhwDemand: totalDHW,
            auxDemand: totalAux,
            totalArea: totalArea,
            specificHeatingDemand: totalArea > 0 ? totalHeating / totalArea : 0,
            specificCoolingDemand: totalArea > 0 ? totalCooling / totalArea : 0,

            // 태양광
            pvGeneration: pvGen_kWh,
            selfConsumption: pvGen_kWh, // 넷 미터링 가정
            pvExport: 0,

            finalEnergy: {
                heating: sumFinalHeating,
                cooling: sumFinalCooling,
                dhw: sumFinalDHW,
                lighting: sumFinalLighting,
                auxiliary: sumFinalAux
            },
            primaryEnergy: {
                heating: sumPrimaryHeating,
                cooling: sumPrimaryCooling,
                dhw: sumPrimaryDHW,
                lighting: sumPrimaryLighting,
                auxiliary: sumPrimaryAux,
                total: totalPrimary,
                pvCredit: -pvCredit
            },
            co2Emissions: totalCO2WithPV
        }
    };
}

function calculateZoneHourly(
    zone: ZoneInput,
    weather: any[], // 시간당 기상 데이터 (HourlyClimate[])
    mainStructure?: string,
    ventilationConfig?: Project['ventilationConfig'],
    ventilationUnits?: Project['ventilationUnits'],
    automationConfig?: Project['automationConfig'],
    systems?: Project['systems'],
    constructions?: Construction[]
) {
    const Area = zone.area;
    const Volume = Area * zone.height * 0.95; // 순 체적
    const profile = DIN_18599_PROFILES[zone.usageType] || DIN_18599_PROFILES["residential_single"];

    // --- A. 모델 파라미터 (RC 네트워크) ---
    // 1. 열용량 (Cm)
    let Cm_factor = 50; // 기본값 Wh/(m²K)

    // 구조체 레이어 기반 정밀 계산 시도
    let calculatedCmSum = 0;
    let hasLayerData = false;

    if (constructions && constructions.length > 0) {
        zone.surfaces.forEach(surf => {
            if (surf.constructionId) {
                const cons = constructions.find(c => c.id === surf.constructionId);
                if (cons && cons.layers && cons.layers.length > 0) {
                    const kappa = calculateEffectiveThermalCapacity(cons);
                    calculatedCmSum += (kappa * surf.area);
                    hasLayerData = true;
                }
            }
        });
    }

    if (mainStructure && !hasLayerData) {
        if (mainStructure.includes("철근콘크리트") || mainStructure.includes("조적")) Cm_factor = 90; // 중량 구조
        else if (mainStructure.includes("철골") || mainStructure.includes("목구조")) Cm_factor = 50; // 경량 구조
    }

    // 우선순위: 수동 입력 > 레이어 기반 계산 > 구조별 기본 계수
    const Cm = zone.thermalCapacitySpecific ? (zone.thermalCapacitySpecific * Area) :
        hasLayerData ? calculatedCmSum :
            (Cm_factor * Area); // [Wh/K]

    // 2. 전열 계수 (H_tr)
    // 불투명 외피(op)와 창호(w)로 분리
    let H_tr_op = 0; // 불투명 요소
    let H_tr_w = 0;  // 창호
    let Area_m = 0; // 유효 질량 면적 (보통 내부 표면적). 약 2.5 * Af

    // H_tr 계산
    zone.surfaces.forEach(surf => {
        let u = surf.uValue;
        let a = surf.area;
        let fx = 1.0;

        // 온도 보정 계수
        if (surf.type.includes("ground")) fx = 0.6;
        else if (surf.type.includes("interior")) fx = 0.5;
        else if (surf.orientation === "NoExposure") fx = 0.0;

        const H = u * a * fx;

        if (surf.type === 'window' || surf.type === 'door') {
            H_tr_w += H;
        } else {
            H_tr_op += H;
        }
    });

    // 열교 계산
    const H_tb = zone.surfaces.reduce((acc, s) => acc + s.area, 0) * (zone.thermalBridgeMode || 0.1);
    H_tr_op += H_tb;

    // ISO 52016-1(또는 DIN 18599-2)의 단순 시간별 계산법(5R1C) 파라미터 도출
    // Am: 유효 질량 면적 (Effective Mass Area, [m²])
    // ISO 52016-1 Annex B에 따라 Cm / 25로 산출.
    // 숫자 '25'는 구조체의 표준 단위 열용량인 25 Wh/(m²·K) (90,000 J/m²K)를 의미함.
    const Am = Cm / 25;

    // --- 한국 기준 R_si 반영 로직 ---
    // 벽체(0.11), 지붕(0.086), 바닥(0.086) 등 부위별로 다른 내부 열전달저항의 가중평균 산출
    let totalAreaOp = 0;
    let sumRsiArea = 0;

    zone.surfaces.forEach(s => {
        if (s.type !== 'window' && s.type !== 'door') {
            // 기본값 (벽체 0.11)
            let rsi = 0.11;

            // Construction 정보가 있으면 해당 값 사용, 없으면 부위별 표준값 적용
            const cons = constructions?.find(c => c.id === s.constructionId);
            if (cons) {
                rsi = cons.r_si;
            } else {
                if (s.type.includes('roof')) rsi = 0.086;
                else if (s.type.includes('floor')) rsi = 0.086;
                else rsi = 0.11;
            }

            sumRsiArea += rsi * s.area;
            totalAreaOp += s.area;
        }
    });

    // 구역 평균 내부 열전달저항 (R_si)
    const avgRsi = totalAreaOp > 0 ? sumRsiArea / totalAreaOp : 0.11;
    // 전체 내부 열전달 계수 (h_is = 1 / R_si)
    const h_is_total = 1 / avgRsi;

    // ISO 52016-1의 대류(3.45)/복사(5.13) 비율(약 4:6)을 유지하며 한국 기준 h_is를 분해
    const h_ic = h_is_total * (3.45 / 8.58); // 내부 대류 열전달 계수 [W/m²K]
    const h_rs = h_is_total * (5.13 / 8.58); // 내부 복사 열전달 계수 [W/m²K]

    // --- 5R1C 모델 상수 사전 계산 ---
    // Atot: 실내 총 내부 표면적 (천장, 바닥, 내벽 등 공기와 접촉하는 모든 표면)
    // 표준적인 주거/사무 공간의 경험적 계수 4.5를 적용 (ISO 52016-1 기준)
    const Atot = 4.5 * Area;

    // H_tr_ms: 질량 노드(Mass)와 표면 노드(Surface) 간의 열전달 계수 [W/K]
    // 9.1은 ISO 52016-1에서 규정한 단위 면적당 질량-표면 결합 계수 (9.1 W/m²K)
    const H_tr_ms = 9.1 * Am;
    const H_tr_is = h_ic * Atot; // 공기-표면 결합 계수 [W/K]

    // G2: 공기 노드와 질량 노드 사이의 유효 결합 계수 (직렬 연결)
    const G2 = (H_tr_is * H_tr_ms) / (H_tr_is + H_tr_ms);
    // factor_st: 표면 노드로 유입된 열량(일사 등)이 공기 노드로 배분되는 비율
    const factor_st = H_tr_is / (H_tr_is + H_tr_ms);

    // H_tr_em: 구조체 전열 계수에서 내부 표면 저항(avgRsi) 성분을 제거한 순수 전도+외부저항 성분
    const R_total_op = 1 / H_tr_op;
    const R_ms_coupling = 1 / ((h_rs + h_ic) * Am);
    const H_tr_em = R_total_op > R_ms_coupling ? 1 / (R_total_op - R_ms_coupling) : H_tr_op;

    // 3. 환기 (H_ve)
    const n50 = ventilationConfig?.n50 ?? 2.0; // 침기율
    const e_shield = 0.07;
    const f_inf_base = n50 * e_shield; // [1/h]

    // --- B. 시간당 루프 상태 ---
    const hourlyResults: HourlyResult[] = [];
    let theta_m_prev = 20.0; // 초기 질량 온도 추정치

    // 결과 누계용
    let sum_Qh = 0;
    let sum_Qc = 0;
    let sum_Ql = 0; // 조명
    let sum_Qw = 0; // 급탕
    let sum_Qaux = 0; // 부속 기기 (팬 등)

    // 월간 집계용
    const monthlyAggs = Array(12).fill(null).map(() => ({
        QT: 0, QV: 0, Qloss: 0, QS: 0, QI: 0, Qgain: 0, Qh: 0, Qc: 0, Q_lighting: 0, Q_dhw: 0, Q_aux: 0,
        tempSum: 0, count: 0
    }));

    // 8760시간 반복 계산
    for (const hrData of weather) {
        const h = hrData.hourOfYear;
        const Te = hrData.Te;

        // 1. 환기율 (현재 시간)
        // 동적 재실 로직
        const isFiveDayWeek = profile.annualUsageDays <= 260;
        const dayOfYear = Math.ceil(hrData.hourOfYear / 24);
        const dayOfWeek = ((dayOfYear - 1) % 7) + 1; // 1=월, ... 7=일 (1월 1일이 월요일이라고 가정)

        let isWorkingDay = true;
        if (isFiveDayWeek) {
            isWorkingDay = dayOfWeek <= 5;
        }

        const localHour = (h - 1) % 24;
        const isOccupiedTime = localHour >= profile.usageHoursStart && localHour < profile.usageHoursEnd;
        const isOccupied = isWorkingDay && isOccupiedTime;

        // 침기 (항상 일정 수준 존재)
        const infRate = f_inf_base;

        // 운전 환기
        let operAirEx = 0;
        let heatRecoveryFactor = 0; // 0 = 회수 없음 (100% 손실), 1 = 완벽한 회수
        let fanPowerWatts = 0; // 부속 팬 전력

        if (isOccupied) {
            // 기계 환기 확인
            // 1. 연결된 공조기(AHU) 시스템 확인
            const ahuSystem = systems?.find(s => s.type === "AHU" && (s.linkedZoneIds?.includes(zone.id || "") || s.isShared)) as AHUSystem | undefined;

            // 2. 개별 환기 장치 확인
            const isVentUnit = (zone.linkedVentilationUnitIds && zone.linkedVentilationUnitIds.length > 0);

            const isMechanical = !!ahuSystem || isVentUnit;

            // DIN 18599-10 운전 계수 (F_A,RLT 및 F_Te,RLT)
            const F_A_RLT = profile.hvacAbsenceFactor || 0;
            const F_Te_RLT = profile.hvacPartialOperationFactor ?? 1.0;
            const effectiveFactor = (1 - F_A_RLT) * F_Te_RLT;

            if (isMechanical) {
                let eff = 0;

                // 우선순위: AHU -> 환기 장치 -> 프로젝트 설정
                if (ahuSystem && ahuSystem.heatRecovery) {
                    // 외기 온도에 따라 가열/냉각 효율 결정
                    const midpoint = (zone.temperatureSetpoints.heating + zone.temperatureSetpoints.cooling) / 2;
                    eff = Te < midpoint ? ahuSystem.heatRecovery.heatingEfficiency : ahuSystem.heatRecovery.coolingEfficiency;
                } else if (isVentUnit && ventilationUnits) {
                    // 유효 열회수 효율 계산
                    const activeUnits = ventilationUnits.filter(u => zone.linkedVentilationUnitIds?.includes(u.id));
                    if (activeUnits.length > 0) {
                        const totalFlow = activeUnits.reduce((sum, u) => sum + (u.supplyFlowRate || 0), 0);
                        if (totalFlow > 0) {
                            // 가중 평균 효율
                            const weightedEff = activeUnits.reduce((sum, u) => sum + (u.supplyFlowRate || 0) * (u.heatRecoveryEfficiency || 0), 0);
                            eff = (weightedEff / totalFlow) / 100; // %를 0-1 소수로 변환
                        } else {
                            eff = (activeUnits[0].heatRecoveryEfficiency || 0) / 100;
                        }
                    }
                }

                if (eff === 0 && ventilationConfig?.type === 'mechanical') {
                    eff = (ventilationConfig.heatRecoveryEfficiency || 0) / 100;
                }

                heatRecoveryFactor = eff;

                // 기계 환기 횟수 계산
                const reqFlow = profile.minOutdoorAirFlow ? (profile.minOutdoorAirFlow * Area) : (Volume * 0.5);
                operAirEx = (reqFlow * effectiveFactor) / Volume;

                // 팬 전력 계산
                let sfp = 1.5; // 기본 SFP W/(m³/h)
                if (ahuSystem) {
                    sfp = ahuSystem.fanPower || 1.5;
                }
                fanPowerWatts = sfp * reqFlow * effectiveFactor;

            } else {
                // 자연 환기
                const reqFlow = profile.minOutdoorAirFlow ? (profile.minOutdoorAirFlow * Area) : (Volume * 0.5);
                operAirEx = reqFlow / Volume;
                heatRecoveryFactor = 0;
            }

            // --- 외기 냉방 (Free Cooling) 로직 ---
            // 냉방기이고 외기 온도가 충분히 낮으면 환기량을 늘림
            if (Te < (profile.coolingSetpoint - 2) && isOccupied) {
                const boostACH = 5.0; // 외기 냉방을 위해 5 ACH로 증대
                const boostFlow = boostACH * Volume;
                const currentFlow = operAirEx * Volume;
                if (boostFlow > currentFlow) {
                    operAirEx = boostFlow / Volume;
                    // 외기 냉방 시에는 열회수를 우회(Bypass)함
                    heatRecoveryFactor = 0;
                }
            }
        }

        // 총 환기율 및 환기 열전달 계수 계산
        const H_ve = Volume * HEAT_CAPACITY_AIR * (infRate + operAirEx * (1 - heatRecoveryFactor));


        // 2. 일사 획득 (Phi_sol)
        let Phi_sol = 0;
        zone.surfaces.forEach(surf => {
            if (surf.orientation === "NoExposure" || surf.type.includes("interior")) return;

            // 방위각 설정 (남=0, 동=-90, 서=90, 북=180)
            let azimuth = 0;
            switch (surf.orientation) {
                case 'S': azimuth = 0; break;
                case 'E': azimuth = -90; break;
                case 'W': azimuth = 90; break;
                case 'N': azimuth = 180; break;
                case 'SE': azimuth = -45; break;
                case 'SW': azimuth = 45; break;
                case 'NE': azimuth = -135; break;
                case 'NW': azimuth = 135; break;
            }
            let tilt = surf.tilt ?? 90;
            if (surf.type === 'roof_exterior') tilt = 0;

            const I_tot = calculateHourlyRadiation(
                hrData.I_beam, hrData.I_diff,
                hrData.day, hrData.hour,
                37.5, // 서울 위도
                azimuth, tilt
            );

            // 차양 및 SHGC 반영
            let gain = 0;
            if (surf.type === 'window' || surf.type === 'door') {
                const shgc = surf.shgc ?? 0.6;
                const ff = 0.7; // 프레임 계수

                // 동적 차양 (DIN/TS 18599-2)
                let shadingFactor = 1.0;
                if (surf.shading?.hasDevice) {
                    shadingFactor = surf.shading.fcValue ?? 0.9;
                }

                gain = I_tot * surf.area * shgc * ff * shadingFactor;
            } else {
                // 불투명 외피: 간략화된 일사 흡수 계산
                const alpha = surf.absorptionCoefficient ?? 0.5;
                const R_se = 0.04;
                gain = I_tot * surf.area * surf.uValue * R_se * alpha;
            }
            Phi_sol += gain;
        });


        // 3. 내부 발열 (Phi_int)
        let Phi_int = 0;
        let Q_dhw_val = 0;

        // 조명 (DIN/TS 18599-4)
        let lightingSystem = systems?.find(s => s.type === "LIGHTING" && s.linkedZoneIds?.includes(zone.id || ""));
        if (!lightingSystem && zone.linkedLightingSystemId) {
            lightingSystem = systems?.find(s => s.id === zone.linkedLightingSystemId);
        }
        if (!lightingSystem) {
            lightingSystem = systems?.find(s => s.type === "LIGHTING" && s.isShared);
        }

        if (isOccupied) {
            const usageHours = Math.max(1, profile.usageHoursEnd - profile.usageHoursStart);

            // 인체 발열
            const powerMetabolic = (profile.metabolicHeat * Area) / usageHours;

            // 기기 발열
            const powerEquipment = (profile.equipmentHeat * Area) / usageHours;


            const lightingCalc = calculateLightingDemand(
                zone,
                hrData.I_beam,
                hrData.I_diff,
                hrData.sunAltitude,
                profile,
                lightingSystem as LightingSystem
            );
            const powerLighting = lightingCalc.heatGainLighting; // 조명에 의한 입열 성분
            const powerLightingEnergy = lightingCalc.powerLighting; // 조명 에너지 소비량

            // 급탕 (DIN/TS 18599-8)
            let dhwSystem = systems?.find(s => s.type === "DHW" && s.linkedZoneIds?.includes(zone.id || ""));
            if (!dhwSystem) {
                dhwSystem = systems?.find(s => s.type === "DHW" && s.isShared);
            }

            // 급탕 손실 계산을 위한 주변 온도 설정
            let ambientForDHW = 20;
            if (dhwSystem?.type === "DHW" && dhwSystem.storage?.location === "unconditioned") {
                ambientForDHW = Te;
            }

            const dhwCalc = calculateHourlyDHW(zone, profile, localHour, isOccupied, dhwSystem as DHWSystem, ambientForDHW);
            const heatGainDHW = dhwCalc.heatGainDHW;
            Q_dhw_val = dhwCalc.energyDHW; // 열원기 출력 필요량 (열수요 + 손실)

            Phi_int = powerMetabolic + powerEquipment + powerLighting + heatGainDHW;

        } else {
            // 비재실 시: 대기 부하 (예: 기기의 5%)
            const usageHours = Math.max(1, profile.usageHoursEnd - profile.usageHoursStart);
            const powerEquipment = (profile.equipmentHeat * Area) / usageHours;

            let dhwSystem = systems?.find(s => s.type === "DHW" && s.linkedZoneIds?.includes(zone.id || ""));
            if (!dhwSystem) {
                dhwSystem = systems?.find(s => s.type === "DHW" && s.isShared);
            }

            // 비재실 시에도 유실(저장/순환)은 발생함
            let ambientForDHW = 20;
            if (dhwSystem?.type === "DHW" && dhwSystem.storage?.location === "unconditioned") {
                ambientForDHW = Te;
            }
            const dhwCalc = calculateHourlyDHW(zone, profile, localHour, false, dhwSystem as DHWSystem, ambientForDHW);

            Q_dhw_val = dhwCalc.energyDHW;
            const heatGainDHW = dhwCalc.heatGainDHW;

            Phi_int = (powerEquipment * 0.05) + heatGainDHW;
        }

        // --- C. 5R1C 해법 ---
        // 입력: H_tr_em, H_tr_w, H_tr_is, H_tr_ms, H_ve, Cm
        //       Phi_sol, Phi_int, Te, Theta_m_prev

        // 취득 열량 분리 (대류와 복사 성분)
        // ISO 52016 표준에 따른 배분:
        // Phi_int -> 노드 I (50%), 노드 S (50%)
        // Phi_sol -> 노드 S (100% 근사)

        const Phi_ia = 0.5 * Phi_int; // 내부 대류 취득
        const Phi_st = (1 - 0.5) * Phi_int + Phi_sol; // 내부 복사 및 일사 취득 (표면/질량 노드로 전달)

        const Phi_m = 0; // 질량 노드로의 직접 취득 (바닥 난방 등)

        // 전략: 먼저 냉난방 기기가 없는 상태의 자연 온도(Free Running Temperature)를 계산
        // 재실 여부에 따른 설정 온도 결정
        let Theta_set_h = zone.temperatureSetpoints.heating;
        let Theta_set_c = zone.temperatureSetpoints.cooling;

        if (!isOccupied) {
            // 야간 설정(Setback) 또는 운전 정지 반영
            const setbackDelta = profile.heatingSetbackTemp ?? 4.0;
            const mode = zone.heatingReducedMode || "setback";

            if (mode === "shutdown") {
                // 동파 방지 모드
                Theta_set_h = 5.0;
            } else {
                Theta_set_h = Theta_set_h - setbackDelta;
            }

            // 비재실 시 냉방은 정지한 것으로 가정
            Theta_set_c = 40.0;
        }

        // --- 솔버 단계 (Simplified 5R1C) ---
        // G1: 외기-공기 노드 간의 직접 연결 (창호 및 환기)
        const G1 = H_tr_w + H_ve;

        // 자연 실내 온도 계산 (Heating/Cooling = 0일 때)
        let Ti_free = (G1 * Te + Phi_ia + G2 * theta_m_prev + factor_st * Phi_st) / (G1 + G2);

        let Q_HC = 0;
        let Ti = Ti_free;

        // 난방 필요 확인
        if (Ti_free < Theta_set_h) {
            Q_HC = (G1 + G2) * Theta_set_h - (G1 * Te + Phi_ia + G2 * theta_m_prev + factor_st * Phi_st);
            Ti = Theta_set_h;
        }
        // 냉방 필요 확인
        else if (Ti_free > Theta_set_c) {
            Q_HC = (G1 + G2) * Theta_set_c - (G1 * Te + Phi_ia + G2 * theta_m_prev + factor_st * Phi_st);
            Ti = Theta_set_c;
        }

        // 질량 온도 업데이트 (Explicit Euler Method)
        const Ts = (H_tr_ms * theta_m_prev + H_tr_is * Ti + Phi_st) / (H_tr_is + H_tr_ms);
        const flux_m = H_tr_em * (Te - theta_m_prev) + H_tr_ms * (Ts - theta_m_prev);
        const theta_m_next = theta_m_prev + flux_m / Cm;

        const Q_heat = Q_HC > 0 ? Q_HC : 0;
        const Q_cool = Q_HC < 0 ? -Q_HC : 0;

        // 조명 에너지 소비량 재산출
        let Q_light = 0;
        if (isOccupied) {
            const lCalc = calculateLightingDemand(zone, hrData.I_beam, hrData.I_diff, hrData.sunAltitude, profile, lightingSystem as LightingSystem);
            Q_light = lCalc.powerLighting;
        }

        hourlyResults.push({
            hour: h,
            Te: Te,
            Ti: Ti,
            Q_heating: Q_heat,
            Q_cooling: Q_cool,
            Q_lighting: Q_light,
            Q_dhw: Q_dhw_val,
            Q_aux: fanPowerWatts,
            theta_m: theta_m_next,
            theta_s: Ts,
            theta_air: Ti
        });

        sum_Qh += Q_heat;
        sum_Qc += Q_cool;
        sum_Ql += Q_light;
        sum_Qw += Q_dhw_val;
        sum_Qaux += fanPowerWatts;

        // 월간 집계 데이터 업데이트
        const mIdx = hrData.month - 1;
        const mA = monthlyAggs[mIdx];
        mA.Qh += Q_heat / 1000; // Wh -> kWh
        mA.Qc += Q_cool / 1000;
        mA.Q_lighting += Q_light / 1000;
        mA.Q_dhw += Q_dhw_val / 1000;
        mA.Q_aux += fanPowerWatts / 1000;

        // 손실 및 취득 성분 분해 (차트 표시용)
        const QT = (H_tr_op + H_tr_w) * (Ti - Te);
        const QV = H_ve * (Ti - Te);
        const Qloss = QT + QV;

        if (Qloss > 0) {
            mA.Qloss += Qloss / 1000;
            mA.QT += QT / 1000;
            mA.QV += QV / 1000;
        }
        mA.QS += Phi_sol / 1000;
        mA.QI += Phi_int / 1000;
        mA.Qgain += (Phi_sol + Phi_int) / 1000;

        mA.tempSum += Ti;
        mA.count++;

        // 상태값 갱신
        theta_m_prev = theta_m_next;
    }

    // 월간 결과 마무리
    const monthlyResults: MonthlyResult[] = monthlyAggs.map((m, i) => ({
        month: i + 1,
        QT: m.QT, QV: m.QV, Qloss: m.Qloss,
        QS: m.QS, QI: m.QI, Qgain: m.Qgain,
        gamma: 0, eta: m.Qgain > 0 ? (m.Qloss - (m.Qh * 1000)) / m.Qgain : 1,
        Qh: m.Qh, Qc: m.Qc,
        Q_heating: m.Qh,
        Q_cooling: m.Qc,
        Q_lighting: m.Q_lighting,
        Q_dhw: m.Q_dhw,
        Q_aux: m.Q_aux,
        pvGeneration: 0,
        avg_Ti: m.count > 0 ? m.tempSum / m.count : 0,
        balanceDetails: {
            Cm: Cm
        }
    }));

    // --- D. 설비 시스템 성능 계산 ---
    // 요구 부하(Qh, Qc)를 바탕으로 최종 에너지 및 1차 에너지 계산
    let heatingSystem = systems?.find(s => s.type === "HEATING" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as HeatingSystem | undefined;
    let coolingSystem = systems?.find(s => s.type === "COOLING" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as CoolingSystem | undefined;
    const dhwSystemForFinal = systems?.find(s => s.type === "DHW" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as DHWSystem | undefined;

    // 공조기(AHU)가 난방/냉방을 담당하는 경우 확인
    const ahuSystem = systems?.find(s => s.type === "AHU" && (s.isShared || s.linkedZoneIds?.includes(zone.id || ""))) as AHUSystem | undefined;

    if (ahuSystem) {
        // AHU 가열 코일을 난방 시스템으로 매핑
        if (ahuSystem.heatingCoil && !heatingSystem) {
            heatingSystem = {
                type: "HEATING",
                id: ahuSystem.id,
                projectId: ahuSystem.projectId,
                name: `${ahuSystem.name} (가열)`,
                isShared: ahuSystem.isShared,
                generator: {
                    type: ahuSystem.heatingCoil.generatorType as any,
                    energyCarrier: ahuSystem.heatingCoil.energyCarrier as any,
                    efficiency: ahuSystem.heatingCoil.efficiency
                },
                distribution: {
                    temperatureRegime: "55/45", // 공기 가열용 가정
                    pumpControl: "uncontrolled"
                },
                emission: {
                    type: "air_heating"
                }
            };
        }

        // AHU 냉각 코일을 냉방 시스템으로 매핑
        if (ahuSystem.coolingCoil && !coolingSystem) {
            coolingSystem = {
                type: "COOLING",
                id: ahuSystem.id,
                projectId: ahuSystem.projectId,
                name: `${ahuSystem.name} (냉각)`,
                isShared: ahuSystem.isShared,
                generator: {
                    type: ahuSystem.coolingCoil.generatorType as any,
                    energyCarrier: ahuSystem.coolingCoil.energyCarrier as any,
                    efficiency: ahuSystem.coolingCoil.efficiency
                },
                distribution: {
                    type: "air"
                },
                emission: {
                    type: "air"
                }
            };
        }
    }

    const hvac = calculateHourlyHvac(
        hourlyResults,
        heatingSystem as any,
        coolingSystem as any
    );

    // 급탕 최종 에너지 계산
    // Q_dhw_final = Q_dhw_out / 발전 효율
    let dhwFinal = 0;
    let dhwPrimary = 0;
    let dhwCO2 = 0;

    const dhwEff = dhwSystemForFinal?.generator.efficiency || 0.9;
    dhwFinal = (sum_Qw / 1000) / dhwEff;

    // 1차 에너지(PEF) 및 이산화탄소 배출 계수 적용
    const dhwFuel = (dhwSystemForFinal?.generator.energyCarrier as EnergyCarrier) || 'natural_gas';
    const pef_dhw = PEF_FACTORS[dhwFuel];
    const co2f_dhw = CO2_FACTORS[dhwFuel];

    dhwPrimary = dhwFinal * pef_dhw;
    dhwCO2 = dhwFinal * co2f_dhw;

    // 부속 기기(팬, 펌프 등) 에너지 계산
    const fanFinal = sum_Qaux / 1000; // kWh
    const pumpFinal = (hvac.auxiliaryEnergyHeating || 0) + (hvac.auxiliaryEnergyCooling || 0);

    const auxFinal = fanFinal + pumpFinal; // 총 부속 에너지
    const auxPrimary = auxFinal * PEF_FACTORS.electricity;
    const auxCO2 = auxFinal * CO2_FACTORS.electricity;


    return {
        zoneId: zone.id || "unknown",
        zoneName: zone.name,
        hourly: hourlyResults,
        monthly: monthlyResults,
        yearly: {
            heatingDemand: sum_Qh / 1000,
            coolingDemand: sum_Qc / 1000,
            lightingDemand: sum_Ql / 1000,
            dhwDemand: sum_Qw / 1000,
            auxDemand: sum_Qaux / 1000,
            totalArea: Area,
            specificHeatingDemand: (sum_Qh / 1000) / Area,
            specificCoolingDemand: (sum_Qc / 1000) / Area,

            // 태양광
            pvGeneration: 0,
            selfConsumption: 0,
            pvExport: 0,

            // 최종 에너지 및 1차 에너지 결과
            finalEnergy: {
                heating: hvac.finalEnergyHeating,
                cooling: hvac.finalEnergyCooling,
                dhw: dhwFinal,
                lighting: sum_Ql / 1000,
                auxiliary: auxFinal
            },
            primaryEnergy: {
                heating: hvac.primaryEnergyHeating,
                cooling: hvac.primaryEnergyCooling,
                dhw: dhwPrimary,
                lighting: (sum_Ql / 1000) * PEF_FACTORS.electricity,
                auxiliary: auxPrimary,
                total: hvac.primaryEnergyHeating + hvac.primaryEnergyCooling + dhwPrimary + ((sum_Ql / 1000) * PEF_FACTORS.electricity) + auxPrimary
            },
            co2Emissions: hvac.co2Heating + hvac.co2Cooling + dhwCO2 + ((sum_Ql / 1000) * CO2_FACTORS.electricity) + auxCO2
        }
    };
}
