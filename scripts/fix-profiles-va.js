/**
 * Script to add minOutdoorAirBuilding (V_A,Geb) values 
 * and fix minOutdoorAir (V_A) values in din-18599-profiles.ts
 */

const fs = require('fs');

// DIN Table 7 definitive values: V_A (col 25) and V_A,Geb (col 26)
const DIN_VALUES = {
    // profileKey: [V_A, V_A_Geb]
    "1_single_office": [4, 2.5],
    "2_group_office": [4, 2.5],
    "3_open_plan_office": [6, 2.5],
    "4_meeting_room": [15, 2.5],
    "5_counter_hall": [2, 1.25],
    "5_1_meeting_large": [15, 2.5],  // same as 4
    "6_retail_department": [4, 2.5],
    "7_retail_cold": [4, 2.5],
    "8_classroom": [10, 2.5],
    "9_lecture_hall": [30, 2.5],
    "10_bed_room": [3, 2.5],
    "11_hotel_room": [3, 2.5],
    "12_canteen": [18, 2.5],
    "13_restaurant": [18, 2.5],
    "14_kitchen": [90, 0],       // "-"
    "15_prep_kitchen": [15, 0],  // "-"
    "16_wc_sanitary": [15, 5.0],
    "17_other_habitable": [7, 2.5],
    "17_1_workshop_medium": [2.5, 0], // industrial "g" → 0
    "18_ancillary": [0.15, 0],   // "-"
    "19_circulation": [0, 0],    // "-"
    "20_storage_technical": [0.15, 0], // "-"
    "21_data_center": [1.3, 0],  // "-"
    "22_industrial_heavy": [3.5, 0],  // "g"
    "23_industrial_medium": [2.5, 0], // "g"
    "24_industrial_light": [1.5, 0],  // "g"
    "25_audience_area": [40, 5.0],
    "26_foyer_theater": [25, 5.0],
    "27_stage": [0.3, 0],        // "-"
    "28_fair_congress": [7, 2.5],
    "29_exhibition": [2, 2.0],
    "30_library_reading": [2, 2.0],
    "31_library_open_access": [2, 2.0],
    "32_library_stack": [3, 2.0],
    "33_sports_hall": [1.25, 0.5],
    "34_parking_office": [8, 0],  // "-"
    "35_parking_public": [8, 0],  // "-"
    "36_sauna_area": [15, 0],     // "-"
    "37_fitness_room": [12, 2.5],
    "38_laboratory": [25, 0],     // "g"
    "39_exam_treatment": [10, 2.5],
    "40_special_care": [30, 0],   // "-"
    "41_corridor_care": [10, 0],  // "-"
    "42_medical_practice": [4, 2.5],
    "43_storage": [1, 0],         // "-"
    "44_res_single": [1.25, 0],   // residential
    "45_res_multi": [1.25, 0],    // residential
};

const filePath = '/Users/zero/Documents/GitHub/BeatPlus/src/lib/din-18599-profiles.ts';
let content = fs.readFileSync(filePath, 'utf-8');

for (const [key, [va, vaGeb]] of Object.entries(DIN_VALUES)) {
    // Find minOutdoorAir line for this profile
    // Pattern: within the profile block, find the minOutdoorAir line and add minOutdoorAirBuilding after it
    const profilePattern = `"${key}"`;
    const profileIdx = content.indexOf(profilePattern);
    if (profileIdx === -1) {
        console.log(`WARN: Profile ${key} not found`);
        continue;
    }

    // Find the next minOutdoorAir line after this profile
    const afterProfile = content.substring(profileIdx);
    const minOutdoorMatch = afterProfile.match(/minOutdoorAir: [\d.-]+,?\s*(?:\/\/.*)?/);
    if (!minOutdoorMatch) {
        console.log(`WARN: No minOutdoorAir found after ${key}`);
        continue;
    }

    const matchIdx = profileIdx + afterProfile.indexOf(minOutdoorMatch[0]);
    const oldLine = minOutdoorMatch[0];

    // Check if minOutdoorAirBuilding already exists nearby
    const nextChunk = content.substring(matchIdx, matchIdx + 200);
    if (nextChunk.includes('minOutdoorAirBuilding')) {
        console.log(`SKIP: ${key} already has minOutdoorAirBuilding`);
        // Still fix the V_A value if needed
        const currentVA = parseFloat(oldLine.match(/minOutdoorAir: ([\d.-]+)/)[1]);
        if (Math.abs(currentVA - va) > 0.001) {
            console.log(`  FIX V_A: ${currentVA} → ${va}`);
            const newLine = oldLine.replace(/minOutdoorAir: [\d.-]+/, `minOutdoorAir: ${va}`);
            content = content.substring(0, matchIdx) + newLine + content.substring(matchIdx + oldLine.length);
        }
        continue;
    }

    // Fix V_A value and add V_A,Geb
    const currentVA = parseFloat(oldLine.match(/minOutdoorAir: ([\d.-]+)/)[1]);
    let newLine = oldLine;
    if (Math.abs(currentVA - va) > 0.001) {
        console.log(`FIX V_A for ${key}: ${currentVA} → ${va}`);
        newLine = oldLine.replace(/minOutdoorAir: [\d.-]+/, `minOutdoorAir: ${va}`);
    }

    // Get indentation from the current line
    const lineStart = content.lastIndexOf('\n', matchIdx) + 1;
    const indent = content.substring(lineStart, matchIdx).match(/^\s*/)[0];

    // Add minOutdoorAirBuilding after minOutdoorAir line
    const addLine = `\n${indent}minOutdoorAirBuilding: ${vaGeb},`;
    const replacement = newLine.replace(/,?\s*$/, ',') + addLine;

    content = content.substring(0, matchIdx) + replacement + content.substring(matchIdx + oldLine.length);
    console.log(`OK: ${key} V_A=${va}, V_A,Geb=${vaGeb}`);
}

fs.writeFileSync(filePath, content);
console.log('\nDone! File updated.');
