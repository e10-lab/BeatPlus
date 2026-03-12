"use client";

import { useState, useMemo } from "react";
import { ZoneResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from "recharts";
import { CalendarDays } from "lucide-react";

interface HourlyAnalysisViewProps {
    zones: ZoneResult[];
    selectedZoneId: string;
}

export function HourlyAnalysisView({ zones, selectedZoneId }: HourlyAnalysisViewProps) {
    const [selectedMonth, setSelectedMonth] = useState<string>("1");

    // Find selected data
    const activeData = useMemo(() => {
        if (selectedZoneId === "total") {
            // Aggregating hourly data for total building is complex (different Ti per zone).
            // Usually we show a specific zone, or average?
            // For simplicity, let's just pick the first zone or return null/warning for totals.
            if (zones.length > 0) return zones[0].hourly;
            return [];
        }
        return zones.find(z => z.zoneId === selectedZoneId)?.hourly || [];
    }, [zones, selectedZoneId]);

    // Filter by month
    const chartData = useMemo(() => {
        if (!activeData) return [];
        // Calculate start/end hour for month
        // Detailed approach: Parse hourOfYear -> Month.
        // In engine, we have hourOfYear 1-8760.
        // Simple map: Jan=1-744, Feb=745-1416 ...
        // Better: Use the 'month' property if I added it? 
        // I checked types.ts, HourlyResult has { hour, Te, Ti ... } but maybe not month explicitly?
        // Let's check calculation.ts. I pushed { hour: h, ... }.
        // I can derive month from hourOfYear.

        const m = parseInt(selectedMonth);
        // Approx days
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let startHour = 0;
        for (let i = 0; i < m - 1; i++) startHour += daysInMonth[i] * 24;
        const endHour = startHour + daysInMonth[m - 1] * 24;

        return activeData.filter(d => d.hour > startHour && d.hour <= endHour).map(d => ({
            ...d,
            day: Math.ceil(d.hour / 24),
            localHour: (d.hour - 1) % 24
        }));
    }, [activeData, selectedMonth]);

    if (selectedZoneId === "total") {
        return (
            <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg">
                <p>시간별 상세 분석은 <b>개별 존(Zone)</b>을 선택해야 확인할 수 있습니다.</p>
                <p className="text-sm mt-2">상단 &apos;결과 범위 선택&apos;에서 특정 존을 선택해주세요.</p>
            </div>
        );
    }

    if (!activeData || activeData.length === 0) return <div>데이터가 없습니다.</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-medium">시간별 온열 환경 (Hourly Thermal Environment)</CardTitle>
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="월 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <SelectItem key={m} value={m.toString()}>{m}월</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] min-h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="localHour"
                                    tickFormatter={(val) => `${val}h`}
                                    interval={23} // Show daily markers approx? No, monthly view is 744 points.
                                // Too crowded. Let's show Days on axis?
                                // Or just let it be.
                                />
                                <YAxis yAxisId="temp" domain={['auto', 'auto']} unit="°C" />
                                <YAxis yAxisId="load" orientation="right" unit="W" />
                                <Tooltip
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload.length > 0) {
                                            const d = payload[0].payload;
                                            return `${selectedMonth}월 ${d.day % 31 === 0 ? 31 : d.day % 31}일 ${d.localHour}:00`;
                                        }
                                        return "";
                                    }}
                                />
                                <Legend />

                                {/* Loads (Background) */}
                                <Area yAxisId="load" type="monotone" dataKey="Q_heating" name="난방 부하" fill="#fca5a5" stroke="none" fillOpacity={0.4} />
                                <Area yAxisId="load" type="monotone" dataKey="Q_cooling" name="냉방 부하" fill="#93c5fd" stroke="none" fillOpacity={0.4} />

                                {/* Temps (Lines) */}
                                <Line yAxisId="temp" type="monotone" dataKey="Te" name="외기온도" stroke="#94a3b8" dot={false} strokeWidth={1} />
                                <Line yAxisId="temp" type="monotone" dataKey="Ti" name="실내온도" stroke="#10b981" dot={false} strokeWidth={2} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 text-sm text-center text-muted-foreground">
                        * 배경 영역은 냉/난방 부하(W)를, 선 그래프는 온도(°C)를 나타냅니다.
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">평균 실내 온도</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(chartData.reduce((acc, curr) => acc + curr.Ti, 0) / chartData.length).toFixed(1)}°C
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">난방 가동 시간</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {chartData.filter(d => d.Q_heating > 0).length} h
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">냉방 가동 시간</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {chartData.filter(d => d.Q_cooling > 0).length} h
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
