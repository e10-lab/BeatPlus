"use client";

import { useEffect, useState } from "react";
import { ZoneInput, CalculationResults, ClimateData } from "@/engine/types";
import { calculateEnergyDemand } from "@/engine/calculator";
import { loadClimateData } from "@/engine/climate-data";
import { getProject } from "@/services/project-service";
import { getZones } from "@/services/zone-service";
import { getSurfaces } from "@/services/surface-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Zone } from "@/types/project";
import { MonthlyDemandChart } from "./monthly-demand-chart";
import { EnergyBalanceChart } from "./energy-balance-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ResultsViewProps {
    projectId: string;
    isActive?: boolean;
}

export function ResultsView({ projectId, isActive = true }: ResultsViewProps) {
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<CalculationResults | null>(null);
    const [selectedZoneId, setSelectedZoneId] = useState<string>("total");

    useEffect(() => {
        if (!isActive) return; // Skip if not active tab

        const loadDataAndCalculate = async () => {
            setLoading(true);
            try {
                // 1. Fetch Project for Weather Station
                const project = await getProject(projectId);

                // 2. Fetch Zones
                const zones = await getZones(projectId);

                // 3. Fetch Surfaces for each Zone and build ZoneInput
                const zoneInputs: ZoneInput[] = await Promise.all(
                    zones.map(async (zone: Zone) => {
                        const surfaces = await getSurfaces(projectId, zone.id!);
                        return {
                            ...zone,
                            projectId: projectId,
                            surfaces: surfaces
                        } as ZoneInput;
                    })
                );

                // 4. Load Weather Data
                let weatherData: ClimateData | undefined;
                if (project?.weatherStationId) {
                    try {
                        weatherData = await loadClimateData(project.weatherStationId);
                    } catch (e) {
                        console.warn("Failed to load weather data, using default", e);
                    }
                }

                // 5. Run Calculation
                const calcResults = calculateEnergyDemand(
                    zoneInputs,
                    weatherData,
                    project?.mainStructure,
                    project?.ventilationConfig,
                    project?.ventilationUnits // Pass detailed units for zone-specific lookup
                );
                setResults(calcResults);

            } catch (error) {
                console.error("Calculation failed:", error);
            } finally {
                setLoading(false);
            }
        };

        loadDataAndCalculate();
    }, [projectId, isActive]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2">계산 중...</span>
            </div>
        );
    }

    if (!results) {
        return <div>결과를 불러올 수 없습니다.</div>;
    }

    // Determine data to show based on selection
    const isTotal = selectedZoneId === "total";
    const currentZone = !isTotal ? results.zones.find(z => z.zoneId === selectedZoneId) : null;

    // Safety check
    const monthlyData = isTotal ? results.monthly : (currentZone?.monthly || []);
    const yearlyData = isTotal ? results.yearly : (currentZone?.yearly || {
        heatingDemand: 0, coolingDemand: 0, totalArea: 0, specificHeatingDemand: 0, specificCoolingDemand: 0
    });

    const viewTitle = isTotal ? "월별 데이터 상세 (전체)" : `월별 데이터 상세 (${currentZone?.zoneName || selectedZoneId})`;


    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Zone Selector */}
            <div className="flex justify-end">
                <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                    <SelectTrigger className="w-[200px] bg-background">
                        <SelectValue placeholder="결과 범위 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="total">전체 건물 (Total)</SelectItem>
                        {results.zones.map(z => (
                            <SelectItem key={z.zoneId} value={z.zoneId}>{z.zoneName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">단위 난방 소요량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {yearlyData.specificHeatingDemand.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kWh/m²a</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">총 난방 소요량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {yearlyData.heatingDemand.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">kWh/a</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">단위 냉방 소요량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {yearlyData.specificCoolingDemand.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kWh/m²a</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">총 냉방 소요량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {yearlyData.coolingDemand.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">kWh/a</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Warnings Alert - Show only if relevant to current view */}
            {monthlyData.some(m => m.warnings && m.warnings.length > 0) && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">환기량 부족 알림</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>다음 존에서 필요한 환기량을 충족하지 못하고 있습니다. (창문 또는 공조 설비 확인 필요)</p>
                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                    {Array.from(new Set(monthlyData.flatMap(m => m.warnings || []))).map((w, i) => (
                                        <li key={i}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 차트 영역 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MonthlyDemandChart data={monthlyData} totalArea={yearlyData.totalArea} />
                <EnergyBalanceChart data={monthlyData} totalArea={yearlyData.totalArea} />
            </div>

            {/* 월별 데이터 테이블 */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {viewTitle}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end mb-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-3">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span>손실 (Loss)</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span>획득 (Gain)</span>
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                <tr>
                                    <th className="px-4 py-2">월</th>
                                    <th className="px-4 py-2">외기온도 (°C)</th>
                                    <th className="px-4 py-2">사용일 온도 (°C)</th>
                                    <th className="px-4 py-2">승온/저감 온도 (°C)</th>
                                    <th className="px-4 py-2">전도열 (kWh/m²)</th>
                                    <th className="px-4 py-2">환기열 (kWh/m²)</th>
                                    <th className="px-4 py-2">태양열획득 (kWh/m²)</th>
                                    <th className="px-4 py-2">내부발열 (kWh/m²)</th>
                                    <th className="px-4 py-2 text-red-600">난방요구량 (kWh/m²)</th>
                                    <th className="px-4 py-2 text-blue-600">냉방요구량 (kWh/m²)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyData.map((m: any) => {
                                    const area = yearlyData.totalArea > 0 ? yearlyData.totalArea : 1;
                                    return (
                                        <tr key={m.month} className="border-b">
                                            <td className="px-4 py-2 font-medium">{m.month}월</td>
                                            <td className="px-4 py-2">{m.outdoorTemp?.toFixed(1) ?? "-"}</td>
                                            <td className="px-4 py-2">{m.indoorTempUsage?.toFixed(1) ?? "-"}</td>
                                            <td className="px-4 py-2 text-gray-500">{m.indoorTempNonUsage?.toFixed(1) ?? "-"}</td>
                                            <td className={`px-4 py-2 ${m.QT > 0 ? "text-blue-600" : "text-red-600"}`}>{(Math.abs(m.QT) / area).toFixed(1)}</td>
                                            <td className={`px-4 py-2 ${m.QV > 0 ? "text-blue-600" : "text-red-600"}`}>{(Math.abs(m.QV) / area).toFixed(1)}</td>
                                            <td className="px-4 py-2 text-red-600">{(m.QS / area).toFixed(1)}</td>
                                            <td className="px-4 py-2 text-red-600">{(m.QI / area).toFixed(1)}</td>
                                            <td className="px-4 py-2 font-bold text-red-700">{(m.Q_heating / area).toFixed(1)}</td>
                                            <td className="px-4 py-2 font-bold text-blue-700">{(m.Q_cooling / area).toFixed(1)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
