"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MonthlyDemandChartProps {
    data: MonthlyResult[];
    totalArea: number;
}

export function MonthlyDemandChart({ data, totalArea }: MonthlyDemandChartProps) {
    const area = totalArea > 0 ? totalArea : 1;

    // Normalize data for chart
    const chartData = data.map(d => ({
        ...d,
        Qh_spec: d.Qh / area,
        Qc_spec: d.Qc / area
    }));

    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>월별 난방 및 냉방 소요량 (Specific Demand)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="month"
                                tickFormatter={(value) => `${value}월`}
                                fontSize={12}
                            />
                            <YAxis
                                fontSize={12}
                                tickFormatter={(value) => `${value}`}
                                label={{ value: 'kWh/m²', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                            />
                            <Tooltip
                                formatter={(value: any, name: any) => [`${(value || 0).toFixed(1)} kWh/m²`, name]}
                                labelFormatter={(label) => `${label}월`}
                            />
                            <Legend />
                            <Bar
                                dataKey="Qh_spec"
                                name="난방 소요량"
                                fill="#ef4444"
                                radius={[4, 4, 0, 0]}
                            />
                            <Bar
                                dataKey="Qc_spec"
                                name="냉방 소요량"
                                fill="#3b82f6"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
