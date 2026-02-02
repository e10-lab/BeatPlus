import { Zone, Surface, Construction } from "@/types/project";

export interface ZoneInput extends Zone {
    projectId: string;
    surfaces: Surface[];
}

export interface MonthlyClimate {
    month: number;
    Te: number; // 월평균 외기 온도 (°C)
    Is_Horiz: number; // 수평면 전일사량 (kWh/m²/month)
}

export interface HourlyClimate {
    hourOfYear: number; // 1-8760
    month: number;
    day: number;
    hour: number;
    Te: number; // 외기 온도 (°C)
    I_beam: number; // 직달 일사량 (W/m²)
    I_diff: number; // 확산 일사량 (W/m²)
    sunAltitude: number; // 도 (Degrees)
    sunAzimuth: number; // 도 (Degrees)
}

export interface ClimateData {
    name: string;
    monthly: MonthlyClimate[];
    hourly?: HourlyClimate[]; // 선택 사항, 런타임에 생성됨
}


export interface HourlyResult {
    hour: number;
    Te: number; // 외기 온도
    Ti: number; // 실내 온도 (작용온도 또는 공기온도)
    Q_heating: number; // 난방 부하 (Wh)
    Q_cooling: number; // 냉방 부하 (Wh)
    Q_lighting: number; // 시간당 조명 에너지 (Wh)
    Q_dhw: number; // 급탕 에너지 (Wh)
    Q_aux: number; // 보조 에너지 (팬, 펌프 등) (Wh)

    // 태양광 발전량 추가
    pvGeneration?: number; // Wh

    // 디버깅을 위한 5R1C 노드별 상세 온도
    theta_m?: number;
    theta_s?: number;
    theta_air?: number;
}

export interface MonthlyResult {
    month: number;
    // 시간별 데이터로부터 집계됨
    Q_heating: number; // kWh (Qh)
    Q_cooling: number; // kWh (Qc)
    Q_lighting: number; // kWh
    Q_dhw: number; // kWh
    Q_aux: number; // kWh (보조 에너지)

    // 태양광 발전량 추가
    pvGeneration: number; // kWh
    selfConsumption?: number; // kWh

    avg_Ti: number; // 평균 실내 온도

    // 상세 에너지 밸런스 (시간별 데이터 집계)
    QT: number; // 관류 열손실 (kWh)
    QV: number; // 환기 열손실 (kWh)
    Qloss: number; // 총 열손실 (kWh)
    QS: number; // 일사 열취득 (kWh)
    QI: number; // 내부 발열 취득 (kWh)
    Qgain: number; // 총 열취득 (kWh)
    gamma: number; // 취득/손실 비 (선택 사항)
    eta: number; // 이용 효율 (선택 사항)

    // 하위 호환성 (선택 사항)
    Qh?: number;
    Qc?: number;

    warnings?: string[]; // 검정 결과 경고 (예: 환기 부족 등)
}

export interface YearlyResult {
    heatingDemand: number; // kWh/a (연간 난방 부하)
    coolingDemand: number; // kWh/a (연간 냉방 부하)
    lightingDemand: number; // kWh/a
    dhwDemand: number; // kWh/a
    auxDemand: number; // kWh/a (보조 에너지)
    totalArea: number; // 총 연면적
    specificHeatingDemand: number; // kWh/(m²a) 단위면적당 난방 부하
    specificCoolingDemand: number; // kWh/(m²a) 단위면적당 냉방 부하

    // 태양광 발전량 추가
    pvGeneration: number; // kWh
    selfConsumption: number; // kWh
    pvExport: number; // kWh

    finalEnergy?: {
        heating: number;
        cooling: number;
        dhw: number;
        lighting: number;
        auxiliary: number;
    };
    primaryEnergy?: {
        heating: number;
        cooling: number;
        dhw: number;
        lighting: number;
        auxiliary: number;
        total: number;
        // 태양광 기여도 (PV Credit)
        pvCredit?: number; // 총 1차 에너지를 줄이는 음수 값
    };
    co2Emissions?: number; // kgCO2/a (연간 이산화탄소 배출량)
}

export interface ZoneResult {
    zoneId: string;
    zoneName: string;
    hourly: HourlyResult[]; // 8760개 데이터
    monthly: MonthlyResult[]; // 12개 데이터
    yearly: YearlyResult;
}

export interface CalculationResults {
    zones: ZoneResult[];
    yearly: YearlyResult; // 프로젝트 단위 합계
    monthly: MonthlyResult[]; // 프로젝트 단위 합계
}
