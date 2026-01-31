"use client";

import { useEffect, useState } from "react";
import { ZoneInput, CalculationResults, ClimateData, MonthlyResult, ZoneResult } from "@/engine/types";
import { calculateEnergyDemand } from "@/engine/calculator";
import { loadClimateData } from "@/engine/climate-data";
import { getProject } from "@/services/project-service";
import { getZones } from "@/services/zone-service";
import { getSurfaces } from "@/services/surface-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Zap, Leaf, Factory, Sun } from "lucide-react";
import { Zone } from "@/types/project";
import { MonthlyDemandChart } from "./monthly-demand-chart";
import { EnergyBalanceChart } from "./energy-balance-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HourlyAnalysisView } from "./hourly-analysis-view";


interface ResultsViewProps {
    projectId: string;
    isActive?: boolean;
}

export function ResultsView({ projectId, isActive = true }: ResultsViewProps) {
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<CalculationResults | null>(null);
    const [weatherData, setWeatherData] = useState<ClimateData | null>(null);
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
                let loadedWeatherData: ClimateData | undefined;
                if (project?.weatherStationId) {
                    try {
                        loadedWeatherData = await loadClimateData(project.weatherStationId);
                    } catch (e) {
                        console.warn("Failed to load weather data, using default", e);
                    }
                }

                // If not loaded, use default Seoul data (implied by undefined in calculator, but we need it for viz)
                if (!loadedWeatherData) {
                    // We need to import getClimateData or rely on calculator's default.
                    // Let's explicitly load default if missing so we can visualize it.
                    const { getClimateData } = await import("@/engine/climate-data");
                    loadedWeatherData = getClimateData();
                }
                setWeatherData(loadedWeatherData);

                // 5. Run Calculation
                const calcResults = calculateEnergyDemand(
                    zoneInputs,
                    loadedWeatherData,
                    project?.mainStructure,
                    project?.ventilationConfig,
                    project?.ventilationUnits,
                    project?.automationConfig,
                    project?.systems // Use systems from project
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
    const currentZone = !isTotal ? results.zones.find((z: ZoneResult) => z.zoneId === selectedZoneId) : null;

    // Safety check
    const monthlyData = isTotal ? results.monthly : (currentZone?.monthly || []);
    const yearlyData = isTotal ? results.yearly : (currentZone?.yearly || {
        heatingDemand: 0, coolingDemand: 0, totalArea: 0, specificHeatingDemand: 0, specificCoolingDemand: 0,
        dhwDemand: 0, lightingDemand: 0, auxDemand: 0, pvGeneration: 0, selfConsumption: 0, pvExport: 0,
        finalEnergy: { heating: 0, cooling: 0, dhw: 0, lighting: 0, auxiliary: 0 },
        primaryEnergy: { heating: 0, cooling: 0, dhw: 0, lighting: 0, auxiliary: 0, total: 0 }
    });

    const viewTitle = isTotal ? "월별 데이터 상세 (전체)" : `월별 데이터 상세 (${currentZone?.zoneName || selectedZoneId})`;
    const area = yearlyData.totalArea > 0 ? yearlyData.totalArea : 1;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Zone Selector */}
            <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">에너지 해석 결과 (DIN/TS 18599:2025-10)</h2>
                    <p className="text-sm text-muted-foreground">최신 표준 기반 5R1C 시간별 시뮬레이션 및 1차 에너지 산출</p>
                </div>
                <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                    <SelectTrigger className="w-[240px] bg-background">
                        <SelectValue placeholder="결과 범위 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="total">전체 건물 (Total)</SelectItem>
                        {results.zones.map((z: ZoneResult) => (
                            <SelectItem key={z.zoneId} value={z.zoneId}>{z.zoneName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 1차 에너지 및 탄소 배출량 요약 (전체 보기일 때만 표시 권장) */}
            {isTotal && yearlyData.primaryEnergy && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="bg-slate-900 text-white border-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <Factory className="h-4 w-4" /> 1차 에너지 소요량 (Primary Energy)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {yearlyData.primaryEnergy.total.toFixed(0)} <span className="text-lg font-normal text-slate-400">kWh/a</span>
                            </div>
                            <div className="text-sm text-slate-400 mt-1">
                                {(yearlyData.primaryEnergy.total / area).toFixed(1)} kWh/m²a
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-900 text-white border-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-emerald-300 flex items-center gap-2">
                                <Leaf className="h-4 w-4" /> 탄소 배출량 (CO2 Emissions)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {yearlyData.co2Emissions?.toFixed(0) ?? 0} <span className="text-lg font-normal text-emerald-400">kg/a</span>
                            </div>
                            <div className="text-sm text-emerald-400 mt-1">
                                {(yearlyData.co2Emissions || 0 / area).toFixed(1)} kg/m²a
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-900 text-white border-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-amber-300 flex items-center gap-2">
                                <Sun className="h-4 w-4" /> 신재생 발전량 (PV Generation)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {yearlyData.pvGeneration.toFixed(0)} <span className="text-lg font-normal text-amber-400">kWh/a</span>
                            </div>
                            <div className="text-sm text-amber-400 mt-1">
                                자가소비 {(yearlyData.selfConsumption / (yearlyData.pvGeneration || 1) * 100).toFixed(0)}%
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}


            {/* 소요량 요약 카드 */}
            <h3 className="text-md font-semibold mt-4">부하 및 소요량 상세</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <SummaryCard title="난방 부하 (Heating Load)" value={yearlyData.heatingDemand} unit="kWh/a" subValue={yearlyData.specificHeatingDemand} subUnit="kWh/m²a" />
                <SummaryCard title="냉방 부하 (Cooling Load)" value={yearlyData.coolingDemand} unit="kWh/a" subValue={yearlyData.specificCoolingDemand} subUnit="kWh/m²a" />
                <SummaryCard title="급탕 부하 (DHW Load)" value={yearlyData.dhwDemand} unit="kWh/a" subValue={yearlyData.dhwDemand / area} subUnit="kWh/m²a" />
                <SummaryCard title="조명 부하 (Lighting Load)" value={yearlyData.lightingDemand} unit="kWh/a" subValue={yearlyData.lightingDemand / area} subUnit="kWh/m²a" />
                <SummaryCard title="보조 에너지 (Auxiliary)" value={yearlyData.auxDemand} unit="kWh/a" subValue={yearlyData.auxDemand / area} subUnit="kWh/m²a" />

                {isTotal && yearlyData.finalEnergy && (
                    <>
                        <Card className="col-span-1 bg-muted/30">
                            <CardHeader className="p-3 pb-1">
                                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" />최종 에너지 (Final)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-1">
                                <div className="text-lg font-bold">
                                    {((yearlyData.finalEnergy.heating + yearlyData.finalEnergy.cooling + yearlyData.finalEnergy.dhw + yearlyData.finalEnergy.lighting + yearlyData.finalEnergy.auxiliary) / 1000).toFixed(1)} <span className="text-xs font-normal text-muted-foreground">MWh</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="col-span-1 bg-muted/30">
                            <CardHeader className="p-3 pb-1">
                                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Factory className="h-3 w-3" />1차 에너지 (Primary)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-1">
                                <div className="text-lg font-bold">
                                    {(yearlyData.primaryEnergy?.total || 0 / 1000).toFixed(1)} <span className="text-xs font-normal text-muted-foreground">MWh</span>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            <Tabs defaultValue="monthly" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="monthly" className="gap-2"><Leaf className="h-4 w-4" /> 월별 분석 (Monthly)</TabsTrigger>
                    <TabsTrigger value="hourly" className="gap-2"><Zap className="h-4 w-4" /> 시간별 상세 (Hourly)</TabsTrigger>
                </TabsList>

                <TabsContent value="monthly" className="space-y-6">
                    {/* Warnings Alert - Show only if relevant to current view */}
                    {monthlyData.some((m: MonthlyResult) => m.warnings && m.warnings.length > 0) && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">주의 알림</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                        <ul className="list-disc pl-5 mt-1 space-y-1">
                                            {Array.from(new Set(monthlyData.flatMap((m: MonthlyResult) => m.warnings || []))).map((w, i) => (
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
                            <CardDescription>
                                단위 면적당 에너지 요구량 (kWh/m²)
                            </CardDescription>
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
                                            <th className="px-4 py-2">실내온도 (°C)</th>
                                            <th className="px-4 py-2">전도열</th>
                                            <th className="px-4 py-2">환기열</th>
                                            <th className="px-4 py-2">태양열</th>
                                            <th className="px-4 py-2">내부발열</th>
                                            <th className="px-4 py-2 text-orange-600">급탕</th>
                                            <th className="px-4 py-2 text-red-600">난방</th>
                                            <th className="px-4 py-2 text-blue-600">냉방</th>
                                            <th className="px-4 py-2 text-purple-600">보조</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthlyData.map((m: MonthlyResult) => {
                                            const area = yearlyData.totalArea > 0 ? yearlyData.totalArea : 1;
                                            return (
                                                <tr key={m.month} className="border-b hover:bg-muted/10 transition-colors">
                                                    <td className="px-4 py-2 font-medium">{m.month}월</td>
                                                    <td className="px-4 py-2">{m.avg_Ti?.toFixed(1) ?? "-"}</td>
                                                    <td className={`px-4 py-2 ${m.QT > 0 ? "text-blue-600" : "text-gray-600"}`}>{(Math.abs(m.QT) / area).toFixed(1)}</td>
                                                    <td className={`px-4 py-2 ${m.QV > 0 ? "text-blue-600" : "text-gray-600"}`}>{(Math.abs(m.QV) / area).toFixed(1)}</td>
                                                    <td className="px-4 py-2 text-gray-600">{(m.QS / area).toFixed(1)}</td>
                                                    <td className="px-4 py-2 text-gray-600">{(m.QI / area).toFixed(1)}</td>
                                                    <td className="px-4 py-2 font-bold text-orange-600">{(m.Q_dhw / area).toFixed(1)}</td>
                                                    <td className="px-4 py-2 font-bold text-red-700">{(m.Q_heating / area).toFixed(1)}</td>
                                                    <td className="px-4 py-2 font-bold text-blue-700">{(m.Q_cooling / area).toFixed(1)}</td>
                                                    <td className="px-4 py-2 font-bold text-purple-700">{(m.Q_aux / area).toFixed(1)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="hourly">
                    <HourlyAnalysisView zones={results.zones} selectedZoneId={selectedZoneId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function SummaryCard({ title, value, unit, subValue, subUnit }: { title: string, value: number, unit: string, subValue?: number, subUnit?: string }) {
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold">
                    {value.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                </div>
                {subValue !== undefined && (
                    <div className="text-xs text-muted-foreground mt-1">
                        {subValue.toFixed(1)} {subUnit}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
