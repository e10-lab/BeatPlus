"use client";

import { useEffect, useState } from "react";
import { ClimateData } from "@/engine/types";
import { loadClimateData, getClimateData } from "@/engine/climate-data";
import { getProject } from "@/services/project-service";
import { Loader2 } from "lucide-react";
import { ClimateAnalysisView } from "./climate-analysis-view";

interface ClimateViewProps {
    projectId: string;
}

export function ClimateView({ projectId }: ClimateViewProps) {
    const [loading, setLoading] = useState(true);
    const [weatherData, setWeatherData] = useState<ClimateData | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Project for Weather Station (or location)
                const project = await getProject(projectId);

                // 2. Load Weather Data
                let loadedWeatherData: ClimateData | undefined;
                if (project?.weatherStationId) {
                    try {
                        loadedWeatherData = await loadClimateData(project.weatherStationId);
                    } catch (e) {
                        console.warn("Failed to load weather data, using default", e);
                    }
                }

                // Fallback to default if missing
                if (!loadedWeatherData) {
                    loadedWeatherData = getClimateData();
                }
                setWeatherData(loadedWeatherData);

            } catch (error) {
                console.error("Failed to load climate data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [projectId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2">기후 데이터 로딩 중...</span>
            </div>
        );
    }

    if (!weatherData) {
        return <div className="p-8 text-center text-muted-foreground">기상 데이터를 로드할 수 없습니다.</div>;
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg mb-6">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">기후 분석 (Climate Analysis)</h2>
                    <p className="text-sm text-muted-foreground">표준 기상 데이터(EPW) 상세 분석 및 시각화</p>
                </div>
            </div>
            <ClimateAnalysisView weatherData={weatherData} />
        </div>
    );
}
