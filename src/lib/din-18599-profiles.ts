

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
    minOutdoorAirFlow: number; // m³/(h·m²) (최소 외기 도입량 - 위와 중복될 수 있으나 구분됨)

    // 5. 공조 시스템 계수
    hvacAbsenceFactor: number; // F_A,RLT (공조 부재율)
    hvacPartialOperationFactor: number; // F_Te,RLT (공조 부분 가동률)

    // 6. 내부 발열
    metabolicHeat: number; // Wh/(m²·d) (인체 발열)
    equipmentHeat: number; // Wh/(m²·d) (기기 발열)
    dhwDemand: number; // Wh/(m²·d) (급탕 부하) - DIN 18599-10 Table 4 & 5
}

export const DIN_18599_PROFILES: Record<string, UsageProfile> = {
    // 1. Office
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
        minOutdoorAir: 4.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.3, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 32.0, equipmentHeat: 45.0, dhwDemand: 10.0
    },
    // 2. Open Plan Office (was 3)
    "2_open_plan": {
        id: "2_open_plan", name: "02 사무실 (대형/개방형)",
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
        minOutdoorAir: 6.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.2, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 45.0, equipmentHeat: 65.0, dhwDemand: 10.0
    },
    // 3. Meeting (was 4)
    "3_meeting": {
        id: "3_meeting", name: "03 회의실",
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
        minOutdoorAir: 15.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.5,
        metabolicHeat: 100.0, equipmentHeat: 10.0, dhwDemand: 5.0
    },
    // 4. Library (was 29)
    "4_library": {
        id: "4_library", name: "04 도서관/열람실",
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
        minOutdoorAir: 8.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 175.0, equipmentHeat: 10.0, dhwDemand: 5.0
    },
    // 5. Retail (was 6)
    "5_retail": {
        id: "5_retail", name: "05 소매점/백화점",
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
        minOutdoorAir: 4.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 88.0, equipmentHeat: 25.0, dhwDemand: 5.0
    },
    // 6. Retail Large (was 7)
    "6_retail_large": {
        id: "6_retail_large", name: "06 대형 점포/쇼핑센터",
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
        minOutdoorAir: 4.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 88.0, equipmentHeat: 25.0, dhwDemand: 5.0
    },
    // 7. Classroom (was 8)
    "7_classroom": {
        id: "7_classroom", name: "07 교실 (학교)",
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
        minOutdoorAir: 10.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.25, hvacPartialOperationFactor: 0.9,
        metabolicHeat: 105.0, equipmentHeat: 22.0, dhwDemand: 15.0
    },
    // 8. Lecture Hall (was 9)
    "8_lecture_hall": {
        id: "8_lecture_hall", name: "08 강의실 (강당)",
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
        minOutdoorAir: 30.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.6,
        metabolicHeat: 440.0, equipmentHeat: 25.0, dhwDemand: 5.0
    },
    // 9. Bed Room (was 10)
    "9_bed_room": {
        id: "9_bed_room", name: "09 병실 (병원)",
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
        minOutdoorAir: 5.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.8,
        metabolicHeat: 112.0, equipmentHeat: 25.0, dhwDemand: 120.0
    },
    // 10. Hotel Room (was 11)
    "10_hotel_room": {
        id: "10_hotel_room", name: "10 호텔 객실",
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
        minOutdoorAir: 3.0, minOutdoorAirFlow: 2.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.5,
        metabolicHeat: 75.0, equipmentHeat: 45.0, dhwDemand: 120.0
    },
    // 11. Canteen (was 12)
    "11_canteen": {
        id: "11_canteen", name: "11 구내식당",
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
        minOutdoorAir: 18.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.7, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 185.0, equipmentHeat: 12.0, dhwDemand: 80.0
    },
    // 12. Restaurant (was 13)
    "12_restaurant": {
        id: "12_restaurant", name: "12 레스토랑",
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
        minOutdoorAir: 18.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.6, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 250.0, equipmentHeat: 15.0, dhwDemand: 100.0
    },
    // 13. Kitchen (was 14)
    "13_kitchen": {
        id: "13_kitchen", name: "13 주방 (준비/조리)",
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
        minOutdoorAir: 90.0, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 60.0, equipmentHeat: 1900.0, dhwDemand: 500.0
    },
    // 14. Heated Storage / Archive
    "14_storage_heated": {
        id: "14_storage_heated", name: "14 창고/아카이브 (난방)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 100.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.9,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 0.15, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0
    },
    // 15. Unheated Storage (was 20)
    "15_storage_unheated": {
        id: "15_storage_unheated", name: "15 창고/물류 (비난방)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 100.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.98,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 0.15, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0
    },
    // 16. Parking (was 33)
    "16_parking": {
        id: "16_parking", name: "16 주차장 (지하/건물)",
        version: "2025",
        usageHoursStart: 9, usageHoursEnd: 24,
        dailyUsageHours: 15.0, annualUsageDays: 365.0,
        usageHoursDay: 3298.0, usageHoursNight: 2177.0,
        hvacDailyOperationHours: 17.0, hvacAnnualOperationDays: 365.0,
        illuminance: 75.0, workplaneHeight: 0.2,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.8,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "-",
        minOutdoorAir: 16.0, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0
    },
    // 17. Workshop Light (was 22.3)
    "17_workshop_light": {
        id: "17_workshop_light", name: "17 작업장 (경작업/조립)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 16,
        dailyUsageHours: 9.0, annualUsageDays: 230.0,
        usageHoursDay: 2018.0, usageHoursNight: 52.0,
        hvacDailyOperationHours: 10.0, hvacAnnualOperationDays: 230.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.85, lightingAbsenceFactor: 0.1,
        partialOperationFactorLighting: 0.9,
        heatingSetpoint: 20.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 18.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 1.5, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 35.0, equipmentHeat: 300.0, dhwDemand: 10.0
    },
    // 17.1 Workshop Medium (Bonus, was 22.2)
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
        minOutdoorAir: 2.5, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 45.0, equipmentHeat: 300.0, dhwDemand: 10.0
    },
    // 18. Workshop Heavy (was 22.1)
    "18_workshop_heavy": {
        id: "18_workshop_heavy", name: "18 작업장 (중작업)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 16,
        dailyUsageHours: 9.0, annualUsageDays: 230.0,
        usageHoursDay: 2018.0, usageHoursNight: 52.0,
        hvacDailyOperationHours: 10.0, hvacAnnualOperationDays: 230.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.85, lightingAbsenceFactor: 0.1,
        partialOperationFactorLighting: 0.9,
        heatingSetpoint: 15.0, coolingSetpoint: 28.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 15.0, coolingDesignMaxTemp: 30.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 3.5, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 50.0, equipmentHeat: 300.0, dhwDemand: 10.0
    },
    // 19. Gym (was 31)
    "19_gym": {
        id: "19_gym", name: "19 스포츠 홀 (체육관)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 23,
        dailyUsageHours: 15.0, annualUsageDays: 250.0,
        usageHoursDay: 2509.0, usageHoursNight: 1241.0,
        hvacDailyOperationHours: 17.0, hvacAnnualOperationDays: 250.0,
        illuminance: 300.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.3,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "-",
        minOutdoorAir: 3.0, minOutdoorAirFlow: 1.25,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.9,
        metabolicHeat: 65.0, equipmentHeat: 5.0, dhwDemand: 50.0
    },
    // 20. Fitness (was 35)
    "20_fitness": {
        id: "20_fitness", name: "20 피트니스/체조",
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
        minOutdoorAir: 12.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 0.9,
        metabolicHeat: 280.0, equipmentHeat: 30.0, dhwDemand: 120.0
    },
    // 21. Pool (Placeholder - new)
    "21_pool": {
        id: "21_pool", name: "21 수영장 (실내)",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 22,
        dailyUsageHours: 14.0, annualUsageDays: 365.0,
        usageHoursDay: 3600.0, usageHoursNight: 1510.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 26.0, coolingSetpoint: 28.0,
        heatingSetbackTemp: 24.0,
        heatingDesignMinTemp: 26.0, coolingDesignMaxTemp: 30.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 10.0, minOutdoorAirFlow: 5.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 100.0, equipmentHeat: 10.0, dhwDemand: 200.0
    },
    // 22. Lab (was 36)
    "22_lab": {
        id: "22_lab", name: "22 실험실",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 1.0,
        illuminanceDepreciationFactor: 0.92, lightingAbsenceFactor: 0.3,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 22.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 25.0, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 40.0, equipmentHeat: 115.0, dhwDemand: 10.0
    },
    // 23. Exam Room (was 37)
    "23_exam_room": {
        id: "23_exam_room", name: "23 진료실/검사실",
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
        minOutdoorAir: 10.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.3, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 88.0, equipmentHeat: 40.0, dhwDemand: 10.0
    },
    // 24. ICU (was 38)
    "24_icu": {
        id: "24_icu", name: "24 특수 간호/중환자실",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 300.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 0.8,
        heatingSetpoint: 24.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 0.0,
        heatingDesignMinTemp: 22.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 30.0, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 150.0, equipmentHeat: 240.0, dhwDemand: 120.0
    },
    // 25. Corridor Care (was 19)
    "25_corridor_care": {
        id: "25_corridor_care", name: "25 복도 (병동/의료)",
        version: "2025",
        usageHoursStart: 7, usageHoursEnd: 18,
        dailyUsageHours: 11.0, annualUsageDays: 250.0,
        usageHoursDay: 2543.0, usageHoursNight: 207.0,
        hvacDailyOperationHours: 13.0, hvacAnnualOperationDays: 250.0,
        illuminance: 100.0, workplaneHeight: 0.2,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.8,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 0.001, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0
    },
    // 26. Medical Practice (was 40)
    "26_medical_practice": {
        id: "26_medical_practice", name: "26 개인 병원/진료소",
        version: "2025",
        usageHoursStart: 8, usageHoursEnd: 18,
        dailyUsageHours: 10.0, annualUsageDays: 250.0,
        usageHoursDay: 2346.0, usageHoursNight: 154.0,
        hvacDailyOperationHours: 12.0, hvacAnnualOperationDays: 250.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 22.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 10.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.3, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 75.0, equipmentHeat: 30.0, dhwDemand: 10.0
    },
    // 27. Exhibition (was 27)
    "27_exhibition": {
        id: "27_exhibition", name: "27 전시실/박물관",
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
        humidityRequirement: "o. T.",
        minOutdoorAir: 2.0, minOutdoorAirFlow: 2.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 30.0, equipmentHeat: 5.0, dhwDemand: 0.0
    },
    // 28. Trade Fair (was 26 Stage?) - Assuming 'Messe'
    "28_trade_fair": {
        id: "28_trade_fair", name: "28 전시회장/메세 (Messe)",
        version: "2025",
        usageHoursStart: 13, usageHoursEnd: 18,
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
        minOutdoorAir: 7.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.7, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 145.0, equipmentHeat: 15.0, dhwDemand: 0.0
    },
    // 29-32 Placeholders or Extensions
    // 33. Foyer (was 24)
    "33_foyer": {
        id: "33_foyer", name: "33 풍실 (Windfang)/로비",
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
        minOutdoorAir: 25.0, minOutdoorAirFlow: 5.0,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 95.0, equipmentHeat: 5.0, dhwDemand: 5.0
    },
    // 34. Retail Refrig (was 7)
    "34_retail_refrig": {
        id: "34_retail_refrig", name: "34 판매 (냉장)",
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
        minOutdoorAir: 4.0, minOutdoorAirFlow: 2.5,
        hvacAbsenceFactor: 0.5, hvacPartialOperationFactor: 1.0,
        metabolicHeat: 88.0, equipmentHeat: 25.0, dhwDemand: 5.0
    },
    // 35. Kitchen High (Extension) - Placeholder, same as 13 for now
    "35_kitchen_high": {
        id: "35_kitchen_high", name: "35 주방 (고부하)",
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
        minOutdoorAir: 120.0, minOutdoorAirFlow: 0.0, // Higher air
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 60.0, equipmentHeat: 2500.0, dhwDemand: 800.0 // Higher load
    },
    // 36. Hotel Spa (Extension) - use Sauna logic
    "36_hotel_wellness": {
        id: "36_hotel_wellness", name: "36 호텔 웰니스/스파",
        version: "2025",
        usageHoursStart: 10, usageHoursEnd: 22,
        dailyUsageHours: 12.0, annualUsageDays: 365.0,
        usageHoursDay: 2933.0, usageHoursNight: 1447.0,
        hvacDailyOperationHours: 14.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.0,
        partialOperationFactorLighting: 1.0,
        heatingSetpoint: 24.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 23.0, coolingDesignMaxTemp: 0.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 15.0, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 65.0, equipmentHeat: 510.0, dhwDemand: 1000.0
    },
    // 38. Server (Extension) - Placeholder
    "38_server": {
        id: "38_server", name: "38 서버룸",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.96, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 0.5,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 1.3, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 20.0, equipmentHeat: 1500.0, dhwDemand: 0.0
    },
    // 39. Datacenter (was 21)
    "39_datacenter": {
        id: "39_datacenter", name: "39 데이터 센터",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 500.0, workplaneHeight: 0.8,
        illuminanceDepreciationFactor: 0.96, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 0.5,
        heatingSetpoint: 21.0, coolingSetpoint: 24.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 26.0,
        humidityRequirement: "m.T.",
        minOutdoorAir: 1.3, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 20.0, equipmentHeat: 2000.0, dhwDemand: 0.0
    },
    // 41. Logistics (was 41)
    "41_logistics": {
        id: "41_logistics", name: "41 물류 창고",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 150.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.6,
        partialOperationFactorLighting: 0.4,
        heatingSetpoint: 12.0, coolingSetpoint: 26.0,
        heatingSetbackTemp: 0.0,
        heatingDesignMinTemp: 12.0, coolingDesignMaxTemp: 28.0,
        humidityRequirement: "-",
        minOutdoorAir: 1.0, minOutdoorAirFlow: 0.0,
        hvacAbsenceFactor: 0.0, hvacPartialOperationFactor: 0.0,
        metabolicHeat: 0.0, equipmentHeat: 0.0, dhwDemand: 0.0
    },
    // 42. Residential Single (was 42)
    "42_res_single": {
        id: "42_res_single", name: "42 주거 (단독 주택)",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.58,
        partialOperationFactorLighting: 0.9,
        heatingSetpoint: 20.0, coolingSetpoint: 26.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 28.0,
        humidityRequirement: "m. T.",
        minOutdoorAir: 1.0, minOutdoorAirFlow: 0.5,
        hvacAbsenceFactor: 0.13, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 22.0, equipmentHeat: 31.0, dhwDemand: 45.0
    },
    // 43. Residential Multi (was 43)
    "43_res_multi": {
        id: "43_res_multi", name: "43 주거 (공동 주택)",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.5,
        partialOperationFactorLighting: 0.9,
        heatingSetpoint: 20.0, coolingSetpoint: 26.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 28.0,
        humidityRequirement: "m. T.",
        minOutdoorAir: 1.0, minOutdoorAirFlow: 0.5,
        hvacAbsenceFactor: 0.13, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 33.0, equipmentHeat: 75.0, dhwDemand: 45.0
    },
    // 44. Dorm (was 44)
    "44_dorm": {
        id: "44_dorm", name: "44 기숙사/고시원",
        version: "2025",
        usageHoursStart: 0, usageHoursEnd: 24,
        dailyUsageHours: 24.0, annualUsageDays: 365.0,
        usageHoursDay: 4407.0, usageHoursNight: 4353.0,
        hvacDailyOperationHours: 24.0, hvacAnnualOperationDays: 365.0,
        illuminance: 200.0, workplaneHeight: 0.0,
        illuminanceDepreciationFactor: 1.0, lightingAbsenceFactor: 0.54,
        partialOperationFactorLighting: 0.9,
        heatingSetpoint: 20.0, coolingSetpoint: 26.0,
        heatingSetbackTemp: 4.0,
        heatingDesignMinTemp: 20.0, coolingDesignMaxTemp: 28.0,
        humidityRequirement: "m. T.",
        minOutdoorAir: 1.0, minOutdoorAirFlow: 0.5,
        hvacAbsenceFactor: 0.13, hvacPartialOperationFactor: 0.7,
        metabolicHeat: 28.0, equipmentHeat: 55.0, dhwDemand: 30.0
    },
};

export const PROFILE_OPTIONS = Object.values(DIN_18599_PROFILES).sort((a, b) => {
    // Sort by Number in name
    const numA = parseFloat(a.name.split(' ')[0]); // Parse float to handle 17.1
    const numB = parseFloat(b.name.split(' ')[0]);

    if (isNaN(numA) && isNaN(numB)) return a.name.localeCompare(b.name);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;

    return numA - numB;
});
