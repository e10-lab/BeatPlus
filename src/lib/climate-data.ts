
import stations from './stations.json';

export interface WeatherStation {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    monthlyTemp: number[];
    monthlySolar: number[];
    filename: string;
}

export const KOREA_WEATHER_STATIONS: WeatherStation[] = stations as WeatherStation[];
