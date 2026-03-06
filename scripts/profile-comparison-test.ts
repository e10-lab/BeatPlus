/**
 * Profile Comparison Test
 * Compares old vs new profile values and shows calculation impact
 */

// Old values (before DIN Table 7 correction)
const OLD_VALUES: Record<string, { metabolicHeat: number; equipmentHeat: number; minOutdoorAir: number; heatingSetbackTemp: number; illuminance: number }> = {
    "3_open_plan_office": { metabolicHeat: 45.0, equipmentHeat: 70.0, minOutdoorAir: 6.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "4_meeting_room": { metabolicHeat: 95.0, equipmentHeat: 0.0, minOutdoorAir: 15.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "5_counter_hall": { metabolicHeat: 15.0, equipmentHeat: 25.0, minOutdoorAir: 2.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "6_retail_department": { metabolicHeat: 80.0, equipmentHeat: 250.0, minOutdoorAir: 4.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "7_retail_cold": { metabolicHeat: 80.0, equipmentHeat: 40.0, minOutdoorAir: 3.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "8_classroom": { metabolicHeat: 100.0, equipmentHeat: 27.5, minOutdoorAir: 10.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "9_lecture_hall": { metabolicHeat: 420.0, equipmentHeat: 1.0, minOutdoorAir: 30.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "10_bed_room": { metabolicHeat: 120.0, equipmentHeat: 24.0, minOutdoorAir: 5.0, heatingSetbackTemp: 0.0, illuminance: 300 },
    "11_hotel_room": { metabolicHeat: 70.0, equipmentHeat: 44.0, minOutdoorAir: 3.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "12_canteen": { metabolicHeat: 175.0, equipmentHeat: 10.0, minOutdoorAir: 18.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "16_wc_sanitary": { metabolicHeat: 0.0, equipmentHeat: 0.0, minOutdoorAir: 15.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "21_data_center": { metabolicHeat: 2.8, equipmentHeat: 150.0, minOutdoorAir: 1.3, heatingSetbackTemp: 0.0, illuminance: 500 },
    "22_industrial_heavy": { metabolicHeat: 6.0, equipmentHeat: 35.0, minOutdoorAir: 3.5, heatingSetbackTemp: 4.0, illuminance: 300 },
    "25_audience_area": { metabolicHeat: 93.0, equipmentHeat: 0.0, minOutdoorAir: 40.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "28_fair_congress": { metabolicHeat: 23.3, equipmentHeat: 2.0, minOutdoorAir: 7.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "30_library_reading": { metabolicHeat: 28.0, equipmentHeat: 6.0, minOutdoorAir: 8.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "33_sports_hall": { metabolicHeat: 20.0, equipmentHeat: 6.3, minOutdoorAir: 3.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "36_sauna_area": { metabolicHeat: 5.8, equipmentHeat: 50.0, minOutdoorAir: 15.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "37_fitness_room": { metabolicHeat: 22.0, equipmentHeat: 2.0, minOutdoorAir: 12.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "38_laboratory": { metabolicHeat: 6.4, equipmentHeat: 18.0, minOutdoorAir: 25.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "39_exam_treatment": { metabolicHeat: 11.7, equipmentHeat: 7.0, minOutdoorAir: 10.0, heatingSetbackTemp: 0.0, illuminance: 500 },
    "40_special_care": { metabolicHeat: 4.7, equipmentHeat: 9.5, minOutdoorAir: 30.0, heatingSetbackTemp: 0.0, illuminance: 300 },
    "42_medical_practice": { metabolicHeat: 5.8, equipmentHeat: 5.0, minOutdoorAir: 10.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "43_storage": { metabolicHeat: 0.0, equipmentHeat: 0.0, minOutdoorAir: 1.0, heatingSetbackTemp: 0.0, illuminance: 200 },
};

// New values (after DIN Table 7 correction)
const NEW_VALUES: Record<string, { metabolicHeat: number; equipmentHeat: number; minOutdoorAir: number; heatingSetbackTemp: number; illuminance: number }> = {
    "3_open_plan_office": { metabolicHeat: 42.0, equipmentHeat: 60.0, minOutdoorAir: 6.0, heatingSetbackTemp: 4.0, illuminance: 750 },
    "4_meeting_room": { metabolicHeat: 93.0, equipmentHeat: 5.0, minOutdoorAir: 15.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "5_counter_hall": { metabolicHeat: 35.0, equipmentHeat: 24.0, minOutdoorAir: 1.25, heatingSetbackTemp: 4.0, illuminance: 200 },
    "6_retail_department": { metabolicHeat: 84.0, equipmentHeat: 24.0, minOutdoorAir: 4.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "7_retail_cold": { metabolicHeat: 84.0, equipmentHeat: -170.0, minOutdoorAir: 3.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "8_classroom": { metabolicHeat: 100.0, equipmentHeat: 27.0, minOutdoorAir: 10.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "9_lecture_hall": { metabolicHeat: 140.0, equipmentHeat: 12.0, minOutdoorAir: 30.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "10_bed_room": { metabolicHeat: 120.0, equipmentHeat: 24.0, minOutdoorAir: 5.0, heatingSetbackTemp: 0.0, illuminance: 300 },
    "11_hotel_room": { metabolicHeat: 70.0, equipmentHeat: 44.0, minOutdoorAir: 2.5, heatingSetbackTemp: 0.0, illuminance: 200 },
    "12_canteen": { metabolicHeat: 175.0, equipmentHeat: 3.0, minOutdoorAir: 18.0, heatingSetbackTemp: 0.0, illuminance: 200 },
    "16_wc_sanitary": { metabolicHeat: 0.0, equipmentHeat: 0.0, minOutdoorAir: 5.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "21_data_center": { metabolicHeat: 14.0, equipmentHeat: 1800.0, minOutdoorAir: 1.3, heatingSetbackTemp: 0.0, illuminance: 500 },
    "22_industrial_heavy": { metabolicHeat: 48.0, equipmentHeat: 200.0, minOutdoorAir: 3.5, heatingSetbackTemp: 4.0, illuminance: 300 },
    "25_audience_area": { metabolicHeat: 187.0, equipmentHeat: 0.0, minOutdoorAir: 5.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "28_fair_congress": { metabolicHeat: 140.0, equipmentHeat: 12.0, minOutdoorAir: 7.0, heatingSetbackTemp: 4.0, illuminance: 300 },
    "30_library_reading": { metabolicHeat: 168.0, equipmentHeat: 0.0, minOutdoorAir: 8.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "33_sports_hall": { metabolicHeat: 63.0, equipmentHeat: 0.0, minOutdoorAir: 1.25, heatingSetbackTemp: 4.0, illuminance: 300 },
    "36_sauna_area": { metabolicHeat: 58.0, equipmentHeat: 500.0, minOutdoorAir: 15.0, heatingSetbackTemp: 4.0, illuminance: 200 },
    "37_fitness_room": { metabolicHeat: 264.0, equipmentHeat: 24.0, minOutdoorAir: 2.5, heatingSetbackTemp: 4.0, illuminance: 300 },
    "38_laboratory": { metabolicHeat: 39.0, equipmentHeat: 108.0, minOutdoorAir: 25.0, heatingSetbackTemp: 4.0, illuminance: 500 },
    "39_exam_treatment": { metabolicHeat: 82.0, equipmentHeat: 35.0, minOutdoorAir: 2.5, heatingSetbackTemp: 0.0, illuminance: 750 },
    "40_special_care": { metabolicHeat: 112.0, equipmentHeat: 228.0, minOutdoorAir: 0.0, heatingSetbackTemp: 0.0, illuminance: 300 },
    "42_medical_practice": { metabolicHeat: 53.0, equipmentHeat: 25.0, minOutdoorAir: 2.5, heatingSetbackTemp: 4.0, illuminance: 750 },
    "43_storage": { metabolicHeat: 0.0, equipmentHeat: 0.0, minOutdoorAir: 1.0, heatingSetbackTemp: 0.0, illuminance: 150 },
};

// Simplified internal gains calculation (mirrors calculator.ts logic)
function calcInternalGains(profile: typeof OLD_VALUES[string], area: number, month: number): {
    Q_occ: number; Q_eq: number; Q_total: number;
} {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
    const annualUsageDays = 250; // typical office
    const usageDuration = 11; // typical office hours

    const daysUsage = (annualUsageDays / 365) * daysInMonth;
    const hoursUsage = daysUsage * usageDuration;
    const totalHoursM = daysInMonth * 24;

    // Metabolic
    const Q_occ_m = (profile.metabolicHeat * area) * daysUsage;

    // Equipment
    const p_eq = usageDuration > 0 ? (profile.equipmentHeat / usageDuration) : 0;
    const Q_eq_occ = (profile.equipmentHeat * area) * daysUsage;
    const Q_eq_unocc = (p_eq * area * 0.05) * (totalHoursM - hoursUsage);
    const Q_eq_m = Q_eq_occ + Q_eq_unocc;

    return {
        Q_occ: Q_occ_m / 1000,  // kWh
        Q_eq: Q_eq_m / 1000,     // kWh
        Q_total: (Q_occ_m + Q_eq_m) / 1000  // kWh
    };
}

// Run comparison
console.log("=".repeat(120));
console.log("PROFILE COMPARISON TEST — OLD vs NEW (DIN/TS 18599-10 Table 7)");
console.log("Test conditions: Area=100m², January, annualUsageDays=250, usageDuration=11h");
console.log("=".repeat(120));
console.log("");

const AREA = 100; // m²
const MONTH = 0;  // January

interface Issue {
    profile: string;
    field: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    details: string;
}

const issues: Issue[] = [];

for (const [profileId, oldProfile] of Object.entries(OLD_VALUES)) {
    const newProfile = NEW_VALUES[profileId];
    if (!newProfile) continue;

    const oldGains = calcInternalGains(oldProfile, AREA, MONTH);
    const newGains = calcInternalGains(newProfile, AREA, MONTH);

    const deltaTotal = newGains.Q_total - oldGains.Q_total;
    const deltaPct = oldGains.Q_total !== 0 ? ((deltaTotal / oldGains.Q_total) * 100) : (newGains.Q_total !== 0 ? Infinity : 0);

    // Check for significant changes
    const hasSignificantChange = Math.abs(deltaPct) > 10;

    if (hasSignificantChange || profileId === "7_retail_cold" || profileId === "21_data_center") {
        console.log(`--- ${profileId} ---`);
        console.log(`  metabolicHeat: ${oldProfile.metabolicHeat} → ${newProfile.metabolicHeat} Wh/(m²·d)`);
        console.log(`  equipmentHeat: ${oldProfile.equipmentHeat} → ${newProfile.equipmentHeat} Wh/(m²·d)`);
        console.log(`  minOutdoorAir: ${oldProfile.minOutdoorAir} → ${newProfile.minOutdoorAir} m³/(h·m²)`);
        console.log(`  heatingSetbackTemp: ${oldProfile.heatingSetbackTemp} → ${newProfile.heatingSetbackTemp} K`);
        console.log(`  illuminance: ${oldProfile.illuminance} → ${newProfile.illuminance} lx`);
        console.log(`  OLD Internal Gains (Jan): Q_occ=${oldGains.Q_occ.toFixed(1)} kWh, Q_eq=${oldGains.Q_eq.toFixed(1)} kWh, Total=${oldGains.Q_total.toFixed(1)} kWh`);
        console.log(`  NEW Internal Gains (Jan): Q_occ=${newGains.Q_occ.toFixed(1)} kWh, Q_eq=${newGains.Q_eq.toFixed(1)} kWh, Total=${newGains.Q_total.toFixed(1)} kWh`);
        console.log(`  Δ Internal Gains: ${deltaTotal >= 0 ? '+' : ''}${deltaTotal.toFixed(1)} kWh (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`);
        console.log("");
    }

    // Identify issues
    if (newProfile.equipmentHeat < 0) {
        issues.push({
            profile: profileId,
            field: 'equipmentHeat',
            severity: 'CRITICAL',
            details: `Negative equipmentHeat (${newProfile.equipmentHeat}). This is valid for refrigerated retail (heat sink), but calculator uses p_eq = equipmentHeat / usageDuration for parasitic load. With negative value, parasitic load becomes negative too — verify this is handled correctly!`
        });
    }

    if (Math.abs(deltaPct) > 500) {
        issues.push({
            profile: profileId,
            field: 'internal gains',
            severity: 'CRITICAL',
            details: `Internal gains changed by ${deltaPct.toFixed(0)}% (${oldGains.Q_total.toFixed(1)} → ${newGains.Q_total.toFixed(1)} kWh). This is a massive change that will significantly affect energy balance.`
        });
    } else if (Math.abs(deltaPct) > 100) {
        issues.push({
            profile: profileId,
            field: 'internal gains',
            severity: 'WARNING',
            details: `Internal gains changed by ${deltaPct.toFixed(0)}% (${oldGains.Q_total.toFixed(1)} → ${newGains.Q_total.toFixed(1)} kWh).`
        });
    }

    if (newProfile.minOutdoorAir === 0 && oldProfile.minOutdoorAir > 0) {
        issues.push({
            profile: profileId,
            field: 'minOutdoorAir',
            severity: 'WARNING',
            details: `minOutdoorAir changed from ${oldProfile.minOutdoorAir} to 0. This means no mechanical ventilation requirement — verify this doesn't cause division by zero in calculator.`
        });
    }

    if (oldProfile.heatingSetbackTemp > 0 && newProfile.heatingSetbackTemp === 0) {
        issues.push({
            profile: profileId,
            field: 'heatingSetbackTemp',
            severity: 'INFO',
            details: `Night setback removed (${oldProfile.heatingSetbackTemp}K → 0K). Building will maintain full heating temperature 24/7 — higher heating demand expected.`
        });
    }
}

console.log("");
console.log("=".repeat(120));
console.log("POTENTIAL ISSUES IDENTIFIED");
console.log("=".repeat(120));

const criticals = issues.filter(i => i.severity === 'CRITICAL');
const warnings = issues.filter(i => i.severity === 'WARNING');
const infos = issues.filter(i => i.severity === 'INFO');

if (criticals.length > 0) {
    console.log("\n🔴 CRITICAL ISSUES:");
    criticals.forEach(i => console.log(`  [${i.profile}] ${i.field}: ${i.details}`));
}

if (warnings.length > 0) {
    console.log("\n🟡 WARNINGS:");
    warnings.forEach(i => console.log(`  [${i.profile}] ${i.field}: ${i.details}`));
}

if (infos.length > 0) {
    console.log("\n🔵 INFO:");
    infos.forEach(i => console.log(`  [${i.profile}] ${i.field}: ${i.details}`));
}

console.log(`\nTotal: ${criticals.length} critical, ${warnings.length} warnings, ${infos.length} info`);
