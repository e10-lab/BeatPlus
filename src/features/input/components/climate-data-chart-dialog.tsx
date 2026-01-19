"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WeatherStation } from "@/lib/climate-data";
import { CloudSun, Search } from "lucide-react";

interface ClimateDataChartDialogProps {
    station: WeatherStation;
    trigger?: React.ReactNode;
}

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export function ClimateDataChartDialog({ station, trigger }: ClimateDataChartDialogProps) {
    // Transform data for Recharts
    const data = MONTHS.map((month, index) => ({
        name: month,
        temp: station.monthlyTemp[index],
        solar: station.monthlySolar[index],
    }));

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <CloudSun className="h-4 w-4" />
                        기후 데이터 보기
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CloudSun className="h-5 w-5" />
                        기후 데이터: {station.name} (2021-2025 평균)
                    </DialogTitle>
                </DialogHeader>

                <div className="h-[400px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid stroke="#f5f5f5" />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />

                            {/* Left Y-Axis: Temperature */}
                            <YAxis
                                yAxisId="left"
                                label={{ value: '월평균 기온 (°C)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                                domain={[-10, 35]}
                                tick={{ fontSize: 12 }}
                            />

                            {/* Right Y-Axis: Solar Radiation */}
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                label={{ value: '월합계 일사량 (kWh/m²)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
                                domain={[0, 200]}
                                tick={{ fontSize: 12 }}
                            />

                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: any, name: any) => {
                                    if (String(name).includes("Temp") || String(name).includes("기온")) return [`${value} °C`, "기온"];
                                    return [`${value} kWh/m²`, "일사량"];
                                }}
                            />
                            <Legend />

                            <Bar
                                yAxisId="right"
                                dataKey="solar"
                                name="일사량 (Solar)"
                                fill="#fbbf24"
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="temp"
                                name="기온 (Temp)"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 text-xs text-muted-foreground text-center">
                    * 데이터 출처: 기상청 종관기상관측(ASOS) 자료 기반 2021-2025년 평균값
                </div>
            </DialogContent>
        </Dialog>
    );
}
