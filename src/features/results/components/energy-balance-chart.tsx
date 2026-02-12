"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EnergyBalanceChartProps {
    data: MonthlyResult[];
    totalArea: number;
}

export function EnergyBalanceChart({ data, totalArea }: EnergyBalanceChartProps) {
    const area = totalArea > 0 ? totalArea : 1;

    // Normalize data for chart
    const chartData = data.map(d => ({
        ...d,
        QT_spec: d.QT / area,
        QV_spec: d.QV / area,
        QS_spec: d.QS / area,
        QI_spec: d.QI / area,
        Qh_spec: d.Q_heating / area,
        Qc_spec: d.Q_cooling / area
    }));

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
                <CardTitle>월별 에너지 밸런스 (Specific Balance)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] min-h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                            {/* Losses Stack */}
                            {/* Heat Flows (Signed: Loss is negative, Gain is positive) */}
                            <Bar dataKey="QT_spec" name="전도열" stackId="balance" fill="#3b82f6" />
                            <Bar dataKey="QV_spec" name="환기열" stackId="balance" fill="#60a5fa" />

                            {/* Gains Stack */}
                            <Bar dataKey="QS_spec" name="일사 획득" stackId="gains" fill="#f59e0b" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="QI_spec" name="내부 발열" stackId="gains" fill="#fcd34d" />
                            <Bar dataKey="Qh_spec" name="난방 공급" stackId="gains" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
