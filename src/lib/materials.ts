import { Material } from "@/types/project";

export const DEFAULT_MATERIALS: Material[] = [
    // 1. General Construction Materials (건축 자재)
    // Metals (금속계)
    { id: "mat_copper", name: "동 (Copper)", category: "construction", thermalConductivity: 370, density: 8900, specificHeat: 385 },
    { id: "mat_bronze", name: "청동 (Bronze)", category: "construction", thermalConductivity: 25, density: 8600, specificHeat: 380 }, // Est Specific Heat
    { id: "mat_brass", name: "황동 (Brass)", category: "construction", thermalConductivity: 110, density: 8500, specificHeat: 380 }, // Est
    { id: "mat_alu", name: "알루미늄/합금 (Aluminum)", category: "construction", thermalConductivity: 200, density: 2700, specificHeat: 900 },
    { id: "mat_steel", name: "강재 (Steel)", category: "construction", thermalConductivity: 53, density: 7800, specificHeat: 450 },
    { id: "mat_lead", name: "납 (Lead)", category: "construction", thermalConductivity: 34, density: 11400, specificHeat: 130 },
    { id: "mat_steel_galv", name: "아연도철판 (Galv. Steel)", category: "construction", thermalConductivity: 44, density: 7860, specificHeat: 450 },
    { id: "mat_steel_sts", name: "스텐레스강 (Stainless Steel)", category: "construction", thermalConductivity: 15, density: 7400, specificHeat: 460 },

    // Concrete/Cement (시멘트/콘크리트)
    { id: "mat_mortar_1_3", name: "시멘트 모르타르 (1:3)", category: "construction", thermalConductivity: 1.4, density: 2000, specificHeat: 1000 },
    { id: "mat_conc_1_2_4", name: "콘크리트 (1:2:4)", category: "construction", thermalConductivity: 1.6, density: 2200, specificHeat: 1000 },
    { id: "mat_conc_aerated_04", name: "기포콘크리트 0.4품", category: "construction", thermalConductivity: 0.13, density: 350, specificHeat: 1000 },
    { id: "mat_conc_aerated_05", name: "기포콘크리트 0.5품", category: "construction", thermalConductivity: 0.16, density: 450, specificHeat: 1000 },
    { id: "mat_conc_aerated_06", name: "기포콘크리트 0.6품", category: "construction", thermalConductivity: 0.19, density: 600, specificHeat: 1000 },

    // Brick/Tile (벽돌/타일)
    { id: "mat_brick_cement", name: "시멘트 벽돌", category: "construction", thermalConductivity: 0.60, density: 1700, specificHeat: 1000 },
    { id: "mat_brick_fire", name: "내화 벽돌", category: "construction", thermalConductivity: 0.99, density: 1850, specificHeat: 1000 },
    { id: "mat_tile", name: "타일", category: "construction", thermalConductivity: 1.3, density: 2400, specificHeat: 840 },
    { id: "mat_block_conc_light", name: "콘크리트 블록 (경량)", category: "construction", thermalConductivity: 0.7, density: 870, specificHeat: 1000 },
    { id: "mat_block_conc_heavy", name: "콘크리트 블록 (중량)", category: "construction", thermalConductivity: 1.0, density: 1500, specificHeat: 1000 },

    // Stone (석재)
    { id: "mat_stone_marble", name: "대리석", category: "construction", thermalConductivity: 2.8, density: 2600, specificHeat: 1000 },
    { id: "mat_stone_granite", name: "화강암", category: "construction", thermalConductivity: 3.3, density: 2700, specificHeat: 1000 },
    { id: "mat_stone_slate", name: "천연슬레이트", category: "construction", thermalConductivity: 1.5, density: 2300, specificHeat: 1000 },

    // Wood (목재)
    { id: "mat_board_particle", name: "파티클보드", category: "construction", thermalConductivity: 0.15, density: 550, specificHeat: 1300 },
    { id: "mat_gypsum", name: "석고보드", category: "construction", thermalConductivity: 0.18, density: 750, specificHeat: 1090 },
    { id: "mat_wood_light", name: "목재 (경량)", category: "construction", thermalConductivity: 0.14, density: 400, specificHeat: 1600 },
    { id: "mat_wood_medium", name: "목재 (중량 - 보통)", category: "construction", thermalConductivity: 0.17, density: 500, specificHeat: 1600 },
    { id: "mat_wood_heavy", name: "목재 (고중량)", category: "construction", thermalConductivity: 0.19, density: 600, specificHeat: 1600 },

    // Flooring (바닥재)
    { id: "mat_floor_plastic", name: "바닥재 (플라스틱계)", category: "construction", thermalConductivity: 0.19, density: 1500, specificHeat: 1500 }, // Generic plastic heat
    { id: "mat_floor_asphalt", name: "바닥재 (아스팔트계)", category: "construction", thermalConductivity: 0.33, density: 1800, specificHeat: 1000 },

    // Waterproof/Wallpaper (방습/벽지)
    { id: "mat_pe_film", name: "PE 필름", category: "construction", thermalConductivity: 0.21, density: 700, specificHeat: 1500 }, // PE typically ~1500-2300 J/kgK
    { id: "mat_asphalt_felt", name: "아스팔트 펠트/루핑", category: "construction", thermalConductivity: 0.14, density: 700, specificHeat: 1000 }, // Avg
    { id: "mat_wallpaper_vinyl", name: "벽지 (비닐계)", category: "construction", thermalConductivity: 0.27, density: 800, specificHeat: 1200 }, // Est
    { id: "mat_wallpaper_paper", name: "벽지 (종이계)", category: "construction", thermalConductivity: 0.17, density: 700, specificHeat: 1200 },

    // 2. KS M ISO 4898 (Insulation - EPS, XPS, PUR, PF)
    // 2-1. EPS (Extended Polystyrene - 비드법)
    // Type I (1종)
    { id: "mat_eps_1_a1", name: "EPS 1종 A-1 (비드법)", category: "iso_4898", thermalConductivity: 0.033, density: 30, specificHeat: 1400 },
    { id: "mat_eps_1_a2", name: "EPS 1종 A-2 (비드법)", category: "iso_4898", thermalConductivity: 0.039, density: 25, specificHeat: 1400 },
    { id: "mat_eps_1_b", name: "EPS 1종 B (비드법)", category: "iso_4898", thermalConductivity: 0.043, density: 20, specificHeat: 1400 },
    { id: "mat_eps_1_c", name: "EPS 1종 C (비드법)", category: "iso_4898", thermalConductivity: 0.043, density: 15, specificHeat: 1400 },
    // Type II (2종)
    { id: "mat_eps_2_a1", name: "EPS 2종 A-1 (비드법)", category: "iso_4898", thermalConductivity: 0.032, density: 30, specificHeat: 1400 },
    { id: "mat_eps_2_a2", name: "EPS 2종 A-2 (비드법)", category: "iso_4898", thermalConductivity: 0.036, density: 25, specificHeat: 1400 },
    { id: "mat_eps_2_b", name: "EPS 2종 B (비드법)", category: "iso_4898", thermalConductivity: 0.039, density: 20, specificHeat: 1400 },
    // Type III (3종)
    { id: "mat_eps_3_a1", name: "EPS 3종 A-1 (비드법)", category: "iso_4898", thermalConductivity: 0.029, density: 30, specificHeat: 1400 },
    { id: "mat_eps_3_a2", name: "EPS 3종 A-2 (비드법)", category: "iso_4898", thermalConductivity: 0.031, density: 25, specificHeat: 1400 },
    { id: "mat_eps_3_b", name: "EPS 3종 B (비드법)", category: "iso_4898", thermalConductivity: 0.034, density: 20, specificHeat: 1400 },
    { id: "mat_eps_3_c", name: "EPS 3종 C (비드법)", category: "iso_4898", thermalConductivity: 0.039, density: 15, specificHeat: 1400 },

    // 2-2. XPS (Extruded Polystyrene - 압출법)
    // Type I (1종)
    { id: "mat_xps_1_a1", name: "XPS 1종 A-1 (압출법)", category: "iso_4898", thermalConductivity: 0.026, density: 35, specificHeat: 1450 },
    { id: "mat_xps_1_a2", name: "XPS 1종 A-2 (압출법)", category: "iso_4898", thermalConductivity: 0.029, density: 30, specificHeat: 1450 },
    // Type II (2종)
    { id: "mat_xps_2_a1", name: "XPS 2종 A-1 (압출법)", category: "iso_4898", thermalConductivity: 0.028, density: 35, specificHeat: 1450 },
    { id: "mat_xps_2_b1", name: "XPS 2종 B-1 (압출법)", category: "iso_4898", thermalConductivity: 0.026, density: 30, specificHeat: 1450 },
    { id: "mat_xps_2_b2", name: "XPS 2종 B-2 (압출법)", category: "iso_4898", thermalConductivity: 0.027, density: 25, specificHeat: 1450 },
    // Type III (3종)
    { id: "mat_xps_3_abc", name: "XPS 3종 A/B/C (압출법)", category: "iso_4898", thermalConductivity: 0.026, density: 35, specificHeat: 1450 },

    // 2-3. PUR (Polyurethane - 경질우레탄)
    // Type I (1종)
    { id: "mat_pur_1_ade", name: "PUR 1종 A/C/D/E (경질우레탄)", category: "iso_4898", thermalConductivity: 0.023, density: 35, specificHeat: 1400 }, // A:0.024, D/E:0.023. Using 0.023 conservative best or 0.024? D/E is 0.023. A is 0.024. Table shows A=0.024, B=0.029, C=0.024, D=0.023, E=0.023.
    // Let's list explicitly.
    { id: "mat_pur_1_ac", name: "PUR 1종 A/C (경질우레탄)", category: "iso_4898", thermalConductivity: 0.024, density: 35, specificHeat: 1400 },
    { id: "mat_pur_1_b", name: "PUR 1종 B (경질우레탄)", category: "iso_4898", thermalConductivity: 0.029, density: 30, specificHeat: 1400 },
    { id: "mat_pur_1_de", name: "PUR 1종 D/E (경질우레탄)", category: "iso_4898", thermalConductivity: 0.023, density: 40, specificHeat: 1400 },
    // Type II (2종)
    { id: "mat_pur_2_ab", name: "PUR 2종 A/B (경질우레탄)", category: "iso_4898", thermalConductivity: 0.023, density: 35, specificHeat: 1400 }, // A=0.023, B=0.024. Split?
    { id: "mat_pur_2_a", name: "PUR 2종 A (경질우레탄)", category: "iso_4898", thermalConductivity: 0.023, density: 35, specificHeat: 1400 },
    { id: "mat_pur_2_b", name: "PUR 2종 B (경질우레탄)", category: "iso_4898", thermalConductivity: 0.024, density: 30, specificHeat: 1400 },
    { id: "mat_pur_2_c", name: "PUR 2종 C (경질우레탄)", category: "iso_4898", thermalConductivity: 0.029, density: 25, specificHeat: 1400 },
    // Type III (3종)
    { id: "mat_pur_3_a", name: "PUR 3종 A (경질우레탄)", category: "iso_4898", thermalConductivity: 0.023, density: 35, specificHeat: 1400 },
    { id: "mat_pur_3_b", name: "PUR 3종 B (경질우레탄)", category: "iso_4898", thermalConductivity: 0.024, density: 30, specificHeat: 1400 },
    { id: "mat_pur_3_c", name: "PUR 3종 C (경질우레탄)", category: "iso_4898", thermalConductivity: 0.029, density: 25, specificHeat: 1400 },

    // 2-4. PF (Phenolic Foam - 페놀폼)
    // Type I (1종)
    { id: "mat_pf_1_acd", name: "PF 1종 A/C/D (페놀폼)", category: "iso_4898", thermalConductivity: 0.022, density: 35, specificHeat: 1400 },
    { id: "mat_pf_1_b", name: "PF 1종 B (페놀폼)", category: "iso_4898", thermalConductivity: 0.037, density: 30, specificHeat: 1400 },
    // Type II (2종)
    { id: "mat_pf_2_a", name: "PF 2종 A (페놀폼)", category: "iso_4898", thermalConductivity: 0.022, density: 35, specificHeat: 1400 },
    { id: "mat_pf_2_b", name: "PF 2종 B (페놀폼)", category: "iso_4898", thermalConductivity: 0.037, density: 30, specificHeat: 1400 },
    // Type III (3종)
    { id: "mat_pf_3_a", name: "PF 3종 A (페놀폼)", category: "iso_4898", thermalConductivity: 0.039, density: 35, specificHeat: 1400 },

    // 3. KS F 5660 (Polyester Sound Absorbing Insulation)
    { id: "mat_polyester_1", name: "폴리에스테르 흡음 단열재 1급", category: "f_5660", thermalConductivity: 0.034, density: 40, specificHeat: 1000 },
    { id: "mat_polyester_2", name: "폴리에스테르 흡음 단열재 2급", category: "f_5660", thermalConductivity: 0.040, density: 30, specificHeat: 1000 },
    { id: "mat_polyester_3", name: "폴리에스테르 흡음 단열재 3급", category: "f_5660", thermalConductivity: 0.045, density: 20, specificHeat: 1000 },

    // 4. KS M 3871-1 (Spray Medium Density Polyurethane Foam)
    // Type I (1종)
    { id: "mat_spray_pur_1_a", name: "분무식 중밀도 폴리우레탄 폼 1종 A", category: "m_3871_1", thermalConductivity: 0.022, density: 30, specificHeat: 1400 },
    { id: "mat_spray_pur_1_b", name: "분무식 중밀도 폴리우레탄 폼 1종 B", category: "m_3871_1", thermalConductivity: 0.032, density: 30, specificHeat: 1400 },
    { id: "mat_spray_pur_1_c", name: "분무식 중밀도 폴리우레탄 폼 1종 C", category: "m_3871_1", thermalConductivity: 0.040, density: 30, specificHeat: 1400 },
    // Type II (2종)
    { id: "mat_spray_pur_2_a", name: "분무식 중밀도 폴리우레탄 폼 2종 A", category: "m_3871_1", thermalConductivity: 0.022, density: 40, specificHeat: 1400 },
    { id: "mat_spray_pur_2_b", name: "분무식 중밀도 폴리우레탄 폼 2종 B", category: "m_3871_1", thermalConductivity: 0.032, density: 40, specificHeat: 1400 },

    // 5. KS L 9102 (Mineral/Glass Wool - 인조광물섬유단열재)
    // 5-1. Mineral Wool (미네랄울 - MW)
    { id: "mat_mw_board_1", name: "미네랄울 보온판 1호", category: "l_9102", thermalConductivity: 0.037, density: 80, specificHeat: 840 },
    { id: "mat_mw_board_2", name: "미네랄울 보온판 2호", category: "l_9102", thermalConductivity: 0.036, density: 100, specificHeat: 840 },
    { id: "mat_mw_board_3", name: "미네랄울 보온판 3호", category: "l_9102", thermalConductivity: 0.038, density: 120, specificHeat: 840 },
    { id: "mat_mw_felt", name: "미네랄울 펠트", category: "l_9102", thermalConductivity: 0.039, density: 60, specificHeat: 840 },
    { id: "mat_mw_blanket_1_a", name: "미네랄울 블랭킷 1호 a", category: "l_9102", thermalConductivity: 0.039, density: 40, specificHeat: 840 },
    { id: "mat_mw_blanket_1_b", name: "미네랄울 블랭킷 1호 b", category: "l_9102", thermalConductivity: 0.037, density: 60, specificHeat: 840 },
    { id: "mat_mw_blanket_2", name: "미네랄울 블랭킷 2호", category: "l_9102", thermalConductivity: 0.036, density: 80, specificHeat: 840 },

    // 5-2. Glass Wool (그라스울 - GW)
    { id: "mat_gw_24k", name: "그라스울 보온판 24K", category: "l_9102", thermalConductivity: 0.037, density: 24, specificHeat: 840 },
    { id: "mat_gw_32k", name: "그라스울 보온판 32K", category: "l_9102", thermalConductivity: 0.036, density: 32, specificHeat: 840 },
    { id: "mat_gw_40k", name: "그라스울 보온판 40K", category: "l_9102", thermalConductivity: 0.035, density: 40, specificHeat: 840 },
    { id: "mat_gw_48k", name: "그라스울 보온판 48K 이상 (48K~120K)", category: "l_9102", thermalConductivity: 0.034, density: 48, specificHeat: 840 },
    { id: "mat_gw_blanket_a", name: "그라스울 블랭킷 a", category: "l_9102", thermalConductivity: 0.040, density: 16, specificHeat: 840 },
    { id: "mat_gw_blanket_b", name: "그라스울 블랭킷 b", category: "l_9102", thermalConductivity: 0.036, density: 24, specificHeat: 840 },

    // 6. Window Materials
    { id: "mat_glass_std", name: "일반 유리 (General Glass)", category: "glass", thermalConductivity: 1.0, density: 2500, specificHeat: 750, defaultThickness: 0.006 },
    { id: "mat_glass_lowe", name: "로이 유리 (하드 코팅) (Low-E Hard)", category: "glass", thermalConductivity: 1.0, density: 2500, specificHeat: 750, defaultThickness: 0.006 },
    { id: "mat_glass_lowe_soft", name: "로이 유리 (소프트 코팅) (Low-E Soft)", category: "glass", thermalConductivity: 1.0, density: 2500, specificHeat: 750, defaultThickness: 0.006 },
    { id: "mat_gas_air", name: "공기 (Air)", category: "gas", thermalConductivity: 0.025, density: 1.2, specificHeat: 1000, defaultThickness: 0.012 },
    { id: "mat_gas_argon", name: "아르곤 (Argon)", category: "gas", thermalConductivity: 0.016, density: 1.7, specificHeat: 520, defaultThickness: 0.012 },

    // 7. Air Cavity
    { id: "mat_air_cavity", name: "중공층 (Air Cavity)", category: "air", thermalConductivity: 0.15, density: 1.2, specificHeat: 1000, defaultThickness: 0.05 },
    // 8. Door Materials (Special Types)
    { id: "door_gen_thin", name: "일반문 (단열 두께 20mm 미만) (General Door < 20mm)", category: "door", thermalConductivity: 0.2, density: 500, specificHeat: 1000, defaultThickness: 0.04 },
    { id: "door_gen_thick", name: "일반문 (단열 두께 20mm 이상) (General Door ≥ 20mm)", category: "door", thermalConductivity: 0.1, density: 500, specificHeat: 1000, defaultThickness: 0.04 },
    { id: "door_single_low_glass", name: "단창문 (유리비율 50% 미만) (Single Sash Door < 50% Glass)", category: "door", thermalConductivity: 5.0, density: 2500, specificHeat: 750, defaultThickness: 0.006 },
    { id: "door_single_high_glass", name: "단창문 (유리비율 50% 이상) (Single Sash Door ≥ 50% Glass)", category: "door", thermalConductivity: 5.0, density: 2500, specificHeat: 750, defaultThickness: 0.006 },
    { id: "door_double_low_glass", name: "복층창문 (유리비율 50% 미만) (Double Sash Door < 50% Glass)", category: "door", thermalConductivity: 3.0, density: 2500, specificHeat: 750, defaultThickness: 0.024 },
    { id: "door_double_high_glass", name: "복층창문 (유리비율 50% 이상) (Double Sash Door ≥ 50% Glass)", category: "door", thermalConductivity: 3.0, density: 2500, specificHeat: 750, defaultThickness: 0.024 },
];

export const CATEGORY_LABELS: Record<string, string> = {
    construction: "건축 자재 (General)",
    iso_4898: "KS M ISO 4898 (단열재)",
    f_5660: "KS F 5660 (단열재)",
    m_3871_1: "KS M 3871-1 (단열재)",
    l_9102: "KS L 9102 (단열재)",
    glass: "유리 (Glass)",
    gas: "문/창호 가스 (Gas)",
    air: "공기층 (Air)",
    door: "문 (Door Types)"
};

// Korean Energy Saving Design Standards - Table 5
export const SURFACE_HEAT_RESISTANCE = {
    // R_si (Internal) [m²K/W]
    R_SI: {
        WALL: 0.11, // General Wall
        ROOF: 0.086, // Ceiling/Roof
        FLOOR: 0.086, // Floor
        // Specific cases if needed later (e.g., window 0.13)
    },
    // R_se (External) [m²K/W]
    R_SE: {
        // Indirect Exposure (Outdoor Indirect)
        INDIRECT: {
            WALL: 0.11,
            ROOF: 0.086,
            FLOOR: 0.15,
        },
        // Direct Exposure (Outdoor Direct)
        DIRECT: 0.043,
        // Ground Contact
        GROUND: 0.0,
    }
};

export const FRAME_TYPES = [
    { id: "metal_no_break", name: "금속제 (열교차단재 미적용) (Metal - No Thermal Break)" },
    { id: "metal_break", name: "금속제 (열교차단재 적용) (Metal - Thermal Break)" },
    { id: "plastic_wood", name: "플라스틱 또는 목재 (Plastic/Wood)" }
];
