"use client";

import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { getProject } from "@/services/project-service";
import { getZones } from "@/services/zone-service";
import { getSurfaces } from "@/services/surface-service";
import { calculateEnergyDemand } from "@/engine/calculator";
import { ZoneInput } from "@/engine/types";
import { Zone } from "@/types/project";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function DebugPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const projectId = params.id as string;

    // Debug Data State
    const [debugData, setDebugData] = useState<any>(null);
    const [calcLoading, setCalcLoading] = useState(false);
    const [selectedZoneId, setSelectedZoneId] = useState<string>("total");

    // 2. Load Raw Data for Debugging
    useEffect(() => {
        // Skip if loading or not authorized
        if (loading || !user || user.email !== "e10corea@gmail.com") return;

        const loadDebugData = async () => {
            setCalcLoading(true);
            try {
                const project = await getProject(projectId);
                const zones = await getZones(projectId);
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

                const results = calculateEnergyDemand(
                    zoneInputs,
                    project?.weatherStationId,
                    project?.mainStructure,
                    project?.ventilationConfig,
                    project?.ventilationUnits
                );

                setDebugData({
                    project,
                    zones: zoneInputs,
                    results
                });
            } catch (error) {
                console.error("Debug data load failed:", error);
            } finally {
                setCalcLoading(false);
            }
        };

        loadDebugData();
    }, [projectId, loading, user]);

    // Data Filtering
    const isTotal = selectedZoneId === "total";
    const currentZone = debugData && !isTotal ? debugData.zones.find((z: any) => z.id === selectedZoneId) : null;

    // Find monthly results for selected zone
    // If total: debugData.results.monthly
    // If zone: debugData.results.zones.find(...).monthly
    let displayMonthlyData: any[] = [];
    if (debugData) {
        if (isTotal) {
            displayMonthlyData = debugData.results.monthly;
        } else {
            const zoneResult = debugData.results.zones.find((z: any) => z.zoneId === selectedZoneId);
            displayMonthlyData = zoneResult?.monthly || [];
        }
    }

    // 1. Access Control Check (Render Logic)
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user || user.email !== "e10corea@gmail.com") {
        return (
            <div className="flex h-screen flex-col items-center justify-center space-y-4 p-8 text-center">
                <div className="rounded-full bg-red-100 p-4">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">접근 권한이 없습니다</h1>
                <p className="max-w-md text-muted-foreground">
                    이 페이지는 관리자(e10corea@gmail.com) 전용 디버깅 페이지입니다.
                </p>
                <Button onClick={() => router.push(`/projects/${projectId}`)}>
                    프로젝트로 돌아가기
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 space-y-8">
            <div className="flex items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${projectId}`)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Debug Analysis</h1>
                        <p className="text-muted-foreground">Detailed calculation breakdown for {user.email}</p>
                    </div>
                </div>

                {/* Zone Selector (Top Right) */}
                <div className="w-[300px]">
                    <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                        <SelectTrigger>
                            <SelectValue placeholder="영역 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="total">전체 (Total)</SelectItem>
                            {debugData?.zones?.map((zone: any) => (
                                <SelectItem key={zone.id} value={zone.id}>
                                    {zone.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>


            {/* 1. Heating/Cooling Balance Analysis */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">1. Heating/Cooling Balance Analysis ({isTotal ? "Total" : currentZone?.name})</h2>

                {/* Constants Summary */}
                {displayMonthlyData?.[0]?.balanceDetails ? (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Annual Constant Parameters</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Main Constants */}
                            <div>
                                <h3 className="text-xs font-semibold text-muted-foreground mb-2">General & Setpoints</h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">Ti_set (Heat)</div>
                                        <div className="text-lg font-bold">{displayMonthlyData[0].balanceDetails.Ti_set.toFixed(1)}°C</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">Ti_we (Non-use)</div>
                                        <div className="text-lg font-bold">{displayMonthlyData[0].balanceDetails.Ti_we.toFixed(1)}°C</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">Ti_c (Cool)</div>
                                        <div className="text-lg font-bold">{displayMonthlyData[0].balanceDetails.Ti_c.toFixed(1)}°C</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">tau (Time Const)</div>
                                        <div className="text-lg font-bold text-blue-600">{displayMonthlyData[0].balanceDetails.tau.toFixed(1)} h</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">alpha</div>
                                        <div className="text-lg font-bold">{displayMonthlyData[0].balanceDetails.alpha.toFixed(3)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Reduced Operation Parameters */}
                            <div>
                                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Reduced Operation (Setback) Parameters</h3>
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">t_NA (Reduced)</div>
                                        <div className="text-md font-semibold">{displayMonthlyData[0].balanceDetails.t_NA?.toFixed(1) ?? "0.0"} h</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">f_NA (Night)</div>
                                        <div className="text-md font-semibold">{displayMonthlyData[0].balanceDetails.f_NA?.toFixed(3) ?? "0.000"}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">f_we (Weekend)</div>
                                        <div className="text-md font-semibold">{displayMonthlyData[0].balanceDetails.f_we?.toFixed(3) ?? "0.000"}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">f_adapt</div>
                                        <div className="text-md font-semibold">{displayMonthlyData[0].balanceDetails.f_adapt?.toFixed(2) ?? "1.00"}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">Δθ_i,NA (Max)</div>
                                        <div className="text-md font-semibold">{displayMonthlyData[0].balanceDetails.delta_theta_i_NA?.toFixed(1) ?? "0.0"} K</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-center border">
                                        <div className="text-xs text-muted-foreground uppercase mb-1">Δθ_EMS</div>
                                        <div className="text-md font-semibold">{displayMonthlyData[0].balanceDetails.delta_theta_EMS?.toFixed(1) ?? "0.0"} K</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {/* Monthly Table */}
                {displayMonthlyData?.[0]?.balanceDetails ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">
                                Monthly Utilization & Temp Calculation
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-center">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-2">Month</th>
                                            <th className="px-4 py-2">gamma (Gain/Loss)</th>
                                            <th className="px-4 py-2">eta (Utilization)</th>
                                            <th className="px-4 py-2 font-bold text-primary">Ti_calc (°C)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayMonthlyData.map((m: any) => {
                                            const b = m.balanceDetails;
                                            return (
                                                <tr key={m.month} className="border-b">
                                                    <td className="px-4 py-2 font-medium">{m.month}</td>
                                                    <td className="px-4 py-2 text-muted-foreground">{b?.gamma?.toFixed(3) ?? "-"}</td>
                                                    <td className="px-4 py-2 text-muted-foreground">{b?.eta?.toFixed(3) ?? "-"}</td>
                                                    <td className="px-4 py-2 font-bold text-primary group-hover:bg-muted">{b?.Ti_calc?.toFixed(2) ?? "-"}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="p-4 text-muted-foreground bg-muted rounded-md border">
                        데이터를 불러오는 중이거나 선택된 영역의 상세 데이터가 없습니다.
                    </div>
                )}
            </section>

            {/* 2. Time Constant (τ) Calculation Parameters (Annual Constant) */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">2. Time Constant (τ) Calculation Parameters (Annual Constant) ({isTotal ? "Total" : currentZone?.name})</h2>
                {displayMonthlyData?.[0]?.balanceDetails ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">
                                τ (h) = Cm (Wh/K) / (Htr + Hve) (W/K) |
                                Building Time Constant Determines Heat Utilization Efficiency
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-center">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-2 border-r">Cm (Wh/K)</th>
                                            <th className="px-4 py-2">H_D</th>
                                            <th className="px-4 py-2">H_g</th>
                                            <th className="px-4 py-2">H_U</th>
                                            <th className="px-4 py-2">H_A</th>
                                            <th className="px-4 py-2 border-r">H_TB</th>
                                            <th className="px-4 py-2 border-r">Hve (W/K)</th>
                                            <th className="px-4 py-2 font-bold border-r">H_total (W/K)</th>
                                            <th className="px-4 py-2 font-bold text-primary">tau (h)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const m = displayMonthlyData[0];
                                            const b = m.balanceDetails;
                                            const d = m.conductionDetails;
                                            return (
                                                <tr className="border-b bg-card">
                                                    <td className="px-4 py-4 font-medium border-r">{b?.Cm?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}</td>
                                                    <td className="px-4 py-4 text-muted-foreground">{d?.H_D?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-4 text-muted-foreground">{d?.H_g?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-4 text-muted-foreground">{d?.H_U?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-4 text-muted-foreground">{d?.H_A?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-4 text-muted-foreground border-r">{d?.H_TB?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-4 border-r">{b?.Hve?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-4 font-bold border-r">{b?.Htotal?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-4 font-bold text-lg text-primary">{b?.tau?.toFixed(1) ?? "-"}</td>
                                                </tr>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="p-4 text-muted-foreground bg-muted rounded-md border">
                        데이터를 불러오는 중이거나 선택된 영역의 상세 데이터가 없습니다.
                    </div>
                )}
            </section>

            {/* 3. Conduction Heat Analysis */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">3. Conduction Heat Analysis ({isTotal ? "Total" : currentZone?.name})</h2>
                {displayMonthlyData?.[0]?.conductionDetails ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">
                                Envelope Area: {displayMonthlyData[0].conductionDetails.Area_envelope.toFixed(1)} m² |
                                Thermal Bridge ΔU: {displayMonthlyData[0].conductionDetails.Delta_U_wb.toFixed(2)} W/(m²K)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-2">Month</th>
                                            <th className="px-4 py-2">H_D (Direct)</th>
                                            <th className="px-4 py-2">H_g (Ground)</th>
                                            <th className="px-4 py-2">H_U (Unheated)</th>
                                            <th className="px-4 py-2">H_TB (Bridge)</th>
                                            <th className="px-4 py-2 font-bold">H_tr (Total)</th>
                                            <th className="px-4 py-2">Ti (°C)</th>
                                            <th className="px-4 py-2">Te (°C)</th>
                                            <th className="px-4 py-2 font-bold">QT (kWh)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayMonthlyData.map((m: any) => {
                                            const d = m.conductionDetails;
                                            return (
                                                <tr key={m.month} className="border-b">
                                                    <td className="px-4 py-2 font-medium">{m.month}</td>
                                                    <td className="px-4 py-2">{d?.H_D?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-2">{d?.H_g?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-2">{d?.H_U?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-2">{d?.H_TB?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-2 font-bold">{d?.H_tr?.toFixed(1) ?? "-"}</td>
                                                    <td className="px-4 py-2">{m.indoorTempUsage?.toFixed(1)}</td>
                                                    <td className="px-4 py-2">{m.outdoorTemp?.toFixed(1)}</td>
                                                    <td className="px-4 py-2 font-bold text-blue-600">{m.QT.toFixed(0)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="p-4 text-muted-foreground bg-muted rounded-md border">
                        데이터를 불러오는 중이거나 선택된 영역의 상세 데이터가 없습니다.
                    </div>
                )}
            </section>

            {/* 4. Raw Data Dump */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">4. Raw Calculation Data</h2>
                {calcLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Calculating...
                    </div>
                ) : (
                    <Card className="bg-slate-950 text-slate-50">
                        <CardHeader>
                            <CardTitle className="text-sm font-mono text-slate-400">JSON Output</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="max-h-[600px] overflow-auto rounded-md bg-slate-900 p-4 text-xs font-mono leading-relaxed">
                                {JSON.stringify(debugData, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    );
}
