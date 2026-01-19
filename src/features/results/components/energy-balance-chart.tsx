"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EnergyBalanceChartProps {
    data: MonthlyResult[];
}

export function EnergyBalanceChart({ data }: EnergyBalanceChartProps) {
    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
                <CardTitle>월별 에너지 밸런스</CardTitle>
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
                            {/* Losses Stack */}
                            <Bar dataKey="QT" name="전도 손실" stackId="losses" fill="#f87171" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="QV" name="환기 손실" stackId="losses" fill="#fca5a5" radius={[4, 4, 0, 0]} />

                            {/* Gains Stack */}
                            <Bar dataKey="QS" name="일사 획득" stackId="gains" fill="#fbbf24" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="QI" name="내부 발열" stackId="gains" fill="#fcd34d" />
                            <Bar dataKey="Qh" name="난방 공급" stackId="gains" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
