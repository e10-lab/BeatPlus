import { calculateZoneMonthly, processMonthlyWeather, MonthlyClimateIndices } from "@/engine/calculator";
import { ZoneInput } from "@/engine/types";
import { BuildingSystem } from "@/types/system";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { getClimateData } from "@/engine/climate-data";

/**
 * Verification result interface
 */
export interface VerificationResult {
    name: string;
    passed: boolean;
    details: string;
    expected?: string;
    actual?: string;
}

/**
 * Helper to create a standard test zone
 */
const createTestZone = (profileId: string): ZoneInput => {
    const profile = DIN_18599_PROFILES[profileId];
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    // Define geometry
    const floorArea = 100; // m²
    const height = 3; // m
    const wallArea = (Math.sqrt(floorArea) * 4) * height; // Square room: 10x10 -> 40m perimeter -> 120m² walls
    const windowRatio = 0.3; // 30%
    const windowArea = wallArea * windowRatio;
    const opaqueWallArea = wallArea - windowArea;

    // U-Values
    const uWall = 0.28;
    const uWindow = 1.5;
    const uRoof = 0.2;
    const uFloor = 0.3;

    return {
        id: "test-zone",
        projectId: "test-project",
        name: "Test Zone",
        usageType: profileId as any,
        area: floorArea,
        height: height,
        volume: floorArea * height,
        temperatureSetpoints: {
            heating: profile.heatingSetpoint,
            cooling: profile.coolingSetpoint
        },
        surfaces: [
            {
                id: "s1", zoneId: "test-zone", name: "Wall North", type: "wall_exterior", area: opaqueWallArea / 4, uValue: uWall, orientation: "N", fx: 1.0
            },
            {
                id: "s2", zoneId: "test-zone", name: "Wall East", type: "wall_exterior", area: opaqueWallArea / 4, uValue: uWall, orientation: "E", fx: 1.0
            },
            {
                id: "s3", zoneId: "test-zone", name: "Wall South", type: "wall_exterior", area: opaqueWallArea / 4, uValue: uWall, orientation: "S", fx: 1.0
            },
            {
                id: "s4", zoneId: "test-zone", name: "Wall West", type: "wall_exterior", area: opaqueWallArea / 4, uValue: uWall, orientation: "W", fx: 1.0
            },
            {
                id: "w1", zoneId: "test-zone", name: "Window South", type: "window", area: windowArea, uValue: uWindow, orientation: "S", fx: 1.0, shgc: 0.5
            },
            {
                id: "r1", zoneId: "test-zone", name: "Roof", type: "roof_exterior", area: floorArea, uValue: uRoof, orientation: "Horiz", fx: 1.0
            },
            {
                id: "f1", zoneId: "test-zone", name: "Floor", type: "floor_ground", area: floorArea, uValue: uFloor, orientation: "Horiz", fx: 0.6 // Ground factor
            }
        ],
        // Defaults
        ventilationMode: "natural"
    };
};

/**
 * Run verification tests
 */
export const runVerifications = (): VerificationResult[] => {
    const results: VerificationResult[] = [];

    // Test Case 1: Office Standard
    try {
        const zone = createTestZone("1_office");
        const climate = getClimateData("Seoul");

        // Systems
        const dhw = { id: "dhw1", name: "DHW", projectId: "test", isShared: true, type: "DHW" } as BuildingSystem;
        const heating = { id: "heat1", name: "Heat", projectId: "test", isShared: true, type: "HEATING" } as BuildingSystem;
        const cooling = { id: "cool1", name: "Cool", projectId: "test", isShared: true, type: "COOLING" } as BuildingSystem;
        const ahu = { id: "ahu1", name: "AHU", projectId: "test", isShared: true, type: "AHU" } as BuildingSystem;
        const lighting = { id: "light1", name: "Light", projectId: "test", isShared: true, type: "LIGHTING" } as BuildingSystem;

        // Note: ensure calculateZoneMonthly signature matches
        // zone: ZoneInput, monthlyIndices: MonthlyClimateIndices[], ... systems?: Project['systems']
        // monthlyIndices logic is internal or passed?
        // calculator.ts: calculateZoneMonthly(zone, monthlyIndices, ...)
        // Wait, getClimateData returns ClimateData { monthly: MonthlyClimate[] }
        // MonthlyClimateIndices is { month, Te, Is_Horiz ... } which matches MonthlyClimate pretty much.
        // Let's check type compatibility.

        const systems = [dhw, heating, cooling, ahu, lighting];

        // We need to link systems to zone theoretically, or use default logic?
        // Calculator uses: systems?.find(s => s.type === "AHU" && (s.linkedZoneIds?.includes(zone.id) || s.isShared))
        // So we must set isShared: true or linkedZoneIds.
        dhw.isShared = true;
        heating.isShared = true;
        cooling.isShared = true;
        ahu.isShared = true;
        lighting.isShared = true;

        // Generate indices
        const indices: MonthlyClimateIndices[] = processMonthlyWeather(
            [zone],
            climate.monthly,
            climate.hourly,
            climate.latitude || 37.5
        );

        const calculation = calculateZoneMonthly(
            zone,
            indices,
            "Heavy",
            undefined,
            undefined,
            undefined,
            systems,
            [] // constructions (optional if surfaces have uValues)
        );

        if (!calculation) {
            throw new Error("Calculation returned null");
        }

        // Assertions
        const totalHeating = calculation.monthly.reduce((sum: number, m: any) => sum + m.Q_h_b, 0);
        const totalCooling = calculation.monthly.reduce((sum: number, m: any) => sum + m.Q_c_b, 0);

        // 1-1. Heating Demand > 0 (Seoul is cold in winter)
        // 1-1. Heating Demand > 0 (Seoul is cold in winter)
        if (totalHeating > 10) {
            results.push({ name: "사무실: 난방 부하 발생 (Heating Demand)", passed: true, details: `총 난방 부하 = ${totalHeating.toFixed(1)} kWh` });
        } else {
            results.push({ name: "사무실: 난방 부하 발생 (Heating Demand)", passed: false, details: `난방 부하 과소: ${totalHeating.toFixed(1)} kWh`, expected: "> 10" });
        }

        // 1-2. Cooling Demand > 0 (Seoul is hot in summer)
        // 1-2. Cooling Demand > 0 (Seoul is hot in summer)
        if (totalCooling > 10) {
            results.push({ name: "사무실: 냉방 부하 발생 (Cooling Demand)", passed: true, details: `총 냉방 부하 = ${totalCooling.toFixed(1)} kWh` });
        } else {
            results.push({ name: "사무실: 냉방 부하 발생 (Cooling Demand)", passed: false, details: `냉방 부하 과소: ${totalCooling.toFixed(1)} kWh`, expected: "> 10" });
        }

        // 1-3. Seasonality
        const jan = calculation.monthly[0];
        const aug = calculation.monthly[7];

        if (jan.Q_h_b > jan.Q_c_b) {
            results.push({ name: "계절성: 1월 난방 우세", passed: true, details: `1월 난방(${jan.Q_h_b.toFixed(0)}) > 냉방(${jan.Q_c_b.toFixed(0)})` });
        } else {
            results.push({ name: "계절성: 1월 난방 우세", passed: false, details: `1월 난방 ${jan.Q_h_b} vs 냉방 ${jan.Q_c_b}` });
        }

        if (aug.Q_c_b > aug.Q_h_b) {
            results.push({ name: "계절성: 8월 냉방 우세", passed: true, details: `8월 냉방(${aug.Q_c_b.toFixed(0)}) > 난방(${aug.Q_h_b.toFixed(0)})` });
        } else {
            results.push({ name: "계절성: 8월 냉방 우세", passed: false, details: `8월 냉방 ${aug.Q_c_b} vs 난방 ${aug.Q_h_b}` });
        }

        // 1-4. DHW Timer Effect
        // Check if Q_w_d (Distribution Loss) reflects timer?
        // We set timer=true. Standard op time 16h instead of 24h.
        // If we run another calc with timer=false, loss should be higher.
        // Ideally we skip this complexity for now to keep it simple.

    } catch (e: any) {
        results.push({ name: "사무실 테스트 실행 오류", passed: false, details: `예외 발생: ${e.message}\n${e.stack}` });
    }

    return results;
};
