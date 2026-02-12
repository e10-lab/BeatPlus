
export interface UsageProfile {
    id: string; // DIN 18599-10 프로필 ID 또는 식별 키
    name: string; // 한국어 명칭 (원본 DIN 번호 포함)
    version?: "2011" | "2018" | "2025"; // DIN/TS 18599 버전 구분

    // 1. 사용 및 운영 시간
    dailyUsageHours: number; // h (일일 사용 시간)
    annualUsageDays: number; // days (연간 사용 일수)
    usageHoursDay: number; // h (주간 운영 07:00-18:00)
    usageHoursNight: number; // h (야간 운영 18:00-07:00)
    usageHoursStart: number; // Hour (0-24) - 표시용 시작 시간
    usageHoursEnd: number; // Hour (0-24) - 표시용 종료 시간
    hvacDailyOperationHours: number; // h (공조 설비 일일 가동 시간)
    hvacAnnualOperationDays: number; // days (공조 설비 연간 가동 일수)

    // 2. 조명
    illuminance: number; // lux (유지 조도 Em)
    workplaneHeight: number; // m (작업면 높이)
    illuminanceDepreciationFactor: number; // k_L (유지율/감광 보상률)
    lightingAbsenceFactor: number; // F_A (조명 부재율/재실 감지 효과)
    partialOperationFactorLighting: number; // F_Te (조명 부분 가동률)

    // 3. 실내 온도
    heatingSetpoint: number; // °C (난방 설정 온도)
    coolingSetpoint: number; // °C (냉방 설정 온도)
    heatingSetbackTemp: number; // °C (난방 제어/저감 온도)
    heatingDesignMinTemp: number; // °C (난방 설계 최저 온도)
    coolingDesignMaxTemp: number; // °C (냉방 설계 최고 온도)

    // 4. 실내 환경
    minOutdoorAir: number; // m³/(h·m²) (외기 도입량)
    humidityRequirement: string; // 예: "None", "40-60%"

    // 5. 공조 시스템 계수
    hvacAbsenceFactor: number; // F_A,RLT (공조 부재율)
    hvacPartialOperationFactor: number; // F_Te,RLT (공조 부분 가동률)

    // 6. 내부 발열
    metabolicHeat: number; // Wh/(m²·d) (인체 발열)
    equipmentHeat: number; // Wh/(m²·d) (기기 발열)
    dhwDemand: number; // Wh/(m²·d) (급탕 부하) - DIN 18599-10 Table 4 & 5

    // 7. 기타 계수 (Table 8 etc)
    reductionFactorPollution?: number; // F_V (오염으로 인한 감소 계수)
    pollutionFactor?: number; // k_2 (오염 계수)

    // 8. 건물 자동화 (Building Automation) - Table 9 (Non-Res) / Table 5 (Res)
    deltaThetaEMS?: { d: number; c: number; b: number; a: number }; // Δθ_EMS [K]
    fAdapt?: { d: number; c: number; b: number; a: number }; // f_adapt
}

export const DIN_18599_PROFILES: Record<string, UsageProfile> = {
    // 1. Office (Single/Group)
    "1_office": {
        id: "1_office", name: "01 사무실 (개인/그룹)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.84, lightingAbsenceFactor: 0.3,
        partialOperationFactorLighting: 0.7,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 4.0,
        hvacAbsenceFactor: 0.3, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 30.0, equipmentHeat: 39.0, dhwDemand: 10.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.0, a: -1.5 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 2. Office (Open Plan) - was 2_open_plan (from DIN ~3 but normalized to 2 here? User wants 1-43)
    // Actually standard 2 is Group Office, 3 is Open Plan.
    // Let's assume the user's "1-43" implies strictly following the DIN list. 
    // DIN 18599-10 Table 4:
    // 1: Single office
    // 2: Group office (often merged with 1 in simplified tools, but let's see current data)
    // Current data had "2_open_plan" as "02".
    // 2. Group Office (Gruppenbüro) - Table A.2
    "2_group_office": {
        id: "2_group_office", name: "02 사무실 (그룹)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.84, lightingAbsenceFactor: 0.3,
        partialOperationFactorLighting: 0.7,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 4.0,
        hvacAbsenceFactor: 0.3, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 30.0, equipmentHeat: 70.0, dhwDemand: 10.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.0, a: -1.5 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 3. Open Plan Office (Großraumbüro) - Table A.3
    "3_open_plan": {
        id: "3_open_plan", name: "03 사무실 (대형/개방형)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.93, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 6.0,
        hvacAbsenceFactor: 0.2, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 45.0, equipmentHeat: 70.0, dhwDemand: 10.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.0, a: -1.5 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 4. Meeting (Besprechung) - Table A.4
    "4_meeting": {
        id: "4_meeting", name: "04 회의실",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.93, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 15.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.5,
        metabolicHeat: 95.0, equipmentHeat: 0.0, dhwDemand: 5.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.2, a: -2.0 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 5. Counter Hall (Schalterhalle) - Table A.5
    "5_counter_hall": {
        id: "5_counter_hall", name: "05 민원실/창구 (Schalterhalle)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 200.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.87, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 2.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 15.0, equipmentHeat: 25.0, dhwDemand: 700.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.0, a: -1.5 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 29. Library (moved from 4 to make room)
    "29_library": {
        id: "29_library", name: "29 도서관/열람실",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 20,
        dailyUsageHours: 12.0, annualUsageDays: 300.0,
        usageHoursDay: 3009.0, usageHoursNight: 591.0,
        hvacDailyOperationHours: 14.0, hvacAnnualOperationDays: 300.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.88, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 8.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 104.5, equipmentHeat: 0.0, dhwDemand: 5.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 6. Retail/Department Store (Einzelhandel/Kaufhaus) - Table A.6
    "6_retail_department": {
        id: "6_retail_department", name: "06 백화점/대형점포",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 20,
        dailyUsageHours: 12.0, annualUsageDays: 300.0,
        usageHoursDay: 3009.0, usageHoursNight: 591.0,
        hvacDailyOperationHours: 14.0, hvacAnnualOperationDays: 300.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.93, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 4.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 80.0, equipmentHeat: 250.0, dhwDemand: 750.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.5, a: -2.0 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 7. Retail w/ Cooling (Lebensmittel m. Kühlprodukten) - Table A.7
    "7_retail_cooling": {
        id: "7_retail_cooling", name: "07 식품매장 (냉장포함)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 20,
        dailyUsageHours: 12.0, annualUsageDays: 300.0,
        usageHoursDay: 3009.0, usageHoursNight: 591.0,
        hvacDailyOperationHours: 14.0, hvacAnnualOperationDays: 300.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.93, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 3.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.5,
        metabolicHeat: 80.0, equipmentHeat: 40.0, dhwDemand: 250.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.5, a: -2.0 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 8. Classroom (Klassenzimmer) - Table A.8
    "8_classroom": {
        id: "8_classroom", name: "08 교실 (학교/유치원)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 15,
        dailyUsageHours: 7.0, annualUsageDays: 200.0,
        usageHoursDay: 1400.0, usageHoursNight: 0.0,
        hvacDailyOperationHours: 9.0, hvacAnnualOperationDays: 200.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.97, lightingAbsenceFactor: 0.25,
        partialOperationFactorLighting: 0.9,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 10.0,
        hvacAbsenceFactor: 0.25, hvacPartialOperationFactor: 0.9,
        metabolicHeat: 100.0, equipmentHeat: 27.5, dhwDemand: 15.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.0, a: -1.5 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 9. Lecture Hall (Hörsaal/Auditorium) - Table A.9
    "9_lecture_hall": {
        id: "9_lecture_hall", name: "09 강의실/강당 (Hörsaal)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 18,
        dailyUsageHours: 10.0, annualUsageDays: 150.0,
        usageHoursDay: 1408.0, usageHoursNight: 92.0,
        hvacDailyOperationHours: 12.0, hvacAnnualOperationDays: 150.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.92, lightingAbsenceFactor: 0.25,
        partialOperationFactorLighting: 0.7,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 30.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.6,
        metabolicHeat: 420.0, equipmentHeat: 1.0, dhwDemand: 5.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.2, a: -2.0 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 10. Bed Room (Bettenzimmer) - Table A.10
    "10_bed_room": {
        id: "10_bed_room", name: "10 병실 (병원/요양)",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 0.5,
        heatingSetpoint: 22.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 0.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 5.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.8,
        metabolicHeat: 120.0, equipmentHeat: 24.0, dhwDemand: 120.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 11. Hotel Room (Hotelzimmer) - Table A.11
    "11_hotel_room": {
        id: "11_hotel_room", name: "11 호텔 객실",
        version: "2025",
        usageHoursStart: 21, usageHoursEnd: 8,
        dailyUsageHours: 11.0, annualUsageDays: 365.0,
        usageHoursDay: 743.0, usageHoursNight: 3272.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.25,
        partialOperationFactorLighting: 0.3,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 3.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.5,
        metabolicHeat: 70.0, equipmentHeat: 44.0, dhwDemand: 120.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 12. Canteen (Kantine) - Table A.12
    "12_canteen": {
        id: "12_canteen", name: "12 구내식당",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 15,
        dailyUsageHours: 7.0, annualUsageDays: 250.0,
        usageHoursDay: 1750.0, usageHoursNight: 0.0,
        hvacDailyOperationHours: 9.0, hvacAnnualOperationDays: 250.0,
        illuminance: 200.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.97, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 18.0,
        hvacAbsenceFactor: 0.7, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 175.0, equipmentHeat: 10.0, dhwDemand: 5.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },
    // 13. Restaurant (Restaurant) - Table A.13
    "13_restaurant": {
        id: "13_restaurant", name: "13 레스토랑",
        version: "2025",
        usageHoursStart: 10, usageHoursEnd: 24,
        dailyUsageHours: 14.0, annualUsageDays: 300.0,
        usageHoursDay: 2411.0, usageHoursNight: 1789.0,
        hvacDailyOperationHours: 16.0, hvacAnnualOperationDays: 300.0,
        illuminance: 200.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 18.0,
        hvacAbsenceFactor: 0.6, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 233.0, equipmentHeat: 14.0, dhwDemand: 100.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },
    // 14. Kitchen (Küche) - Table A.14 (Replaced 13_kitchen)
    "14_kitchen": {
        id: "14_kitchen", name: "14 주방 (비주거)",
        version: "2025",
        usageHoursStart: 10, usageHoursEnd: 23,
        dailyUsageHours: 13.0, annualUsageDays: 300.0,
        usageHoursDay: 2411.0, usageHoursNight: 1489.0,
        hvacDailyOperationHours: 15.0, hvacAnnualOperationDays: 300.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.96, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 90.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 56.0, equipmentHeat: 1800.0, dhwDemand: 500.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.5, a: -2.0 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 15. Kitchen Prep/Storage (Küche - Vorbereitung/Lager) - Table A.15
    "15_kitchen_prep": {
        id: "15_kitchen_prep", name: "15 주방 (준비/저장)",
        version: "2025",
        usageHoursStart: 10, usageHoursEnd: 23,
        dailyUsageHours: 13.0, annualUsageDays: 300.0,
        usageHoursDay: 2411.0, usageHoursNight: 1489.0,
        hvacDailyOperationHours: 15.0, hvacAnnualOperationDays: 300.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 15.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 56.0, equipmentHeat: 304.0, dhwDemand: 50.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },
    // 16. WC/Sanitary (WC und Sanitärräume) - Table A.16
    "16_wc_sanitary": {
        id: "16_wc_sanitary", name: "16 화장실/위생공간",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2750.0, usageHoursNight: 0.0,
        hvacDailyOperationHours: 11.0, hvacAnnualOperationDays: 250.0,
        illuminance: 200.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.9,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "Keine",
        minOutdoorAir: 15.0,
        hvacAbsenceFactor: 0.7, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 20.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.5, a: -2.0 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 17. Other Common Rooms (Sonstige Aufenthaltsräume) - Table A.17
    "17_other_common": {
        id: "17_other_common", name: "17 기타 휴게/대기 (Pausenraum)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.93, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 7.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.8,
        metabolicHeat: 93.2, equipmentHeat: 3.2, dhwDemand: 5.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 17.1 Workshop Medium
    "17_1_workshop_medium": {
        id: "17_1_workshop_medium", name: "17.1 작업장 (중간 강도)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 16,
        dailyUsageHours: 9.0, annualUsageDays: 230.0,
        usageHoursDay: 2018.0, usageHoursNight: 52.0,
        hvacDailyOperationHours: 10.0, hvacAnnualOperationDays: 230.0,
        illuminance: 400.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.85, lightingAbsenceFactor: 0.1,
        partialOperationFactorLighting: 0.9,
        heatingSetpoint: 17.0, coolingSetpoint: 26.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 15.0, coolingDesignMaxTemp: 28.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 2.5,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 45.0, equipmentHeat: 300.0, dhwDemand: 10.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },
    // 18. Ancillary No Common (Nebenflächen ohne Aufenthaltsräume) - Table A.18
    "18_ancillary_no_common": {
        id: "18_ancillary_no_common", name: "18 부속 공간 (비상주)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2750.0, usageHoursNight: 0.0,
        hvacDailyOperationHours: 11.0, hvacAnnualOperationDays: 250.0,
        illuminance: 100.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.9,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.2, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 19. Traffic Area (Verkehrsfläche) - Table A.19
    "19_traffic_area": {
        id: "19_traffic_area", name: "19 복도/이동 공간",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2750.0, usageHoursNight: 0.0,
        hvacDailyOperationHours: 11.0, hvacAnnualOperationDays: 250.0,
        illuminance: 100.0, workplaneHeight: 0.2,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.8,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },

    // 20. Storage/Technical (Lager, Technik, Archiv) - Table A.20
    "20_storage_technical": {
        id: "20_storage_technical", name: "20 창고/기계실 (저장/설비)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2750.0, usageHoursNight: 0.0,
        hvacDailyOperationHours: 11.0, hvacAnnualOperationDays: 250.0,
        illuminance: 100.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.98,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 0.15,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },

    // 21. Data Center (Rechenzentrum) - Table A.21
    "21_data_center": {
        id: "21_data_center", name: "21 데이터 센터 (전산실)",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.96, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 1.3,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 2.8, equipmentHeat: 150.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -0.5 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 22. Industrial Heavy (Gewerbliche/Ind. Hallen - schwere Arbeit) - Table A.22
    "22_industrial_heavy": {
        id: "22_industrial_heavy", name: "22 공장/홀 (중작업)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 16,
        dailyUsageHours: 9.0, annualUsageDays: 230.0,
        usageHoursDay: 2018.0, usageHoursNight: 52.0,
        hvacDailyOperationHours: 10.0, hvacAnnualOperationDays: 230.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.85, lightingAbsenceFactor: 0.1,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 15.0, coolingSetpoint: 28.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 15.0, coolingDesignMaxTemp: 30.0,
        humidityRequirement: "keine",
        minOutdoorAir: 3.5,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 6.0, equipmentHeat: 35.0, dhwDemand: 10.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.2, a: -1.8 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 23. Industrial Medium (Gewerbliche/Ind. Hallen - mittelschwere Arbeit) - Table A.23
    "23_industrial_medium": {
        id: "23_industrial_medium", name: "23 공장/홀 (중간 작업)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 16,
        dailyUsageHours: 9.0, annualUsageDays: 230.0,
        usageHoursDay: 2018.0, usageHoursNight: 52.0,
        hvacDailyOperationHours: 10.0, hvacAnnualOperationDays: 230.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.85, lightingAbsenceFactor: 0.1,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 17.0, coolingSetpoint: 26.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 15.0, coolingDesignMaxTemp: 28.0,
        humidityRequirement: "keine",
        minOutdoorAir: 2.5,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 5.0, equipmentHeat: 35.0, dhwDemand: 10.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.2, a: -1.8 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 24. Industrial Light (Gewerbliche/Ind. Hallen - leichte Arbeit) - Table A.24
    "24_industrial_light": {
        id: "24_industrial_light", name: "24 공장/홀 (경작업/좌식)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 16,
        dailyUsageHours: 9.0, annualUsageDays: 230.0,
        usageHoursDay: 2018.0, usageHoursNight: 52.0,
        hvacDailyOperationHours: 10.0, hvacAnnualOperationDays: 230.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.85, lightingAbsenceFactor: 0.1,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 20.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 18.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 1.5,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 4.0, equipmentHeat: 35.0, dhwDemand: 10.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.2, a: -1.8 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 25. Audience Area (Zuschauerbereich) - Table A.25
    "25_audience_area": {
        id: "25_audience_area", name: "25 관람석 (극장/공연장)",
        version: "2025",
        usageHoursStart: 19, usageHoursEnd: 23,
        dailyUsageHours: 4.0, annualUsageDays: 250.0,
        usageHoursDay: 59.0, usageHoursNight: 941.0,
        hvacDailyOperationHours: 6.0, hvacAnnualOperationDays: 250.0,
        illuminance: 200.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.97, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 40.0,
        hvacAbsenceFactor: 0.7, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 93.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 26. Theater Foyer (Theater - Foyer) - Table A.26
    "26_theater_foyer": {
        id: "26_theater_foyer", name: "26 극장 로비 (포이어)",
        version: "2025",
        usageHoursStart: 19, usageHoursEnd: 23,
        dailyUsageHours: 4.0, annualUsageDays: 250.0,
        usageHoursDay: 59.0, usageHoursNight: 941.0,
        hvacDailyOperationHours: 6.0, hvacAnnualOperationDays: 250.0,
        illuminance: 300.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 25.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 87.5, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.3, a: -0.5 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 27. Stage (Bühne - Theater/Veranstaltung) - Table A.27
    "27_stage": {
        id: "27_stage", name: "27 무대 (극장/공연장)",
        version: "2025",
        usageHoursStart: 13, usageHoursEnd: 23,
        dailyUsageHours: 10.0, annualUsageDays: 250.0,
        usageHoursDay: 1259.0, usageHoursNight: 1241.0,
        hvacDailyOperationHours: 12.0, hvacAnnualOperationDays: 250.0,
        illuminance: 750.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 0.9, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 0.3,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },

    // 28. Trade Fair/Congress (Messe/Kongress) - Table A.28
    "28_trade_fair_congress": {
        id: "28_trade_fair_congress", name: "28 전시회장/메세 (박람회)",
        version: "2025",
        usageHoursStart: 9, usageHoursEnd: 18,
        dailyUsageHours: 9.0, annualUsageDays: 150.0,
        usageHoursDay: 1258.0, usageHoursNight: 92.0,
        hvacDailyOperationHours: 11.0, hvacAnnualOperationDays: 150.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.93, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 7.0,
        hvacAbsenceFactor: 0.7, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 23.3, equipmentHeat: 2.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 2.0, c: 0.0, b: -1.5, a: -2.0 }, fAdapt: { d: 0.5, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 29. Exhibition/Museum (Ausstellungsräume und Museum) - Table A.29
    "29_exhibition_museum": {
        id: "29_exhibition_museum", name: "29 전시실/박물관 (보존 요구)",
        version: "2025",
        usageHoursStart: 10, usageHoursEnd: 18,
        dailyUsageHours: 8.0, annualUsageDays: 250.0,
        usageHoursDay: 1846.0, usageHoursNight: 154.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.88, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "o.T.",
        minOutdoorAir: 2.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 7.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },
    // 49. Library (placeholder if needed, currently empty as 29 was missing)
    // "49_library": { ... },

    // 30. Library - Reading Room (Bibliothek - Lesesaal) - Table A.30
    "30_library_reading": {
        id: "30_library_reading", name: "30 도서관 (열람실)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 20,
        dailyUsageHours: 12.0, annualUsageDays: 300.0,
        usageHoursDay: 3009.0, usageHoursNight: 591.0,
        hvacDailyOperationHours: 14.0, hvacAnnualOperationDays: 300.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.88, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 8.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 28.0, equipmentHeat: 6.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },
    // 31. Library - Open Access (Bibliothek - Freihandbereich) - Table A.31
    "31_library_open_access": {
        id: "31_library_open_access", name: "31 도서관 (개가식 서고)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 20,
        dailyUsageHours: 12.0, annualUsageDays: 300.0,
        usageHoursDay: 3009.0, usageHoursNight: 591.0,
        hvacDailyOperationHours: 14.0, hvacAnnualOperationDays: 300.0,
        illuminance: 200.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 2.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 7.0, equipmentHeat: 6.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },
    // 32. Library - Stack/Depot (Bibliothek - Magazin und Depot) - Table A.32
    "32_library_stack": {
        id: "32_library_stack", name: "32 도서관 (보존 서고/수장고)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 20,
        dailyUsageHours: 12.0, annualUsageDays: 300.0,
        usageHoursDay: 3009.0, usageHoursNight: 591.0,
        hvacDailyOperationHours: 14.0, hvacAnnualOperationDays: 300.0,
        illuminance: 100.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.9,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 2.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9
    },

    // 33. Sports Hall (Turnhalle - ohne Zuschauer) - Table A.33
    "33_sports_hall": {
        id: "33_sports_hall", name: "33 체육관 (관람석 없음)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 23,
        dailyUsageHours: 15.0, annualUsageDays: 250.0,
        usageHoursDay: 2509.0, usageHoursNight: 1241.0,
        hvacDailyOperationHours: 17.0, hvacAnnualOperationDays: 250.0,
        illuminance: 300.0, workplaneHeight: 1.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.3,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 19.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 3.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.9,
        metabolicHeat: 20.0, equipmentHeat: 6.3, dhwDemand: 125.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 34. Parking - Private/Office (Parkhaus - Büro/Privat) - Table A.34
    "34_parking_private": {
        id: "34_parking_private", name: "34 주차장 (사무/개인)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 75.0, workplaneHeight: 0.2,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.95,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 8.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 35. Parking - Public (Parkhaus - Öffentlich) - Table A.35
    "35_parking_public": {
        id: "35_parking_public", name: "35 주차장 (공공)",
        version: "2025",
        usageHoursStart: 9, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 3298.0, usageHoursNight: 2177.0,
        hvacDailyOperationHours: 17.0, hvacAnnualOperationDays: 365.0,
        illuminance: 75.0, workplaneHeight: 0.2,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.8,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 8.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 36. Sauna Area (Saunabereich) - Table A.36
    "36_sauna_area": {
        id: "36_sauna_area", name: "36 사우나 구역",
        version: "2025",
        usageHoursStart: 10, usageHoursEnd: 22,
        dailyUsageHours: 12.0, annualUsageDays: 365.0,
        usageHoursDay: 2933.0, usageHoursNight: 1447.0,
        hvacDailyOperationHours: 14.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 24.0, coolingSetpoint: 24.0, // Cooling not typically required but valid for calculation
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 23.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 15.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 5.8, equipmentHeat: 50.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },
    // Table A.36: Metabolic: 12m2/person -> 70W/person? No, check table again.
    // Table: max Belegungsdichte 18/12/6 m2/Person.
    // Interne Wärmequellen: Personen 70W -> 3.9 / 5.8 / 11.7.
    // Arbeitshilfen (Equipment): 40 / 50 / 60 W/m2.
    // Let's use Medium (mittel) as default usually? Table 36: mittel -> 5.8 (Person), 50 (Equip).
    // Total Heat day (Wh/m2d): 558.
    // My previous file used specific values. I will stick to "Medium" column values unless standard suggests otherwise.
    // Metabolic: 5.8 W/m2. Equipment: 50 W/m2.


    // 37. Fitness Room (Fitnessraum) - Table A.37
    "37_fitness_room": {
        id: "37_fitness_room", name: "37 피트니스 룸",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 23,
        dailyUsageHours: 15.0, annualUsageDays: 365.0,
        usageHoursDay: 3663.0, usageHoursNight: 1812.0,
        hvacDailyOperationHours: 17.0, hvacAnnualOperationDays: 365.0,
        illuminance: 300.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 20.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 18.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 12.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.9,
        metabolicHeat: 22.0, equipmentHeat: 2.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
        // Table A.37: Mittel: Person 22 W/m2, Equipment 2 W/m2.
    },


    // 38. Laboratory (Labor) - Table A.38
    "38_laboratory": {
        id: "38_laboratory", name: "38 실험실 (일반)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 1.0,
        illuminanceDepreciationFactor: 0.92, lightingAbsenceFactor: 0.3,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 22.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 25.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 6.4, equipmentHeat: 18.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
        // Table A.38: Mittel: Person 6.4 W/m2, Equipment 18 W/m2.
    },

    // 39. Examination/Treatment (Untersuchungs- und Behandlungsräume) - Table A.39
    "39_exam_treatment": {
        id: "39_exam_treatment", name: "39 검사/치료실",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 22.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 0.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 10.0,
        hvacAbsenceFactor: 0.3, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 11.7, equipmentHeat: 7.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 40. Special Care (Spezialpflegebereiche: ICU etc) - Table A.40
    "40_special_care": {
        id: "40_special_care", name: "40 특수 간호/중환자실",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 24.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 0.0,
        heatingDesignMinTemp: 22.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 30.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 4.7, equipmentHeat: 9.5, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 41. Corridors - General Care (Flure des allg. Pflegebereichs) - Table A.41
    "41_corridor_care": {
        id: "41_corridor_care", name: "41 복도 (일반 간호 구역)",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 125.0, workplaneHeight: 0.2,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.8,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 22.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 0.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "keine",
        minOutdoorAir: 10.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 42. Medical Practice/Therapy (Arztpraxen und Therapeutische Praxen) - Table A.42
    "42_medical_practice": {
        id: "42_medical_practice", name: "42 병원/진료소",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 18,
        dailyUsageHours: 10.0, annualUsageDays: 250.0,
        usageHoursDay: 2346.0, usageHoursNight: 154.0,
        hvacDailyOperationHours: 12.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.3,
        partialOperationFactorLighting: 0.7,
        heatingSetpoint: 22.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 10.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 5.8, equipmentHeat: 5.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
    },

    // 43. Warehouses/Logistics (Lagerhallen, Logistikhallen) - Table A.43
    "43_storage": {
        id: "43_storage", name: "43 창고/물류 (Lagerhallen)",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.6,
        partialOperationFactorLighting: 0.4,
        heatingSetpoint: 12.0, coolingSetpoint: 26.0,
        heatingSetbackTemp: 0.0,
        heatingDesignMinTemp: 12.0, coolingDesignMaxTemp: 28.0,
        humidityRequirement: "keine",
        minOutdoorAir: 1.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0, reductionFactorPollution: 0.9, pollutionFactor: 0.9,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
        // Table A.43: Internal heat negligible/ "-"
    },

    // 44. Residential Single (Single Family) - Table 5 (Wohngebäude)
    "44_res_single": {
        id: "44_res_single", name: "44 주거 (단독 주택 / EFH)",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 17.0, hvacAnnualOperationDays: 365.0, // Heating 06:00-23:00
        illuminance: 200.0, workplaneHeight: 0.0, // Not defined in Table 5, assumed specific or 0.
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 20.0, coolingSetpoint: 25.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "-",
        minOutdoorAir: 1.25, // 0.5 h^-1 * 2.5m = 1.25 m3/m2h
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 1.9, equipmentHeat: 0.0, dhwDemand: 45.0, reductionFactorPollution: 0.95,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
        // Table 5: q_I = 45 Wh/(m2d). 45/24 = 1.875 W/m2. F_V = 0.95.
        // DHW: ~16.5 kWh/m2a ~ 45 Wh/m2d.
    },

    // 45. Residential Multi (Apartment) - Table 5 (Wohngebäude)
    "45_res_multi": {
        id: "45_res_multi", name: "45 주거 (공동 주택 / MFH)",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 17.0, hvacAnnualOperationDays: 365.0, // Heating 06:00-23:00
        illuminance: 200.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 20.0, coolingSetpoint: 25.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "-",
        minOutdoorAir: 1.25, // 0.5 h^-1 * 2.5m = 1.25 m3/m2h
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 3.8, equipmentHeat: 0.0, dhwDemand: 45.0, reductionFactorPollution: 0.95,
        deltaThetaEMS: { d: 0.0, c: 0.0, b: -0.5, a: -1.0 }, fAdapt: { d: 1.0, c: 1.0, b: 1.35, a: 1.35 }
        // Table 5: q_I = 90 Wh/(m2d). 90/24 = 3.75 W/m2. F_V = 0.95.
        // DHW: Assumed same ~45 Wh/m2d default.
    },
};

export const PROFILE_OPTIONS = Object.values(DIN_18599_PROFILES).sort((a, b) => {
    // Sort by Number in name
    const numA = parseFloat(a.name.split(' ')[0]);
    const numB = parseFloat(b.name.split(' ')[0]);

    if (isNaN(numA) && isNaN(numB)) return a.name.localeCompare(b.name);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;

    return numA - numB;
});
