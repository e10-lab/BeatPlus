"use client";

import { ClimateData, HourlyClimate, MonthlyClimate } from "@/engine/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart, Area } from "recharts";
import { useMemo } from "react";
import { Sun, Thermometer, Snowflake, Calculator } from "lucide-react";
import { calculateSunPosition } from "@/engine/solar-calc";

interface ClimateAnalysisViewProps {
    weatherData: ClimateData;
}

export function ClimateAnalysisView({ weatherData }: ClimateAnalysisViewProps) {

    // Process data for charts
    const monthlyStats = useMemo(() => {
        if (weatherData.hourly) {
            // Aggregate from hourly for better precision (Min/Max)
            const stats = Array(12).fill(null).map((_, i) => ({
                month: i + 1,
                minTemp: 100,
                maxTemp: -100,
                sumTemp: 0,
                count: 0,
                radHoriz: 0,
                radDirect: 0,
                radDiffuse: 0,
                hdd: 0,
                cdd: 0
            }));

            // Base temps for HDD/CDD
            const HDD_BASE = 18.0;
            const CDD_BASE = 24.0;

            weatherData.hourly.forEach(h => {
                const mIdx = h.month - 1;
                const stat = stats[mIdx];

                // Temp
                if (h.Te < stat.minTemp) stat.minTemp = h.Te;
                if (h.Te > stat.maxTemp) stat.maxTemp = h.Te;
                stat.sumTemp += h.Te;
                stat.count++;

                // Radiation (W/m2 * 1h = Wh/m2)
                // Normalize to kWh/m2 for monthly sum

                // Bug Fix: Some EPW JSONs have 0 for sunAltitude. Recalculate if needed.
                let altitude = h.sunAltitude;

                // If altitude is missing/zero but we have Beam radiation (Daytime), retrieve it.
                // Or simply always recalculate for visualization accuracy if not trusted.
                // Using 37.5 Latitude (Seoul) as default fallback if unknown.
                if (altitude === 0 && h.I_beam > 0) {
                    const dayOfYear = Math.floor((h.hourOfYear - 1) / 24) + 1;
                    // We don't have latitude in ClimateData, assuming Seoul (37.5) for now as it's the main dataset.
                    // A better fix would be passing latitude in props.
                    const pos = calculateSunPosition(dayOfYear, h.hour, 37.5);
                    altitude = pos.altitude;
                }

                const sinAlt = Math.sin(Math.max(0, altitude) * Math.PI / 180);

                // Global Horizontal ~ I_beam * sin(alt) + I_diff
                // This is an approximation. Ideally EPW has GHI directly but we only have Is_Horiz in Monthly.
                // In hourly we rely on Beam/Diff.

                // Use Max(0, ...) to avoid negative solar contribution
                const directHoriz = Math.max(0, h.I_beam * sinAlt);
                const diffuseHoriz = Math.max(0, h.I_diff);
                const globalHoriz = directHoriz + diffuseHoriz;

                stat.radHoriz += globalHoriz / 1000; // kWh
                stat.radDirect += directHoriz / 1000; // Direct component on horizontal
                stat.radDiffuse += diffuseHoriz / 1000; // Diffuse component

                // HDD/CDD (Hourly method: (Tb - To) / 24 )
                if (h.Te < HDD_BASE) {
                    stat.hdd += (HDD_BASE - h.Te) / 24;
                }
                if (h.Te > CDD_BASE) {
                    stat.cdd += (h.Te - CDD_BASE) / 24;
                }
            });

            return stats.map(s => {
                // Calibration: Match the sum of hourly values to the official Monthly Total if available
                // This ensures the chart matches the "Official" data shown in other dialogs.
                let calibratedDirect = s.radDirect;
                let calibratedDiffuse = s.radDiffuse;
                let calibratedHoriz = s.radHoriz;

                // Find official monthly value
                const officialMonth = weatherData.monthly.find(m => m.month === s.month);
                if (officialMonth && s.radHoriz > 0) {
                    const officialTotal = officialMonth.Is_Horiz; // kWh/m2 derived from metadata
                    const scalingFactor = officialTotal / s.radHoriz;

                    // Apply scaling if difference is within reasonable bounds (e.g. < 20% diff, otherwise might be data error)
                    if (scalingFactor > 0.8 && scalingFactor < 1.2) {
                        calibratedDirect *= scalingFactor;
                        calibratedDiffuse *= scalingFactor;
                        calibratedHoriz = officialTotal;
                    }
                }

                return {
                    month: `${s.month}월`,
                    avgTemp: parseFloat((s.sumTemp / s.count).toFixed(1)),
                    minTemp: s.minTemp,
                    maxTemp: s.maxTemp,
                    tempRange: [s.minTemp, s.maxTemp] as [number, number],
                    radHoriz: Math.round(calibratedHoriz),
                    radDirect: Math.round(calibratedDirect),
                    radDiffuse: Math.round(calibratedDiffuse),
                    hdd: Math.round(s.hdd),
                    cdd: Math.round(s.cdd)
                };
            });
        } else {
            // Fallback to Monthly data
            return weatherData.monthly.map(m => ({
                month: `${m.month}월`,
                avgTemp: m.Te,
                minTemp: m.Te - 5, // Rough estimate
                maxTemp: m.Te + 5,
                tempRange: [m.Te - 5, m.Te + 5] as [number, number],
                radHoriz: m.Is_Horiz,
                radDirect: m.Is_Horiz * 0.6, // Rough estimate
                radDiffuse: m.Is_Horiz * 0.4, // Rough estimate
                hdd: 0, // Cannot calc accurately without hourly
                cdd: 0
            }));
        }
    }, [weatherData]);

    const annualHDD = monthlyStats.reduce((sum, m) => sum + m.hdd, 0);
    const annualCDD = monthlyStats.reduce((sum, m) => sum + m.cdd, 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calculator className="h-4 w-4" /> 연간 난방도일 (HDD 18°C)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-red-600">{annualHDD.toFixed(0)} <span className="text-sm text-muted-foreground font-normal">degree-days</span></div>
                        <p className="text-xs text-muted-foreground mt-1">겨울철 난방 부하의 척도</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calculator className="h-4 w-4" /> 연간 냉방도일 (CDD 24°C)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-blue-600">{annualCDD.toFixed(0)} <span className="text-sm text-muted-foreground font-normal">degree-days</span></div>
                        <p className="text-xs text-muted-foreground mt-1">여름철 냉방 부하의 척도</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Sun className="h-4 w-4" /> 위치 정보
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-lg font-bold truncate">{weatherData.name}</div>
                        <p className="text-xs text-muted-foreground mt-1">표준 기상 데이터 (TMY/EPW)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Temperature Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Thermometer className="h-4 w-4" /> 월별 외기 온도 분석</CardTitle>
                        <CardDescription>평균, 최저, 최고 온도 분포 (°C)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={monthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} unit="°C" domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend />
                                    <Area type="monotone" dataKey="tempRange" stroke="transparent" fill="#f1f5f9" name="온도 범위" />
                                    <Line type="monotone" dataKey="avgTemp" stroke="#0f172a" strokeWidth={2} dot={{ r: 4 }} name="평균 온도" />
                                    <Line type="monotone" dataKey="maxTemp" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} name="최고 온도" />
                                    <Line type="monotone" dataKey="minTemp" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" dot={false} name="최저 온도" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Solar Radiation Chart - Stacked Bar */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Sun className="h-4 w-4" /> 월별 일사량 분석</CardTitle>
                        <CardDescription>수평면 일사량 구성 (직달 + 산란 = 전일사량)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} unit=" kWh" />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="radDirect" stackId="a" fill="#d97706" radius={[0, 0, 0, 0]} name="직달일사량 (Direct)" maxBarSize={50} />
                                    <Bar dataKey="radDiffuse" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} name="산란일사량 (Diffuse)" maxBarSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* HDD/CDD Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Snowflake className="h-4 w-4" /> 냉난방 도일 (Degree Days)</CardTitle>
                        <CardDescription>난방도일(HDD 18) 및 냉방도일(CDD 24) 분포</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="hdd" fill="#ef4444" stackId="a" radius={[0, 0, 4, 4]} name="난방도일 (HDD)" maxBarSize={50} />
                                    <Bar dataKey="cdd" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]} name="냉방도일 (CDD)" maxBarSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
