
import { calculateEnergyDemand } from '../calculator';
import { ZoneInput } from '../types';

function createTestZoneNoVent(): ZoneInput {
    return {
        id: 'test-zone-no-vent',
        projectId: 'test-project',
        name: 'No Vent Zone',
        usageType: '1_office', // minOutdoorAir = 4.0 m3/h.m2 (approx)
        area: 100,
        height: 3,
        volume: 300,
        surfaces: [
            { id: 'wall1', zoneId: 'test-zone-no-vent', name: 'Wall', type: 'wall_exterior', area: 100, uValue: 0.2, fx: 1.0 }
        ],
        temperatureSetpoints: { heating: 20, cooling: 26 },
        // No ventilationConfig, No linked units
        ventilationMode: undefined,
        linkedVentilationUnitIds: [],
    } as any;
}

async function runTest() {
    console.log("Verifying Default Ventilation Logic (Undefined System)...");

    const zone = createTestZoneNoVent();
    const mockClimate = {
        monthly: Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            Te: 5,
            Is_Horiz: 20,
            phi: 50
        })),
        latitude: 37.5
    };

    // 1. Run with No Config -> Should default to Forced Mechanical
    const results = calculateEnergyDemand([zone], mockClimate as any);
    const jan = results.zones[0].monthly[0];

    console.log(`\nMonth: ${jan.month}`);
    console.log(`Q_heating: ${jan.Q_heating.toFixed(2)} kWh`);

    // We can't see internal flags directly, but we can check H_ve or Q_vent?
    // Hourly results not available in monthly method return (array empty).
    // We can interpret from QV_heat.
    // QV_heat = H_ve * (Ti - Te) * time / 1000
    // Ti ~ 20 (or slightly less due to setback), Te = 5. Delta ~ 15.
    // Time = 31 * 24 = 744.
    // QV = H_ve * 15 * 744 / 1000 = H_ve * 11.16

    // H_ve = rho * cp * n * V.
    // n_nutz for '1_office' (DIN 18599-10 2018/2025):
    // minOutdoorAir = 4 m3/(h m2) * 100 m2 = 400 m3/h?
    // Wait, profile 1_office minOutdoorAir is 4.0? Let's check profile.
    // If n_mech = n_nutz = 400 m3/h approx.
    // V = 300 m3.
    // n = 400 / 300 = 1.33 1/h.
    // H_ve = 300 * 0.34 * 1.33 = 136 W/K.
    // QV_heat approx = 136 * 11.16 = 1517 kWh.

    console.log(`QV_heat: ${jan.QV_heat.toFixed(2)} kWh`);

    // If it was Natural (Window), n_win would be calculated.
    // Usually n_win ~ n_nutz as well, but might be different.
    // The key is checks for Q_aux (Fan Power) should be 0.

    console.log(`Q_aux (Fan): ${jan.Q_aux.toFixed(2)} kWh`);

    if (jan.Q_aux === 0) {
        console.log("✅ Fan Power is 0 (Virtual System confirmed).");
    } else {
        console.error(`❌ Fan Power should be 0, got ${jan.Q_aux}`);
    }

    if (jan.QV_heat > 100) {
        console.log("✅ Significant Ventilation Heat Loss detected (Mechanical active).");
    } else {
        console.error("❌ Ventilation Loss too low.");
    }

}

runTest();
