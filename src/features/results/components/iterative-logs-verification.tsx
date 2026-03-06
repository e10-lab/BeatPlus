
"use client";

import React from "react";
import { MonthlyResult, IterationLog } from "@/engine/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

interface IterativeLogsVerificationProps {
    data: MonthlyResult[];
    title?: string;
    selectedMonth: number;
    onMonthChange: (month: number) => void;
    selectedIterationStep: number | null;
    onIterationSelect: (step: number | null) => void;
}

export function IterativeLogsVerification({
    data,
    title,
    selectedMonth,
    onMonthChange,
    selectedIterationStep,
    onIterationSelect,
}: IterativeLogsVerificationProps) {
    const currentMonthData = data.find((m) => m.month === selectedMonth) || data[0];
    const logs = currentMonthData.iterationLogs || [];

    const formatNum = (num: number | undefined, decimals: number = 2) => {
        if (num === undefined || num === null || isNaN(num)) return "-";
        return num.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>{title || "반복 계산 수렴 이력 (Iterative Calculation Logs)"}</CardTitle>
                        <CardDescription>
                            DIN 18599-1:2025-10 Sec 5.2.4에 따른 난방/냉방 부하와 시스템 손실의 반복 계산 수렴 과정
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">조회 월:</span>
                        <Select
                            value={selectedMonth.toString()}
                            onValueChange={(val) => {
                                onMonthChange(parseInt(val));
                                // Month change automatically resets step in parent if needed, 
                                // but usually we keep it or reset it. 
                                // Let's assume parent handles reset or we explicitly call it.
                                onIterationSelect(null);
                            }}
                        >
                            <SelectTrigger className="w-[100px]">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {data.map((m) => (
                                    <SelectItem key={m.month} value={m.month.toString()}>
                                        {m.month}월
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[80px] text-center">Step</TableHead>
                                <TableHead className="text-right">
                                    난방요구량 <br /> (<InlineMath math="Q_{h,b}" />)
                                </TableHead>
                                <TableHead className="text-right">
                                    냉방요구량 <br /> (<InlineMath math="Q_{c,b}" />)
                                </TableHead>
                                <TableHead className="text-right text-orange-600">
                                    시스템 손실 → 획득 <br /> (<InlineMath math="Q_{I,sys,h}" />)
                                </TableHead>
                                <TableHead className="text-right text-blue-600">
                                    시스템 손실 → 제거 <br /> (<InlineMath math="Q_{I,sys,c}" />)
                                </TableHead>
                                <TableHead className="text-right">
                                    수렴도 <br /> (Convergence)
                                </TableHead>
                                <TableHead className="text-center w-[100px]">상세 확인</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length > 0 ? (
                                logs.map((log) => (
                                    <TableRow
                                        key={log.step}
                                        className={cn(
                                            "cursor-pointer hover:bg-muted/50 transition-colors",
                                            selectedIterationStep === log.step && "bg-muted"
                                        )}
                                        onClick={() => onIterationSelect(selectedIterationStep === log.step ? null : log.step)}
                                    >
                                        <TableCell className="text-center font-medium">
                                            <Badge variant="outline">{log.step}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{formatNum(log.Q_h_b, 4)}</TableCell>
                                        <TableCell className="text-right">{formatNum(log.Q_c_b, 4)}</TableCell>
                                        <TableCell className="text-right text-orange-600 font-medium">
                                            {formatNum(log.Q_I_sys_heating, 4)}
                                        </TableCell>
                                        <TableCell className="text-right text-blue-600 font-medium">
                                            {formatNum(log.Q_I_sys_cooling, 4)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {log.step === 1 ? "-" : `${formatNum(log.convergence, 5)}%`}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={selectedIterationStep === log.step ? "default" : "secondary"}>
                                                {selectedIterationStep === log.step ? "닫기" : "보기"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        로그 데이터가 없습니다. 계산이 수행되지 않았거나 반복이 필요 없는 경우일 수 있습니다.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {selectedIterationStep !== null && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <Badge>Step {selectedIterationStep}</Badge>
                            <h3 className="font-bold text-lg">상세 계산 파라미터 (Detailed Parameters)</h3>
                        </div>

                        {(() => {
                            const log = logs.find((l) => l.step === selectedIterationStep);
                            if (!log || !log.details) return <div className="py-4 text-center text-muted-foreground">상세 정보가 없습니다.</div>;

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Energy Balance Components */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            에너지 밸런스 성분 (Energy Balance Components)
                                        </h4>
                                        <div className="rounded-md border overflow-hidden">
                                            <Table className="text-sm">
                                                <TableBody>
                                                    <TableRow>
                                                        <TableCell className="font-medium">관류 열손실 (<InlineMath math="Q_T" />)</TableCell>
                                                        <TableCell className="text-right">{formatNum(log.details.QT, 2)} kWh</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-medium">환기 열손실 (<InlineMath math="Q_V" />)</TableCell>
                                                        <TableCell className="text-right">{formatNum(log.details.QV, 2)} kWh</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-medium">일사 열취득 (<InlineMath math="Q_S" />)</TableCell>
                                                        <TableCell className="text-right">{formatNum(log.details.QS, 2)} kWh</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-medium">내부 발열 (<InlineMath math="Q_I" />)</TableCell>
                                                        <TableCell className="text-right">{formatNum(log.details.QI, 2)} kWh</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* Coefficients & Factors */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            계수 및 온도 (Factors & Temperatures)
                                        </h4>
                                        <div className="rounded-md border overflow-hidden">
                                            <Table className="text-sm">
                                                <TableBody>
                                                    <TableRow>
                                                        <TableCell className="font-medium">난방 이용 효율 (<InlineMath math="\eta_h" />)</TableCell>
                                                        <TableCell className="text-right">{formatNum(log.details.eta_h, 4)}</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-medium">냉방 이용 효율 (<InlineMath math="\eta_c" />)</TableCell>
                                                        <TableCell className="text-right">{formatNum(log.details.eta_c, 4)}</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-medium">이득/손실 비 (<InlineMath math="\gamma_h" />)</TableCell>
                                                        <TableCell className="text-right">{formatNum(log.details.gamma_h, 4)}</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-medium">손실/이득 비 (<InlineMath math="\gamma_c" />)</TableCell>
                                                        <TableCell className="text-right">{formatNum(log.details.gamma_c, 4)}</TableCell>
                                                    </TableRow>
                                                    {/* Only show node temperatures if they exist */}
                                                    {log.theta_air !== undefined && (
                                                        <TableRow className="bg-muted/30">
                                                            <TableCell className="font-medium">공기 온도 (<InlineMath math="\theta_{air}" />)</TableCell>
                                                            <TableCell className="text-right">{formatNum(log.theta_air, 2)} °C</TableCell>
                                                        </TableRow>
                                                    )}
                                                    {log.theta_s !== undefined && (
                                                        <TableRow className="bg-muted/30">
                                                            <TableCell className="font-medium">표면 온도 (<InlineMath math="\theta_{s}" />)</TableCell>
                                                            <TableCell className="text-right">{formatNum(log.theta_s, 2)} °C</TableCell>
                                                        </TableRow>
                                                    )}
                                                    {log.theta_m !== undefined && (
                                                        <TableRow className="bg-muted/30">
                                                            <TableCell className="font-medium">구체 온도 (<InlineMath math="\theta_{m}" />)</TableCell>
                                                            <TableCell className="text-right">{formatNum(log.theta_m, 2)} °C</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
