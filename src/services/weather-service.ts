import { KOREA_WEATHER_STATIONS, WeatherStation } from "@/lib/climate-data";

/**
 * Calculates the Haversine distance between two points in kilometers.
 */
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

export interface NearestStationResult {
    station: WeatherStation;
    distance: number; // km
}

/**
 * Finds the nearest weather station from the provided list.
 */
export function findNearestStation(lat: number, lng: number): NearestStationResult | null {
    if (!KOREA_WEATHER_STATIONS || KOREA_WEATHER_STATIONS.length === 0) {
        return null;
    }

    let minDistance = Infinity;
    let nearestStation: WeatherStation | null = null;

    for (const station of KOREA_WEATHER_STATIONS) {
        const distance = getDistanceFromLatLonInKm(lat, lng, station.latitude, station.longitude);
        if (distance < minDistance) {
            minDistance = distance;
            nearestStation = station;
        }
    }

    if (!nearestStation) return null;

    return {
        station: nearestStation,
        distance: minDistance
    };
}
