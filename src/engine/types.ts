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
    latitude?: number; // 위도 (Decimal Degrees)
    monthly: MonthlyClimate[];
    hourly?: HourlyClimate[]; // 선택 사항, 런타임에 생성됨
}


export interface SurfaceHourlyResult {
    id: string; // Surface ID
    Q_trans: number; // Transmission Heat Loss (Wh)
    Q_sol: number; // Solar Heat Gain (Wh)
    I_sol: number; // Incident Solar Radiation (Wh)
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

    // 상세 부하 성분 (검토용)
    Q_trans_heat?: number; // 전열 손실 (Wh) - 난방 관점 ((Ti-Te)*H_tr)
    Q_vent_heat?: number; // 환기 손실 (Wh) - 난방 관점 ((Ti-Te)*H_ve)
    Q_sol_gain?: number; // 일사 취득 (Wh)
    Q_int_gain?: number; // 내부 발열 (Wh)

    Q_trans_bridge?: number; // 열교 손실 (Wh) - 추가

    // 실내온도 계산 인자 (Factors for Indoor Temp Calculation)
    H_tr?: number; // Transmission Heat Transfer Coefficient (W/K)
    H_ve?: number; // Ventilation Heat Transfer Coefficient (W/K)

    // 상세 표면별 결과 (Surface-level breakdown)


    surfaceResults?: { [surfaceId: string]: SurfaceHourlyResult };

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

    avg_Ti: number; // 평균 실내 온도 (Heating Effective)
    avg_Ti_c?: number; // 평균 실내 온도 (Cooling Effective) for verification
    avg_Ti_op?: number; // 사용일 평균 실내 온도 (°C)
    avg_Ti_non_op?: number; // 비사용일 평균 실내 온도 (°C)

    // 상세 에너지 밸런스 (시간별 데이터 집계)
    QT: number; // 관류 열손실 (kWh) - Legacy (Heating)
    QV: number; // 환기 열손실 (kWh) - Legacy (Heating)

    // 분리된 열손실 (Separated Heat Losses)
    QT_heat: number; // 난방 기준 관류 열손실 (kWh)
    QT_cool: number; // 냉방 기준 관류 열취득/손실 (kWh)
    QV_heat: number; // 난방 기준 환기 열손실 (kWh)
    QV_cool: number; // 냉방 기준 환기 열취득/손실 (kWh)

    Qloss: number; // 총 열손실 (kWh)
    QS: number; // 일사 열취득 (kWh)
    QI: number; // 내부 발열 취득 (kWh)
    Qgain: number; // 총 열취득 (kWh)
    gamma: number; // 취득/손실 비 (선택 사항)
    eta: number; // 이용 효율 (선택 사항)

    // Debug / Verification Fields (Optional)
    Theta_int_H?: number; // Base Setpoint
    Theta_i_h?: number;   // Calculated Effective Setpoint
    tau?: number;         // Time Constant (Legacy/Heating)
    tau_h?: number;       // Time Constant for Heating (h)
    tau_c?: number;       // Time Constant for Cooling (h)
    f_NA?: number;        // Night Setback Factor
    f_we?: number;        // Weekend Factor
    Cm?: number;          // Thermal Capacity
    H_tot?: number;       // Total Heat Transfer Coefficient
    Theta_int_C?: number; // Base Cooling Setpoint
    t_h_op_d?: number;    // Daily Heating Op Hours
    t_NA?: number;        // Night hours
    f_adapt?: number;     // Adaptive/Automation factor
    delta_theta_EMS?: number; // Automation-based setpoint reduction
    Delta_theta_i_NA?: number; // Night Setback Temperature Reduction (K)
    eta_C?: number;       // Cooling Utilization factor
    gamma_C?: number;     // Cooling Gain/Loss ratio
    a_H?: number;         // Heating Utilization Parameter
    a_C?: number;         // Cooling Utilization Parameter

    // Ventilation Details (For Ventilation Report)
    V_net?: number;       // Net Volume (m3)
    n_inf?: number;       // Infiltration Rate (1/h)
    n_win?: number;       // Window Ventilation Rate (1/h)
    n_mech?: number;      // Mechanical Ventilation Rate (1/h)
    heatRecoveryEff?: number; // Heat Recovery Efficiency
    isForcedMech?: number; // 1 if forcedMechanical, 0 otherwise

    // Additional Ventilation Verification Params
    n50?: number;         // Air Change Rate at 50Pa (1/h)
    e_shield?: number;    // Shielding coefficient e
    f_ATD?: number;       // Air Terminal Device factor
    f_e?: number;         // Temperature ratio factor
    t_v_mech?: number;    // Mechanical Ventilation Operation Hours (h/d)
    A_E?: number;         // Envelope Area (m2)
    q50?: number;         // Air Permeability at 50Pa (m3/hm2)

    // A_E Breakdown for verification
    A_ext?: number;       // Exterior surfaces area
    fx_ext?: number;      // Weighted avg fx for exterior
    A_grnd?: number;      // Ground surfaces area
    fx_grnd?: number;     // Weighted avg fx for ground
    A_win?: number;       // Window area
    A_door?: number;      // Door area

    // 하위 호환성 (선택 사항)
    Qh?: number;
    Qc?: number;

    // Window Ventilation Details
    n_nutz?: number;
    n_win_min?: number;
    Delta_n_win?: number;
    Delta_n_win_mech?: number;
    n_SUP?: number;
    n_ETA?: number;

    // Minimum Outdoor Airflow
    min_outdoor_airflow?: number; // [m3/(h m2)]

    // Heat Storage Transfer Verification (Section 6.6)
    d_nutz?: number; // 운전일 (일/월)
    d_we?: number;   // 비운전일 (일/월)
    Q_storage_transfer?: number; // kWh (Storage transfer contribution)
    Delta_Q_C_b_we?: number;    // kWh (Discharged during non-op)
    Delta_Q_C_sink_nutz?: number; // kWh (Recharge required during op)

    // Detailed Gain/Loss Breakdown by usage/non-usage
    QT_op?: number;
    QV_op?: number;
    QS_op?: number;
    QI_op?: number;
    QT_non_op?: number;
    QV_non_op?: number;
    QS_non_op?: number;
    QI_non_op?: number;

    warnings?: string[]; // 검정 결과 경고 (예: 환기 부족 등)

    balanceDetails?: {
        Cm: number;
        cooling: number; // Cooling Setpoint
    };

    // 추가 검증 데이터
    H_tr?: number; // W/K
    H_ve?: number; // W/K (Ventilation Coeff)
    hours?: number; // Calculation hours (t)
    transmissionBySurface?: Record<string, {
        area: number;
        uValue: number; // Avg U-Value
        fx: number; // Temperature Adjustment Factor
        H_tr: number; // W/K (Base transmission)
        H_bridge: number; // W/K (Thermal Bridge)
        Q_trans: number; // kWh (Legacy: Heating)
        Q_trans_heat: number; // kWh (Heating Loss)
        Q_trans_cool: number; // kWh (Cooling Gain/Loss)
    }>;

    // Detailed Gain Breakdowns (for CSV Export)
    internalGains?: {
        Q_occ: number; // Occupancy (kWh)
        Q_app: number; // Equipment (kWh)
        Q_lit: number; // Lighting (kWh)
        Q_dhw: number; // DHW (kWh)
    };

    solarData?: Record<string, {
        area: number;
        orientation: string;
        tilt: number;
        I_sol_kwh: number; // Incident Insolation (kWh/m2)
        reductionFactor: number; // Combined reduction (shading * shgc * frame...)
        Q_sol_kwh: number; // Solar Gain (kWh)
    }>;
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
    // UI에서 CSV 헤더 생성을 위해 표면 메타데이터 포함
    surfaces: Surface[];
    hourly: HourlyResult[]; // 8760개 데이터
    monthly: MonthlyResult[]; // 12개 데이터
    yearly: YearlyResult;
}


export interface CalculationResults {
    zones: ZoneResult[];
    yearly: YearlyResult; // 프로젝트 단위 합계
    monthly: MonthlyResult[]; // 프로젝트 단위 합계
}
