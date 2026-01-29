
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

export interface YearlyResult {
    heatingDemand: number;
    coolingDemand: number;
    totalArea: number;
    specificHeatingDemand: number;
    specificCoolingDemand: number;
}

export interface ZoneResult {
    zoneId: string;
    zoneName: string;
    monthly: MonthlyResult[];
    yearly: YearlyResult;
}

export interface CalculationResults {
    monthly: MonthlyResult[];
    yearly: YearlyResult;
    zones: ZoneResult[];
}

export interface MonthlyResult {
    month: number;
    // 난방 관련
    QT: number; // 전도 열손실
    QV: number; // 환기 열손실
    Qloss: number; // 총 열손실
    QS: number; // 태양열 획득
    QI: number; // 내부 발열
    Qgain: number; // 총 열획득
    gamma: number; // 획득/손실 비
    eta: number;   // 이용 계수
    Qh: number;    // 난방 소요량
    // 냉방 관련
    Qc: number;    // 냉방 소요량
    // 진단용
    warnings?: string[];
    // UI 표시용 추가 정보
    outdoorTemp?: number;
    indoorTemp?: number;          // 전체 가중 평균 (기존)
    indoorTempUsage?: number;     // 사용일 평균 (주간+야간)
    indoorTempNonUsage?: number;  // 비사용일 평균
    // 디버깅용 상세 데이터
    conductionDetails?: ConductionDetails;
    balanceDetails?: BalanceDetails;
}

export interface BalanceDetails {
    tau: number;    // 시상수
    Cm: number;     // 유효 열용량
    Htr: number;    // 전열 손실 계수
    Hve: number;    // 환기 손실 계수
    Htotal: number; // 총 열손실 계수
    alpha: number;  // 수치적 매개변수 a
    gamma: number;  // 이득/손실 비
    eta: number;    // 이용 효율
    Ti_set: number; // 난방 설정값
    Ti_we: number;  // 비사용일 설정값
    Ti_c: number;   // 냉방 설정값
    Ti_calc: number;// 계산된 월평균 실내온도
    // Setback / Reduced Operation Details
    f_NA: number;   // 야간 축소 운전 보정 계수
    f_we: number;   // 비사용일 축소 운전 보정 계수
    t_NA: number;   // 축소 운전 시간 (h)
    f_adapt: number; // 적응형 운전 계수
    delta_theta_i_NA: number; // 허용 온도 저감폭
    delta_theta_EMS: number; // EMS 보정 온도

}

export interface ConductionDetails {
    H_D: number;    // Direct (Ext)
    H_g: number;    // Ground
    H_U: number;    // Unheated
    H_A: number;    // Adjacent
    H_TB: number;   // Thermal Bridge
    H_tr: number;   // Total
    Area_envelope: number;
    Delta_U_wb: number;
}

export interface ClimateData {
    name: string;
    monthly: MonthlyClimate[];
}
