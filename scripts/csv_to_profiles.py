
import csv
import json

# Existing ID mapping to preserve keys
ID_MAPPING = {
    "01": "1_single_office",
    "02": "2_group_office",
    "03": "3_open_plan_office",
    "04": "4_meeting",
    "05": "5_counter",
    "06": "6_retail",
    "07": "7_retail_refrig",
    "08": "8_classroom",
    "09": "9_lecture_hall",
    "10": "10_bed_room",
    "11": "11_hotel_room",
    "12": "12_canteen",
    "13": "13_restaurant",
    "14": "14_kitchen",
    "15": "15_kitchen_prep",
    "16": "16_wc",
    "17": "17_common_area",
    "18": "18_support_store",
    "19": "19_corridor_care",
    "20": "20_storage_uncond", # CSV says 19=Tonghaeng, 20=Changgo. 
    # Let's trust the number prefix in the CSV name.
    "21": "21_datacenter",
    "22.1": "22_1_workshop_light",
    "22.2": "22_2_workshop_medium",
    "22.3": "22_3_workshop_heavy",
    "23": "23_theater_audience",
    "24": "24_cloakroom",
    "25": "25_theater_foh",
    "26": "26_stage", # CSV 26 is convention center? Wait.
    # CSV 26: 박람회 및 컨벤션 센터
    # CSV 27: 전시실
    # Current TS: 26_stage, 27_exhibition, 28_fair.
    # Let's map dynamically based on CSV content for now, but safer to use the number.
    "31": "31_gym",
    "32": "32_parking_office",
    "33": "33_parking_public",
    "34": "34_sauna",
    "35": "35_fitness",
    "36": "36_lab",
    "37": "37_exam_room",
    "38": "38_icu",
    "39": "39_corridor_icu",
    "40": "40_medical_practice",
    "41": "41_logistics",
    "42": "residential_single",
    "43": "residential_multi",
    "44": "residential_general",
}

# Add manual map for confusing ones
MANUAL_MAP = {
    "26": "28_fair", # CSV 26 is Fair/Convention
    "27": "27_exhibition", # CSV 27 is Exhibition
    "28": "29_library_public", # CSV 28 is library reading
    "29": "30_library_stack", # Check CSV 29 -> "29 도서관 개방형 서가" -> library_public/stack?
    # CSV 28: 도서관 열람실 -> 29_library_public? Current TS 29 is public.
    # Current TS 30 is stack. CSV 29 is open stack. CSV 30 is preserved stack.
}

def parse_time(t_str):
    if not t_str or ":" not in t_str: return 0
    try:
        parts = t_str.split(":")
        return int(parts[0])
    except:
        return 0

def clean_num(s):
    if not s: return 0
    s = str(s).replace(",", "").replace("%", "")
    try:
        return float(s)
    except:
        return 0

def generate_ts():
    profiles = []
    
    with open('BEAT_EXCEL_2026.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        for row in reader:
            if not row or not row[0]: continue
            
            raw_name = row[0]
            # Extract number prefix
            prefix = raw_name.split(" ")[0]
            
            # Determine ID
            id_key = ID_MAPPING.get(prefix)
            if not id_key:
                # Fallback or manual map
                if prefix == "26": id_key = "28_fair"
                elif prefix == "27": id_key = "27_exhibition"
                elif prefix == "28": id_key = "29_library_public"
                elif prefix == "29": id_key = "30_library_stack" 
                elif prefix == "30": id_key = "30_library_stack_closed" # New?
                elif prefix == "25": id_key = "26_stage" # CSV 25 is Stage
                # 23, 24 in CSV match Theater Audience/Cloakroom?
                # CSV 23: 관람석
                # CSV 24: 극장 로비? No, CSV 24 is "극장 로비".
                # Current TS: 25 is FOH (Foyer).
                # CSV 24 is Foyer.
                # Let's map 24->25_theater_foh.
                # What about 23? 23_theater_audience.
                # CSV 23 is Audience.
            
            if not id_key:
                id_key = f"profile_{prefix.replace('.', '_')}"

            # Mappings
            p = {
                "id": id_key,
                "name": raw_name,
                "usageHoursStart": parse_time(row[1]),
                "usageHoursEnd": parse_time(row[2]),
                "dailyUsageHours": clean_num(row[3]),
                "annualUsageDays": clean_num(row[4]),
                "usageHoursDay": clean_num(row[5]),
                "usageHoursNight": clean_num(row[6]),
                "hvacDailyOperationHours": clean_num(row[7]),
                "hvacAnnualOperationDays": clean_num(row[8]),
                # row[9] is Heating Daily. We use HVAC Daily for both for now or row[7].
                "illuminance": clean_num(row[10]),
                "workplaneHeight": clean_num(row[11]),
                "illuminanceDepreciationFactor": clean_num(row[12]),
                "lightingAbsenceFactor": clean_num(row[13]),
                "partialOperationFactorLighting": clean_num(row[15]),
                "heatingSetpoint": clean_num(row[16]),
                "coolingSetpoint": clean_num(row[17]),
                "heatingSetbackTemp": clean_num(row[18]),
                "heatingDesignMinTemp": clean_num(row[19]),
                "coolingDesignMaxTemp": clean_num(row[20]),
                "humidityRequirement": row[21],
                "minOutdoorAir": clean_num(row[22]),
                "minOutdoorAirFlow": clean_num(row[23]),
                "hvacAbsenceFactor": clean_num(row[24]),
                "hvacPartialOperationFactor": clean_num(row[25]),
                "metabolicHeat": clean_num(row[26]),
                "equipmentHeat": clean_num(row[27]),
            }
            profiles.append(p)

    # Generate TS Code
    print("export const DIN_18599_PROFILES: Record<string, UsageProfile> = {")
    for p in profiles:
        print(f'    "{p["id"]}": {{')
        print(f'        id: "{p["id"]}", name: "{p["name"]}",')
        print(f'        usageHoursStart: {p["usageHoursStart"]}, usageHoursEnd: {p["usageHoursEnd"]},')
        print(f'        dailyUsageHours: {p["dailyUsageHours"]}, annualUsageDays: {p["annualUsageDays"]},')
        print(f'        usageHoursDay: {p["usageHoursDay"]}, usageHoursNight: {p["usageHoursNight"]},')
        print(f'        hvacDailyOperationHours: {p["hvacDailyOperationHours"]}, hvacAnnualOperationDays: {p["hvacAnnualOperationDays"]},')
        print(f'        illuminance: {p["illuminance"]}, workplaneHeight: {p["workplaneHeight"]},')
        print(f'        illuminanceDepreciationFactor: {p["illuminanceDepreciationFactor"]}, lightingAbsenceFactor: {p["lightingAbsenceFactor"]},')
        print(f'        partialOperationFactorLighting: {p["partialOperationFactorLighting"]},')
        print(f'        heatingSetpoint: {p["heatingSetpoint"]}, coolingSetpoint: {p["coolingSetpoint"]},')
        print(f'        heatingSetbackTemp: {p["heatingSetbackTemp"]},')
        print(f'        heatingDesignMinTemp: {p["heatingDesignMinTemp"]}, coolingDesignMaxTemp: {p["coolingDesignMaxTemp"]},')
        print(f'        humidityRequirement: "{p["humidityRequirement"]}",')
        print(f'        minOutdoorAir: {p["minOutdoorAir"]}, minOutdoorAirFlow: {p["minOutdoorAirFlow"]},')
        print(f'        hvacAbsenceFactor: {p["hvacAbsenceFactor"]}, hvacPartialOperationFactor: {p["hvacPartialOperationFactor"]},')
        print(f'        metabolicHeat: {p["metabolicHeat"]}, equipmentHeat: {p["equipmentHeat"]}')
        print("    },")
    print("};")

if __name__ == "__main__":
    generate_ts()
