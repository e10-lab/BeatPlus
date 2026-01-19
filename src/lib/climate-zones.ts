export type ClimateZone = "Central 1" | "Central 2" | "Southern" | "Jeju";

export function determineClimateZone(sido: string, sigungu: string): ClimateZone {
    // 4) 제주도
    if (sido.includes("제주")) {
        return "Jeju";
    }

    // 1) 중부1지역
    // 강원특별자치도(고성, 속초, 양양, 강릉, 동해, 삼척 제외) - 즉, 이들 제외한 나머지 강원도
    if (sido.includes("강원")) {
        const excludedGangwon = ["고성", "속초", "양양", "강릉", "동해", "삼척"];
        if (!excludedGangwon.some(area => sigungu.includes(area))) {
            return "Central 1";
        }
    }

    // 경기도(연천, 포천, 가평, 남양주, 의정부, 양주, 동두천, 파주)
    if (sido.includes("경기")) {
        const central1Gyeonggi = ["연천", "포천", "가평", "남양주", "의정부", "양주", "동두천", "파주"];
        if (central1Gyeonggi.some(area => sigungu.includes(area))) {
            return "Central 1";
        }
    }

    // 충청북도(제천)
    if (sido.includes("충청북도") || sido.includes("충북")) {
        if (sigungu.includes("제천")) {
            return "Central 1";
        }
    }

    // 경상북도(봉화, 청송)
    if (sido.includes("경상북도") || sido.includes("경북")) {
        if (sigungu.includes("봉화") || sigungu.includes("청송")) {
            return "Central 1";
        }
    }

    // 2) 중부2지역 Logic (Exceptions handled above or below)
    // 서울, 대전, 세종, 인천 -> 중부2
    if (sido.includes("서울") || sido.includes("대전") || sido.includes("세종") || sido.includes("인천")) {
        return "Central 2";
    }

    // 강원 (고성, 속초, 양양, 강릉, 동해, 삼척) -> 위에서 Central 1 아니면 여기
    if (sido.includes("강원")) {
        return "Central 2";
    }

    // 경기도 (Central 1 제외한 나머지)
    if (sido.includes("경기")) {
        return "Central 2";
    }

    // 충청북도 (제천 제외)
    if (sido.includes("충청북도") || sido.includes("충북")) {
        return "Central 2";
    }

    // 충청남도 -> 중부2
    if (sido.includes("충청남도") || sido.includes("충남")) {
        return "Central 2";
    }

    // 전북특별자치도 -> 중부2
    if (sido.includes("전북") || sido.includes("전라북도")) {
        return "Central 2";
    }

    // 경상남도 (거창, 함양)
    if (sido.includes("경상남도") || sido.includes("경남")) {
        if (sigungu.includes("거창") || sigungu.includes("함양")) {
            return "Central 2";
        }
    }

    // 대구광역시 (군위)
    if (sido.includes("대구")) {
        if (sigungu.includes("군위")) {
            return "Central 2";
        }
    }

    // 경상북도 (Central 1 제외 and Southern 제외)
    // Southern Gyeongbuk: 울진, 영덕, 포항, 경주, 청도, 경산
    if (sido.includes("경상북도") || sido.includes("경북")) {
        const southernGyeongbuk = ["울진", "영덕", "포항", "경주", "청도", "경산"];
        if (!southernGyeongbuk.some(area => sigungu.includes(area))) {
            // Already checked Bonghwa/Cheongsong for Central 1. If not those, and not Southern, it's Central 2.
            return "Central 2";
        }
    }


    // 3) 남부지역
    // 부산, 울산, 광주, 전라남도
    if (sido.includes("부산") || sido.includes("울산") || sido.includes("광주") || sido.includes("전라남도") || sido.includes("전남")) {
        return "Southern";
    }

    // 대구 (군위 제외) -> Others are Southern
    if (sido.includes("대구")) {
        return "Southern";
    }

    // 경상북도 (울진, 영덕, 포항, 경주, 청도, 경산)
    if (sido.includes("경상북도") || sido.includes("경북")) {
        return "Southern";
    }

    // 경상남도 (거창, 함양 제외) -> Others are Southern
    if (sido.includes("경상남도") || sido.includes("경남")) {
        return "Southern";
    }

    // Default fallback (Safe to assume Central 2 or ask user? Defaulting to Central 2 as it covers most mid-latitude)
    return "Central 2";
}
