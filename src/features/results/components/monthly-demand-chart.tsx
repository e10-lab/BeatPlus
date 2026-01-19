"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MonthlyDemandChartProps {
    data: MonthlyResult[];
}

export function MonthlyDemandChart({ data }: MonthlyDemandChartProps) {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>월별 난방 및 냉방 소요량</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="month"
                                tickFormatter={(value) => `${value}월`}
                                fontSize={12}
                            />
                            <YAxis
                                fontSize={12}
                                tickFormatter={(value) => `${value} kWh`}
                            />
                            <Tooltip
                                formatter={(value: number | undefined) => [`${(value || 0).toFixed(1)} kWh`, ""]}
                                labelFormatter={(label) => `${label}월`}
                            />
                            <Legend />
                            <Bar
                                dataKey="Qh"
                                name="난방 소요량"
                                fill="#ef4444"
                                radius={[4, 4, 0, 0]}
                            />
                            <Bar
                                dataKey="Qc"
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
