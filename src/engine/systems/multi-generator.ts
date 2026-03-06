/**
 * DIN/TS 18599-5:2025-10 6.5절 — 다중 열원 부하 분배
 *
 * 두 개 이상의 열원(예: 히트펌프+보일러, 보일러+보일러)이
 * 하나의 난방 시스템에 조합될 때, 순차 제어(Sequential Subtraction)
 * 기반으로 부하를 분배합니다.
 *
 * 핵심 로직:
 * 1. 1순위 열원이 자신의 최대 용량까지 가동
 * 2. 초과분만 2순위(피크 부하) 열원이 담당
 * 3. DHW 공유 시 급탕 우선 할당 (Kombibetrieb)
 */

// ─── 타입 정의 ───

/** 열원 기기 정의 */
export interface GeneratorUnit {
    id: string;
    name: string;
    type: 'condensing_boiler' | 'std_boiler' | 'low_temp_boiler' | 'heat_pump' | 'ehp' | 'electric' | 'district';
    priority: number;        // 우선순위 (1=기본부하, 2=피크부하)
    P_n: number;             // 정격 출력 (kW)
    efficiency: number;      // 정격 효율 (Hi 기준)
    partLoadValue?: number;  // 부분부하 효율
    energyCarrier: string;
    heatSource?: string;
    servesHeating: boolean;  // 난방 담당 여부
    servesDHW: boolean;      // 급탕 담당 여부
}

/** 부하 분배 입력 */
export interface LoadDistributionInput {
    generators: GeneratorUnit[];
    Q_h_demand: number;          // 월간 난방 요구량 (kWh) — 방열+분배+저장 손실 포함
    Q_dhw_demand?: number;       // 월간 급탕 요구량 (kWh)
    hoursInMonth: number;        // 월간 시간 (h)
}

/** 개별 열원 분배 결과 */
export interface GeneratorLoadResult {
    generatorId: string;
    priority: number;
    Q_heating: number;           // 이 열원이 담당하는 난방량 (kWh)
    Q_dhw: number;               // 이 열원이 담당하는 급탕량 (kWh)
    Q_total: number;             // 총 담당량 (kWh)
    beta: number;                // 이 열원의 부하율
    coverageRatio: number;       // 커버리지 계수 (κ = Q_gen / Q_total_demand)
}

/** 부하 분배 결과 */
export interface LoadDistributionResult {
    generators: GeneratorLoadResult[];
    totalHeatingDemand: number;
    totalDHWDemand: number;
    unmetHeating: number;        // 미충족 난방량 (kWh)
    unmetDHW: number;            // 미충족 급탕량 (kWh)
}

// ─── 핵심 함수 ───

/**
 * 다중 열원 부하 분배 — DIN/TS 18599-5 6.5절
 *
 * 순차 제어(Sequential Subtraction) 기반:
 * 1. 우선순위(priority) 순으로 정렬
 * 2. 각 열원이 최대 용량까지 부하 담당
 * 3. 잔여 부하를 다음 순위로 전달
 * 4. DHW 공유 시 급탕 우선 할당
 */
export function distributeLoad(input: LoadDistributionInput): LoadDistributionResult {
    const { generators, Q_h_demand, Q_dhw_demand = 0, hoursInMonth } = input;

    // 우선순위 순 정렬 (낮은 번호 = 높은 우선순위)
    const sorted = [...generators].sort((a, b) => a.priority - b.priority);

    const results: GeneratorLoadResult[] = [];
    let remainingHeating = Math.max(0, Q_h_demand);
    let remainingDHW = Math.max(0, Q_dhw_demand);
    const totalDemand = Q_h_demand + Q_dhw_demand;

    for (const gen of sorted) {
        // 이 열원의 월간 최대 생산량
        const Q_max = gen.P_n * hoursInMonth;

        let Q_dhw_gen = 0;
        let Q_heating_gen = 0;
        let availableCapacity = Q_max;

        // 1) DHW 우선 할당 (Kombibetrieb)
        if (gen.servesDHW && remainingDHW > 0) {
            Q_dhw_gen = Math.min(remainingDHW, availableCapacity);
            availableCapacity -= Q_dhw_gen;
            remainingDHW -= Q_dhw_gen;
        }

        // 2) 남은 용량으로 난방 할당
        if (gen.servesHeating && remainingHeating > 0 && availableCapacity > 0) {
            Q_heating_gen = Math.min(remainingHeating, availableCapacity);
            availableCapacity -= Q_heating_gen;
            remainingHeating -= Q_heating_gen;
        }

        const Q_total_gen = Q_heating_gen + Q_dhw_gen;

        // 부하율
        const beta = Q_max > 0 ? Q_total_gen / Q_max : 0;

        // 커버리지 비율
        const coverageRatio = totalDemand > 0 ? Q_total_gen / totalDemand : 0;

        results.push({
            generatorId: gen.id,
            priority: gen.priority,
            Q_heating: Q_heating_gen,
            Q_dhw: Q_dhw_gen,
            Q_total: Q_total_gen,
            beta,
            coverageRatio,
        });
    }

    return {
        generators: results,
        totalHeatingDemand: Q_h_demand,
        totalDHWDemand: Q_dhw_demand,
        unmetHeating: Math.max(0, remainingHeating),
        unmetDHW: Math.max(0, remainingDHW),
    };
}

/**
 * 단일 열원 시스템을 GeneratorUnit으로 변환하는 헬퍼
 * (기존 HeatingSystem과의 호환성 유지)
 */
export function heatingSystemToGenerator(
    heatingSystem: { generator: { type: string; efficiency: number; capacity?: number; partLoadValue?: number; energyCarrier: string; heatSource?: string }; id?: string; name?: string },
    options?: { servesDHW?: boolean; priority?: number }
): GeneratorUnit {
    return {
        id: heatingSystem.id || 'primary',
        name: heatingSystem.name || 'Primary Generator',
        type: heatingSystem.generator.type as GeneratorUnit['type'],
        priority: options?.priority ?? 1,
        P_n: heatingSystem.generator.capacity || 0,
        efficiency: heatingSystem.generator.efficiency,
        partLoadValue: heatingSystem.generator.partLoadValue,
        energyCarrier: heatingSystem.generator.energyCarrier,
        heatSource: heatingSystem.generator.heatSource,
        servesHeating: true,
        servesDHW: options?.servesDHW ?? false,
    };
}
