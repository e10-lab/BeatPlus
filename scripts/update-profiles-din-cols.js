/**
 * Script to update din-18599-profiles.ts with missing DIN Part 10 columns
 * and rename illuminanceDepreciationFactor to reductionFactorTaskArea (k_A)
 */

const fs = require('fs');

// Data source: NotebookLM extraction from DIN Table 6
// [t_h_op_d, k_A, k, k_vB]
// Note: k_A is the *new* name for illuminanceDepreciationFactor (values should match what's in code mostly)
// k_L (maintenanceFactor) will default to 0.8
const PROFILE_DATA = {
    "1_office": [13, 0.84, 0.9, 1],
    "2_group_office": [13, 0.92, 1.25, 1],
    "3_open_plan": [13, 0.93, 2.5, 1],
    "4_meeting": [13, 0.87, 1.5, 1],
    "5_counter_hall": [13, 0.87, 1.5, 1],
    "5_1_meeting_large": [13, 0.87, 1.5, 1], // Assumed same as profile 4
    "6_retail_department": [14, 0.93, 2.5, 1],
    "7_retail_cooling": [14, 0.93, 2.5, 1],
    "8_classroom": [9, 0.97, 2, 1],
    "9_lecture_hall": [12, 0.92, 2.5, 1],
    "10_bed_room": [24, 1.00, 1.5, 1],
    "11_hotel_room": [24, 1.00, 1.25, 1],
    "12_canteen": [9, 0.97, 2.5, 1],
    "13_restaurant": [16, 1.00, 2.5, 1],
    "14_kitchen": [15, 0.96, 1.5, 1],
    "15_kitchen_prep": [15, 1.00, 1.5, 1],
    "16_wc_sanitary": [null, 1.00, 0.8, 1], // null means "-" -> likely no specific heating hours defined, use HVAC?
    "17_other_common": [13, 0.93, 1.25, 1],
    "17_1_workshop_medium": [10, 0.85, 2.5, 1], // Assumed similar to industrial med
    "18_ancillary_no_common": [null, 1.00, 1.5, 1],
    "19_traffic_area": [null, 1.00, 0.8, 1],
    "20_storage_technical": [null, 1.00, 1.5, 2], // k_vB = 2!
    "21_data_center": [24, 0.96, 1.5, 1],
    "22_industrial_heavy": [10, 0.85, 2.5, 1],
    "23_industrial_medium": [10, 0.85, 2.5, 1],
    "24_industrial_light": [10, 0.85, 2.5, 1],
    "25_audience_area": [6, 0.97, 4, 1],
    "26_theater_foyer": [6, 1.00, 4, 1],
    "27_stage": [12, 0.90, 2.5, 1],
    "28_trade_fair_congress": [11, 0.93, 5, 1],
    "29_exhibition_museum": [24, 0.88, 2, 1],
    "30_library_reading": [14, 0.88, 1.5, 1],
    "31_library_open_access": [14, 1.00, 1.7, 1],
    "32_library_stack": [14, 1.00, 1.5, 1],
    "33_sports_hall": [17, 1.00, 1, 1],
    "34_parking_private": [13, 1.00, 2, 1],
    "35_parking_public": [null, 1.00, 4, 1],
    "36_sauna_area": [14, 1.00, 1, 1],
    "37_fitness_room": [17, 1.00, 1, 1],
    "38_laboratory": [13, 0.92, 1.25, 1],
    "39_exam_treatment": [13, 1.00, 1.25, 1],
    "40_special_care": [24, 1.00, 1.2, 1],
    "41_corridor_care": [null, 1.00, 1, 1],
    "42_medical_practice": [12, 1.00, 1.2, 1],
    "43_storage": [24, 1.00, 2.4, 1],
    "44_res_single": [24, 1.0, 1.0, 1], // residential default
    "45_res_multi": [24, 1.0, 1.0, 1], // residential default
    "29_library": [14, 0.88, 1.5, 1], // mapped to 30
};

const filePath = '/Users/zero/Documents/GitHub/BeatPlus/src/lib/din-18599-profiles.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update Interface
console.log('Updating UsageProfile interface...');
const interfaceEnd = content.indexOf('// 2. 조명');
if (interfaceEnd !== -1) {
    // Add usage hours fields if not present
    if (!content.includes('heatingDailyOperationHours')) {
        const replacement = `    hvacAnnualOperationDays: number; // days (공조 설비 연간 가동 일수)
    heatingDailyOperationHours?: number; // t_h,op,d [h/d] (난방 일일 가동 시간 - Table 6 Col 11)`;
        content = content.replace('hvacAnnualOperationDays: number; // days (공조 설비 연간 가동 일수)', replacement);
    }
}

// Rename illuminanceDepreciationFactor to reductionFactorTaskArea
console.log('Renaming illuminanceDepreciationFactor to reductionFactorTaskArea...');
content = content.replace(/illuminanceDepreciationFactor:/g, 'reductionFactorTaskArea:'); // interface
content = content.replace(/illuminanceDepreciationFactor: number; \/\/ k_L \(유지율\/감광 보상률\)/,
    `reductionFactorTaskArea: number; // k_A (작업 영역 감소 계수 - Table 6 Col 14)
    roomIndex?: number; // k (공간 지수 - Table 6 Col 16)
    verticalFacadeFactor?: number; // k_vB (수직면 보정 계수 - Table 6 Col 18)
    maintenanceFactor?: number; // k_L (유지율 - Default 0.8)`);

// 2. Update Profiles
console.log('Updating profiles...');
for (const [key, [th, kA, k, kvB]] of Object.entries(PROFILE_DATA)) {
    const profilePattern = `"${key}"`;
    const profileIdx = content.indexOf(profilePattern);

    if (profileIdx === -1) continue;

    // Find hvacAnnualOperationDays line to insert heating hours
    const afterProfile = content.substring(profileIdx);
    const hvacMatch = afterProfile.match(/hvacAnnualOperationDays: [\d.]+,/);

    if (hvacMatch) {
        const matchIdx = profileIdx + afterProfile.indexOf(hvacMatch[0]);
        // Insert heatingDailyOperationHours if defined
        if (th !== null) {
            const nextChunk = content.substring(matchIdx, matchIdx + 200);
            if (!nextChunk.includes('heatingDailyOperationHours')) {
                const insert = ` hvacAnnualOperationDays: ${hvacMatch[0].match(/[\d.]+/)[0]},\n        heatingDailyOperationHours: ${th},`;
                content = content.substring(0, matchIdx) + insert + content.substring(matchIdx + hvacMatch[0].length);
            }
        }
    }

    // Update lighting factors
    // Find reductionFactorTaskArea (renamed from illuminanceDepreciationFactor)
    // We need to search effectively because we just did a global replace on the property name
    // The property name in the object literal is now 'reductionFactorTaskArea'

    const lightingStart = content.indexOf('reductionFactorTaskArea:', profileIdx);
    if (lightingStart !== -1 && lightingStart < profileIdx + 1500) { // check distinct profile
        const lineEnd = content.indexOf('\n', lightingStart);
        const line = content.substring(lightingStart, lineEnd);

        // Construct new line
        // k_A might correct existing value
        const indent = '        ';
        let newLine = `reductionFactorTaskArea: ${kA}, lightingAbsenceFactor:`;

        // preserve lightingAbsenceFactor from original line
        const absenceMatch = line.match(/lightingAbsenceFactor: ([\d.]+)/);
        const absenceVal = absenceMatch ? absenceMatch[1] : '0.0';

        newLine += ` ${absenceVal},`;

        // Add new fields
        newLine += `\n${indent}roomIndex: ${k}, verticalFacadeFactor: ${kvB}, maintenanceFactor: 0.8,`;

        content = content.substring(0, lightingStart) + newLine + content.substring(lineEnd);
        console.log(`Updated ${key}: k_A=${kA}, k=${k}, k_vB=${kvB}, t_h=${th}`);
    }
}

fs.writeFileSync(filePath, content);
console.log('Done!');
