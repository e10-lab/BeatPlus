import { Zone, Surface, Construction } from "@/types/project";
import { UsageProfile } from "@/lib/din-18599-profiles";

export interface ZoneInput extends Zone {
    projectId: string;
    surfaces: Surface[];
    linkedParentZoneId?: string; // 6.2.3 종속 공간 (상위 공간 ID)
    profileOverride?: Partial<UsageProfile>; // 프로필 수동 정정
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

export interface IterationLog {
    step: number;
    Q_h_b: number;
    Q_c_b: number;
    Q_I_sys_heating: number;
    Q_I_sys_cooling: number;
    convergence: number;
    details: {
        QT: number;
        QV: number;
        QS: number;
        QI: number;
        Q_h_b: number;
        Q_c_b: number;
        eta_h: number;
        eta_c: number;
        gamma_h: number;
        gamma_c: number;
        theta_int_h?: number;
        theta_int_c?: number;
    };
    theta_air?: number;
    theta_s?: number;
    theta_m?: number;
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
    // 시간별 데이터로부터 집계됨 (DIN 18599 탭 이름 준수)
    Q_h_b: number; // kWh (Heating Demand)
    Q_c_b: number; // kWh (Cooling Demand)
    Q_l_b: number; // kWh (Lighting Demand)
    Q_w_b: number; // kWh (DHW Demand)
    Q_aux: number; // kWh (Auxiliary Energy)

    // 태양광 발전량
    pvGeneration: number; // kWh
    selfConsumption?: number; // kWh

    avg_Ti: number; // 평균 실내 온도 (Heating Effective)
    avg_Ti_c?: number; // 평균 실내 온도 (Cooling Effective) for verification
    avg_Ti_op?: number; // 사용일 평균 실내 온도 (°C)
    avg_Ti_non_op?: number; // 비사용일 평균 실내 온도 (°C)

    // 상세 에너지 밸런스
    QT: number; // 관류 열손실 (kWh) - Legacy
    QV: number; // 환기 열손실 (kWh) - Legacy
    QT_heat: number; // 난방 기준 관류 열손실 (kWh)
    QT_cool: number; // 냉방 기준 관류 열취득/손실 (kWh)
    QV_heat: number; // 난방 기준 환기 열손실 (kWh)
    QV_cool: number; // 냉방 기준 환기 열취득/손실 (kWh)

    Qloss: number; // 총 열손실 (kWh)
    QS: number; // 일사 열취득 (kWh)
    QI: number; // 내부 발열 취득 (kWh)
    Qgain: number; // 총 열취득 (kWh)
    gamma: number; // 취득/손실 비
    eta: number; // 이용 효율

    // Debug / Verification Fields
    Theta_int_H?: number;
    Theta_i_h?: number;
    tau?: number;
    tau_h?: number;
    tau_c?: number;
    f_NA?: number;
    f_we?: number;
    Cm?: number;
    H_tot?: number;
    Theta_int_C?: number;
    t_h_op_d?: number;
    t_c_op_d?: number;
    t_NA?: number;
    f_adapt?: number;
    delta_theta_EMS?: number;
    Delta_theta_i_NA?: number;
    eta_C?: number;
    gamma_C?: number;
    a_H?: number;
    a_C?: number;

    // Ventilation Details
    V_net?: number;
    n_nutz?: number;
    n_win_min?: number;
    Delta_n_win?: number;
    Delta_n_win_mech?: number;
    Delta_n_win_mech_0?: number;
    n_inf?: number;
    n_win?: number;
    n_mech?: number;
    heatRecoveryEff?: number;
    isForcedMech?: number;

    n50?: number;
    f_wind?: number;
    f_ATD?: number;
    e_shield?: number;
    f_e?: number;
    roomHeight?: number;
    t_nutz?: number;
    t_v_mech?: number;
    f_inf_daily_mean?: number;
    n_SUP?: number;
    n_ETA?: number;
    A_NGF?: number;
    V_A_Geb?: number;
    A_E?: number;

    // A_E Breakdown
    A_ext?: number;
    fx_ext?: number;
    A_grnd?: number;
    fx_grnd?: number;
    A_win?: number;
    A_door?: number;

    // Minimum Outdoor Airflow
    min_outdoor_airflow?: number;

    // Heat Storage Transfer
    d_nutz?: number;
    d_we?: number;
    Q_storage_transfer?: number;
    Delta_Q_C_b_we?: number;
    Delta_Q_C_sink_nutz?: number;

    // Detailed Gain/Loss Breakdown
    QT_op?: number;
    QV_op?: number;
    QS_op?: number;
    QS_op_transparent?: number;
    QS_op_opaque?: number;
    QI_op?: number;
    QT_non_op?: number;
    QV_non_op?: number;
    QS_non_op?: number;
    QS_non_op_transparent?: number;
    QS_non_op_opaque?: number;
    QI_non_op?: number;

    warnings?: string[];
    balanceDetails?: {
        Cm: number;
        cooling: number;
    };

    H_tr?: number;
    H_ve?: number;
    hours?: number;
    transmissionBySurface?: Record<string, any>;
    solarData?: Record<string, any>;
    internalGains?: {
        Q_occ: number;
        Q_app: number;
        Q_lit: number;
        Q_dhw: number;
        metadata?: {
            p_j: number;
            t_usage: number;
            [key: string]: any;
        };
        op?: {
            Q_l_b: number;
            Q_I_l: number;
            [key: string]: any;
        };
        non_op?: {
            Q_l_b: number;
            Q_I_l: number;
            [key: string]: any;
        };
        Q_I_l?: number; // Total Lighting Heat Gain
        Q_I_p?: number; // Total Person Heat Gain
        Q_I_fac?: number; // Total Facility/Appliance Heat Gain
        Q_I_w?: number; // Total DHW Heat Gain
        Q_l_source_goods?: number; // Heat gain from stored goods
    };

    // [New] Verification Specific
    H_tr_total?: number;
    H_tr_D?: number;
    H_tr_g?: number;
    H_tr_u?: number;
    H_tr_A?: number;
    H_tr_WB?: number;
    H_ve_total?: number;
    H_ve_inf?: number;
    H_ve_win?: number;
    H_ve_mech?: number;
    H_ve_gross?: number;
    H_ve_tau_h?: number;
    H_ve_tau_c?: number;

    // [New] Systems & Load
    heatingLoadDetails?: {
        Te_min: number;
        H_tr: number;
        H_ve: number;
        Theta_int_H: number;
        A_NGF: number;
        P_h_max: number;
        p_h: number;
    };
    iterationLogs?: any[];
    systemLosses?: {
        heating: {
            generation: number;
            distribution: number;
            storage: number;
            details: any;
        };
        cooling: {
            distribution: number;
            storage: number;
            details: any;
        };
        dhw: {
            distribution: number;
            storage: number;
        };
    };

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
    };
    co2Emissions?: {
        heating: number;
        cooling: number;
        dhw: number;
        lighting: number;
        auxiliary: number;
        total: number;
    };

    energyDemandMetadata?: {
        heating: {
            tau: number;
            a: number;
            gamma: number;
            eta: number;
            Q_gain: number;
            Q_loss: number;
        };
        cooling: {
            tau: number;
            a: number;
            gamma: number;
            eta: number;
            Q_gain: number;
            Q_loss: number;
        };
    };

    // DIN 18599-5 Emission
    theta_HK_av?: number;
    theta_VL?: number;
    theta_RL?: number;
    t_h_rL?: number;
    beta_h_ce?: number;
    Q_h_ce?: number;
    delta_theta_ce?: number;
    delta_theta_str?: number;
    delta_theta_ctr?: number;
    delta_theta_emb?: number;
    delta_theta_rad?: number;
    delta_theta_im?: number;
    delta_theta_hydr?: number;
    delta_theta_roomaut?: number;
    f_hydr?: number;
    emissionLabels?: any;
    emissionHallDetails?: any;

    // Extra Verification
    C_wirk?: number;
    H_tr_sys?: number;
    H_ve_sys?: number;
    H_ve_mech_0?: number;
    Theta_e?: number;
    Theta_i_h_soll?: number;
    Theta_i_c_soll?: number;
    Q_source?: number;
    Q_sink?: number;
    eta_h?: number;
    eta_c?: number;

    tau_op?: number;
    tau_non_op?: number;
    alpha_op?: number;
    alpha_non_op?: number;
    eta_h_op?: number;
    eta_h_non_op?: number;
    Q_source_op?: number;
    Q_source_non_op?: number;
    Q_sink_op?: number;
    Q_sink_non_op?: number;
    Q_h_b_op?: number;
    Q_h_b_non_op?: number;
    Theta_i_h_op?: number;
    Theta_i_h_non_op?: number;
    Q_c_b_op?: number;
    Q_c_b_non_op?: number;

    lighting_usage_hours?: number;
    dhw_usage_days?: number;
    storageTransferDetails?: any;
}

export interface SystemLossBreakdown {
    total: { hours: number; dT: number; Q_loss: number };
    op: { hours: number; dT: number; Q_loss: number };
    non_op: { hours: number; dT: number; Q_loss: number };
    L?: number; // 배관 길이 (m)
    V_s?: number; // 저장 탱크 용량 (m3)
    U?: number; // 열관류율 (W/m2K)
    k_s?: number; // 보정 계수
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

    monthly: MonthlyResult[];

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
