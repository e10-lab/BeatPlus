"use client";

import { useEffect, useState } from "react";
import { ZoneInput, CalculationResults, ClimateData, MonthlyResult, ZoneResult } from "@/engine/types";
import { calculateEnergyDemand } from "@/engine/calculator";
import { loadClimateData } from "@/engine/climate-data";
import { getProject } from "@/services/project-service";
import { getZones } from "@/services/zone-service";
import { getSurfaces } from "@/services/surface-service";
import { getConstructions } from "@/services/construction-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Zap, Leaf, Factory, Sun } from "lucide-react";
import { Zone, Construction } from "@/types/project";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthlyDemandChart } from "./monthly-demand-chart";

import { EnergyBalanceChart } from "./energy-balance-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface ResultsViewProps {
    projectId: string;
    isActive?: boolean;
}

export function ResultsView({ projectId, isActive = true }: ResultsViewProps) {
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<CalculationResults | null>(null);
    const [weatherData, setWeatherData] = useState<ClimateData | null>(null);
    const [selectedZoneId, setSelectedZoneId] = useState<string>("total");
    const [constructions, setConstructions] = useState<Construction[]>([]);

    useEffect(() => {
        if (!isActive) return; // Skip if not active tab

        const loadDataAndCalculate = async () => {
            setLoading(true);
            try {
                // 1. Fetch Project for Weather Station
                const project = await getProject(projectId);

                // 2. Fetch Zones & Constructions
                const [allZones, fetchedConstructions] = await Promise.all([
                    getZones(projectId),
                    getConstructions(projectId)
                ]);
                setConstructions(fetchedConstructions);

                // Deduplicate zones by id just in case
                const uniqueZones = Array.from(new Map(allZones.map(z => [z.id, z])).values());

                // 3. Fetch Surfaces for each Zone and build ZoneInput
                const zoneInputs: ZoneInput[] = await Promise.all(
                    uniqueZones.map(async (zone: Zone) => {
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

                // 5. Run Calculation (Monthly Method)
                const calcResults = calculateEnergyDemand(
                    zoneInputs,
                    loadedWeatherData,
                    project?.mainStructure,
                    project?.ventilationConfig,
                    project?.ventilationUnits,
                    project?.automationConfig,
                    project?.systems, // Use systems from project
                    fetchedConstructions,
                    "monthly" // Explicitly Monthly
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

    // [New] Energy Demand Verification CSV
    const downloadEnergyDemandVerificationCSV = () => {
        if (!results) return;

        let csv = "\uFEFFEnergy Demand Verification (DIN/TS 18599-2:2025-10)\n";
        // Header
        csv += "Zone,Month,Days_Op,Days_NonOp,Te_avg (C),Ti_op (C),Ti_nonOp (C),H_tr (W/K),H_ve (W/K),QT_op (kWh),QV_op (kWh),QS_op (kWh),QI_op (kWh),QT_nonOp (kWh),QV_nonOp (kWh),QS_nonOp (kWh),QI_nonOp (kWh),Q_Storage_Transfer (kWh),Delta_Q_C_b_we (kWh),eta_H,gamma_H,Qh_need (kWh),eta_C,gamma_C,Qc_need (kWh)\n";

        results.zones.forEach(z => {
            z.monthly.forEach(m => {
                const Te = weatherData?.monthly.find(w => w.month === m.month)?.Te || 0;
                csv += `"${z.zoneName}",${m.month},${(m.d_nutz || 0).toFixed(1)},${(m.d_we || 0).toFixed(1)},${Te.toFixed(2)}`;
                csv += `,${(m.avg_Ti_op || 0).toFixed(2)},${(m.avg_Ti_non_op || 0).toFixed(2)}`;
                csv += `,${(m.H_tr || 0).toFixed(1)},${(m.H_ve || 0).toFixed(1)}`;
                csv += `,${(m.QT_op || 0).toFixed(2)},${(m.QV_op || 0).toFixed(2)},${(m.QS_op || 0).toFixed(2)},${(m.QI_op || 0).toFixed(2)}`;
                csv += `,${(m.QT_non_op || 0).toFixed(2)},${(m.QV_non_op || 0).toFixed(2)},${(m.QS_non_op || 0).toFixed(2)},${(m.QI_non_op || 0).toFixed(2)}`;
                csv += `,${(m.Q_storage_transfer || 0).toFixed(3)},${(m.Delta_Q_C_b_we || 0).toFixed(3)}`;
                csv += `,${(m.eta || 0).toFixed(4)},${(m.gamma || 0).toFixed(4)},${(m.Q_heating || 0).toFixed(2)}`;
                csv += `,${(m.eta_C || 0).toFixed(4)},${(m.gamma_C || 0).toFixed(4)},${(m.Q_cooling || 0).toFixed(2)}`;
                csv += "\n";
            });
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `energy_demand_verification_${projectId}.csv`;
        a.click();
    };

    // [New] Time Constant Analysis CSV (Consolidated Verification)
    const downloadTimeConstantCSV = () => {
        if (!results) return;

        let csv = "\uFEFFTime Constant Analysis (DIN 18599-2)\n";
        // Header
        csv += "Zone,Month,Te_avg (C),Theta_int_H (C),Theta_i_h (C),Theta_i_op (C),Theta_i_non_op (C),tau_h (h),tau_c (h),Cm (Wh/K),H_tr (W/K),V_net (m3),n_nutz (1/h),n_inf (1/h),n_win (1/h),n_mech (1/h),n_win_min (1/h),Delta_n_win,Delta_n_win_mech,n_SUP (1/h),n_ETA (1/h),t_v_mech (h),eta_WRG,isForcedMech,H_ve_inf (W/K),H_ve_win (W/K),H_ve_mech (W/K),H_ve (W/K),H_tot (W/K),H_tot_tau_h (W/K),H_tot_tau_c (W/K),a_H,eta_H,gamma_H,f_adapt,f_NA,f_we,Theta_int_C (C),a_C,eta_C,gamma_C,t_h_op_d (h/d),t_NA (h/d),Delta_theta_i_NA (K),delta_theta_EMS (K)\n";

        const RHO_C = 0.34; // ρ·c [Wh/(m³·K)]

        results.zones.forEach(z => {
            z.monthly.forEach(m => {
                const Te = weatherData?.monthly.find(w => w.month === m.month)?.Te || 0;

                // H_tot_tau 역산: tau = Cm / H_tot_tau -> H_tot_tau = Cm / tau
                const tau_h_val = m.tau_h || m.tau || 0;
                const tau_c_val = m.tau_c || m.tau || 0;
                const Cm_val = m.Cm || 0;
                const H_tot_tau_h = tau_h_val > 0 ? Cm_val / tau_h_val : 0;
                const H_tot_tau_c = tau_c_val > 0 ? Cm_val / tau_c_val : 0;

                // 이용효율 계수 a = 1 + tau/16 (Updated to match calculator.ts)
                const a_H = m.a_H || (1 + tau_h_val / 16);
                const a_C = m.a_C || (1 + tau_c_val / 16);

                // H_ve 세분화: H = V · ρc · n
                const V = m.V_net || 0;
                const n_inf = m.n_inf || 0;
                const n_win = m.n_win || 0;
                const n_mech = m.n_mech || 0;
                const H_ve_inf = V * RHO_C * n_inf;
                const H_ve_win = V * RHO_C * n_win;
                const H_ve_mech = V * RHO_C * n_mech;

                csv += `"${z.zoneName}",${m.month},${Te.toFixed(2)}`;
                csv += `,${(m.Theta_int_H || 0).toFixed(2)}`;
                csv += `,${(m.Theta_i_h || 0).toFixed(2)}`;
                csv += `,${(m.avg_Ti_op || m.avg_Ti || 0).toFixed(2)}`;
                csv += `,${(m.avg_Ti_non_op || 0).toFixed(2)}`;
                csv += `,${tau_h_val.toFixed(1)}`;
                csv += `,${tau_c_val.toFixed(1)}`;
                csv += `,${Cm_val.toFixed(0)}`;
                csv += `,${(m.H_tr || 0).toFixed(1)}`;
                csv += `,${V.toFixed(1)}`;
                csv += `,${(m.n_nutz || 0).toFixed(4)}`;
                csv += `,${n_inf.toFixed(4)}`;
                csv += `,${n_win.toFixed(4)}`;
                csv += `,${n_mech.toFixed(4)}`;
                csv += `,${(m.n_win_min || 0).toFixed(4)}`;
                csv += `,${(m.Delta_n_win || 0).toFixed(4)}`;
                csv += `,${(m.Delta_n_win_mech || 0).toFixed(4)}`;
                csv += `,${(m.n_SUP || 0).toFixed(4)}`;
                csv += `,${(m.n_ETA || 0).toFixed(4)}`;
                csv += `,${(m.t_v_mech || 0).toFixed(1)}`;
                csv += `,${(m.heatRecoveryEff || 0).toFixed(2)}`;
                csv += `,${(m as any).isForcedMech ?? ''}`;
                csv += `,${H_ve_inf.toFixed(2)}`;
                csv += `,${H_ve_win.toFixed(2)}`;
                csv += `,${H_ve_mech.toFixed(2)}`;
                csv += `,${(m.H_ve || 0).toFixed(1)}`;
                csv += `,${(m.H_tot || 0).toFixed(1)}`;
                csv += `,${H_tot_tau_h.toFixed(1)}`;
                csv += `,${H_tot_tau_c.toFixed(1)}`;
                csv += `,${a_H.toFixed(2)}`;
                csv += `,${(m.eta || 0).toFixed(4)}`;
                csv += `,${(m.gamma || 0).toFixed(4)}`;
                csv += `,${(m.f_adapt || 0).toFixed(2)}`;
                csv += `,${(m.f_NA || 0).toFixed(6)}`;
                csv += `,${(m.f_we || 0).toFixed(6)}`;
                csv += `,${(m.Theta_int_C || 0).toFixed(2)}`;
                csv += `,${a_C.toFixed(2)}`;
                csv += `,${(m.eta_C ?? 0).toFixed(4)}`;
                csv += `,${(m.gamma_C || 0).toFixed(4)}`;
                csv += `,${(m.t_h_op_d || 0).toFixed(1)}`;
                csv += `,${(m.t_NA || 0).toFixed(1)}`;
                csv += `,${(m.Delta_theta_i_NA || 0).toFixed(2)}`;
                csv += `,${(m.delta_theta_EMS || 0).toFixed(2)}`;
                csv += "\n";
            });
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `time_constant_analysis_${projectId}.csv`;
        a.click();
    };



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
                    <h2 className="text-lg font-semibold tracking-tight">에너지 해석 결과 (Monthly)</h2>
                    <p className="text-sm text-muted-foreground">
                        DIN V 18599 월간 정적 계산 (Monthly Balance Method)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Method Selector Removed */}

                    <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                        <SelectTrigger className="w-[200px] bg-background">
                            <SelectValue placeholder="결과 범위 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="total">전체 건물 (Total)</SelectItem>
                            {results.zones.map((z: ZoneResult) => (
                                <SelectItem key={z.zoneId} value={z.zoneId}>{z.zoneName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Download className="w-4 h-4 mr-2" />
                                검증 리포트 (CSV)
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={downloadTimeConstantCSV}>
                                시간상수 상세 분석 (CSV)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={downloadEnergyDemandVerificationCSV}>
                                에너지 요구량 상세 검증 (CSV)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
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
                <TabsList className="grid w-full grid-cols-1 mb-4">
                    <TabsTrigger value="monthly" className="gap-2"><Leaf className="h-4 w-4" /> 월별 분석 (Monthly)</TabsTrigger>
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
                    <div className="flex justify-end mb-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-3">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span>손실 (Loss)</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span>획득 (Gain)</span>
                        </span>
                    </div>
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
                                            <th className="px-4 py-2">외기온도 (°C)</th>
                                            <th className="px-4 py-2">실내-사용 (°C)</th>
                                            <th className="px-4 py-2">실내-비사용 (°C)</th>
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
                                                    <td className="px-4 py-2 text-muted-foreground">
                                                        {weatherData?.monthly.find(w => w.month === m.month)?.Te.toFixed(1) ?? "-"}
                                                    </td>
                                                    <td className="px-4 py-2">{m.avg_Ti_op?.toFixed(1) ?? m.avg_Ti.toFixed(1)}</td>
                                                    <td className="px-4 py-2 text-muted-foreground">{m.avg_Ti_non_op?.toFixed(1) ?? "-"}</td>
                                                    <td className={`px-4 py-2 ${m.QT > 0 ? "text-red-600 font-medium" : m.QT < 0 ? "text-blue-600 font-medium" : "text-gray-600"}`}>
                                                        {(Math.abs(m.QT) / area).toFixed(1)}
                                                    </td>
                                                    <td className={`px-4 py-2 ${m.QV > 0 ? "text-red-600 font-medium" : m.QV < 0 ? "text-blue-600 font-medium" : "text-gray-600"}`}>
                                                        {(Math.abs(m.QV) / area).toFixed(1)}
                                                    </td>
                                                    <td className="px-4 py-2 text-red-600 font-medium">{(Math.abs(m.QS) / area).toFixed(1)}</td>
                                                    <td className="px-4 py-2 text-red-600 font-medium">{(Math.abs(m.QI) / area).toFixed(1)}</td>
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
