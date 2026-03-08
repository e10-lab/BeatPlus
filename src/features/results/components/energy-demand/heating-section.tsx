"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap } from "lucide-react";
import { InlineMath } from "react-katex";
import { formatNum } from "../../utils/formatters";
import { VerificationSection } from "../shared/verification-ui";

interface HeatingSectionProps {
  currentMonthData: any;
  h: any;
  isExpanded: boolean;
  onToggle: () => void;
}

export function HeatingSection({
  currentMonthData,
  h,
  isExpanded,
  onToggle
}: HeatingSectionProps) {
  return (
    <VerificationSection 
      step="Step 2" 
      title="난방 이용률 및 요구량 산출 (Heating Energy Demand)"
      collapsible
      isExpanded={isExpanded}
      onToggle={onToggle}
      rightElement={<div className="text-red-700 font-bold text-sm">{formatNum(currentMonthData.Q_h_b, 1)} kWh/월</div>}
      className="border-red-100"
    >
      <div className="rounded-md border border-red-100 overflow-hidden bg-white">
        <Table className="text-xs">
          <TableHeader className="bg-red-50/50">
            <TableRow className="hover:bg-transparent border-b-red-100">
              <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일수 (<InlineMath math="d" />)</span></TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2 text-[11px]">
                    <p className="font-bold mb-1">운전 일수 (<InlineMath math="d" />)</p>
                    해당 운전 모드(사용/비사용)의 월간 일수
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="\tau_h" /> (h)</span></TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2 text-[11px]">
                    <p className="font-bold mb-1">시상수 (<InlineMath math="\tau_h" />)</p>
                    건물의 열적 관성을 나타내는 시간 상수 (시간)
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="a_h" /> (-)</span></TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2 text-[11px]">
                    <p className="font-bold mb-1">수치적 매개변수 (<InlineMath math="a_h" />)</p>
                    시상수와 유효 열용량에 따른 무차원 매개변수
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="\gamma_h" /> (-)</span></TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2 text-[11px]">
                    <p className="font-bold mb-1">열획득/열손실 비 (<InlineMath math="\gamma_h" />)</p>
                    태양 및 내부 열획득과 전송 및 환기 열손실의 비율
                    <div className="mt-1 text-slate-400">
                      <InlineMath math="\gamma_h = Q_{gain} / Q_{loss}" />
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{sink}" /> (kWh)</span></TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2 text-[11px]">
                    <p className="font-bold mb-1">열싱크 (<InlineMath math="Q_{sink}" />)</p>
                    난방의 경우 총 열손실(<InlineMath math="Q_{loss}" />)과 동일
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{source}" /> (kWh)</span></TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2 text-[11px]">
                    <p className="font-bold mb-1">열소스 (<InlineMath math="Q_{source}" />)</p>
                    난방의 경우 총 열획득(<InlineMath math="Q_{gain}" />)과 동일
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="\eta_h" /> (-)</span></TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2 text-[11px]">
                    <p className="font-bold mb-1">이용계수 (<InlineMath math="\eta_h" />)</p>
                    열획득이 난방 부하 감소에 기여하는 비율
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right font-bold text-red-700 bg-red-50/50">
                <Tooltip>
                  <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{h,b}" /> (kWh)</span></TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2 text-[11px]">
                    <p className="font-bold mb-1">난방 요구량 (<InlineMath math="Q_{h,b}" />)</p>
                    최종적으로 필요한 난방 에너지
                    <div className="mt-1 text-slate-400">
                      <InlineMath math="Q_{h,b} = Q_{sink} - \eta_h \cdot Q_{source}" />
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-slate-50 border-b border-red-50/50">
              <TableCell className="font-medium flex items-center gap-1.5"><Zap className="h-3 w-3 text-red-400" />사용일 (Usage)</TableCell>
              <TableCell className="text-right font-mono text-slate-600">{formatNum(currentMonthData.d_nutz, 2)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.tau_op, 1)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.alpha_op, 2)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.Q_sink_op && currentMonthData.Q_sink_op > 0 ? (currentMonthData.Q_source_op || 0) / currentMonthData.Q_sink_op : 0, 3)}</TableCell>
              <TableCell className="text-right font-mono">{formatNum(currentMonthData.Q_sink_op, 1)}</TableCell>
              <TableCell className="text-right font-mono text-orange-600/80">{formatNum(currentMonthData.Q_source_op, 1)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.eta_h_op, 4)}</TableCell>
              <TableCell className="text-right font-mono font-medium text-red-600/80">{formatNum(currentMonthData.Q_h_b_op, 1)}</TableCell>
            </TableRow>
            <TableRow className="hover:bg-slate-50 border-b border-red-50/50">
              <TableCell className="font-medium flex items-center gap-1.5"><div className="h-3 w-3 rounded-full border border-slate-300" />비사용일 (Non-op)</TableCell>
              <TableCell className="text-right font-mono text-slate-600">{formatNum(currentMonthData.d_we, 2)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.tau_non_op, 1)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.alpha_non_op, 2)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.Q_sink_non_op && currentMonthData.Q_sink_non_op > 0 ? (currentMonthData.Q_source_non_op || 0) / currentMonthData.Q_sink_non_op : 0, 3)}</TableCell>
              <TableCell className="text-right font-mono">{formatNum(currentMonthData.Q_sink_non_op, 1)}</TableCell>
              <TableCell className="text-right font-mono text-orange-600/80">{formatNum(currentMonthData.Q_source_non_op, 1)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.eta_h_non_op, 4)}</TableCell>
              <TableCell className="text-right font-mono font-medium text-red-600/80">{formatNum(currentMonthData.Q_h_b_non_op, 1)}</TableCell>
            </TableRow>
            <TableRow className="bg-red-50/20 hover:bg-red-50/40 font-bold border-t-2 border-red-100">
              <TableCell className="text-red-800">월간 합계 (Total)</TableCell>
              <TableCell className="text-right font-mono">{formatNum((currentMonthData.d_nutz || 0) + (currentMonthData.d_we || 0), 2)}</TableCell>
              <TableCell className="text-right font-mono text-slate-400 italic">avg</TableCell>
              <TableCell className="text-right font-mono text-slate-400 italic">avg</TableCell>
              <TableCell className="text-right font-mono">{formatNum(h?.gamma, 3)}</TableCell>
              <TableCell className="text-right font-mono">{formatNum(h?.Q_loss, 1)}</TableCell>
              <TableCell className="text-right font-mono text-orange-600">{formatNum(h?.Q_gain, 1)}</TableCell>
              <TableCell className="text-right font-mono">{formatNum(h?.eta, 4)}</TableCell>
              <TableCell className="text-right font-mono text-red-700 bg-red-100/30">{formatNum(currentMonthData.Q_h_b, 1)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="bg-slate-50/30 px-4 py-2 border-t border-red-100 flex items-center justify-end gap-x-6">
          <div className="text-[10px] text-slate-500 font-serif italic">
            <InlineMath math="Q_{h,b} = Q_{sink} - \eta_h \cdot Q_{source}" />
          </div>
          <div className="text-[10px] text-slate-400 font-serif italic">
            (<InlineMath math="Q_{sink} = Q_{loss}" />, <InlineMath math="Q_{source} = Q_{gain}" />)
          </div>
        </div>
      </div>

      {/* 난방 시스템 손실 상세 (Heating System Loss Breakdown) */}
      <div className="mt-6 bg-white rounded-md border border-orange-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-orange-100 bg-orange-50/30 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          <h4 className="text-xs font-bold text-orange-800">
            난방 배관 및 저장 손실 상세 (Heating System Loss Breakdown)
          </h4>
        </div>
        <div className="p-0">
          <Table className="text-[11px]">
            <TableHeader className="bg-orange-50/30">
              <TableRow className="hover:bg-transparent border-b-orange-100">
                <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일수 (<InlineMath math="d" />)</span></TooltipTrigger>
                    <TooltipContent className="max-w-xs p-2 text-[11px]">
                      <p className="font-bold mb-1">운전 일수 (<InlineMath math="d" />)</p>
                      해당 운전 모드(사용/비사용)의 월간 일수
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">배관길이 (<InlineMath math="L" />)</span></TooltipTrigger>
                    <TooltipContent className="max-w-xs p-2 text-[11px]">
                      <p className="font-bold mb-1">배관 길이 (<InlineMath math="L" />)</p>
                      난방 배관의 총 길이 (m)
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">열관류율 (<InlineMath math="U" />)</span></TooltipTrigger>
                    <TooltipContent className="max-w-xs p-2 text-[11px]">
                      <p className="font-bold mb-1">선형 열관류율 (<InlineMath math="U" />)</p>
                      배관의 단위 길이당 열관류율 (W/mK)
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">온도차 (<InlineMath math="\Delta \theta" />)</span></TooltipTrigger>
                    <TooltipContent className="max-w-xs p-2 text-[11px]">
                      <p className="font-bold mb-1">평균 온도차 (<InlineMath math="\Delta \theta" />)</p>
                      배관 내 열매체 평균 온도와 주위 온도의 차이 (K)
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right font-bold text-orange-700">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">배관손실 (<InlineMath math="Q_d" />)</span></TooltipTrigger>
                    <TooltipContent className="max-w-xs p-2 text-[11px]">
                      <p className="font-bold mb-1">배관 열손실 (<InlineMath math="Q_d" />)</p>
                      배관을 통한 월간 열손실 (kWh)
                      <div className="mt-1 text-slate-400">
                        <InlineMath math="Q_d = L \cdot U \cdot \Delta \theta \cdot t \cdot 10^{-3}" />
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">저장용량 (<InlineMath math="V_s" />)</span></TooltipTrigger>
                    <TooltipContent className="max-w-xs p-2 text-[11px]">
                      <p className="font-bold mb-1">저장 탱크 용량 (<InlineMath math="V_s" />)</p>
                      난방 버퍼 탱크의 용량 (Liter)
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일일손실 (<InlineMath math="Q_{s,d}" />)</span></TooltipTrigger>
                    <TooltipContent className="max-w-xs p-2 text-[11px]">
                      <p className="font-bold mb-1">일일 저장 손실 (<InlineMath math="Q_{s,d}" />)</p>
                      저장 탱크의 하루 당 열손실 (kWh/d)
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">저장손실 (<InlineMath math="Q_s" />)</span></TooltipTrigger>
                    <TooltipContent className="max-w-xs p-2 text-[11px]">
                      <p className="font-bold mb-1">저장 열손실 (<InlineMath math="Q_s" />)</p>
                      저장 탱크의 월간 총 열손실 (kWh)
                      <div className="mt-1 text-slate-400">
                        <InlineMath math="Q_s = Q_{s,d} \cdot d" />
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-50 border-b border-orange-50/50">
                <TableCell className="font-medium text-slate-700 flex items-center gap-1.5 pl-4">
                  <div className="w-1 h-1 rounded-full bg-orange-400" />
                  사용일 (Usage)
                </TableCell>
                <TableCell className="text-right text-slate-600">
                  {formatNum(
                    currentMonthData.systemLosses?.heating?.details?.distribution?.op?.hours && currentMonthData.t_h_op_d
                      ? currentMonthData.systemLosses.heating.details.distribution.op.hours / currentMonthData.t_h_op_d
                      : 0,
                    1
                  )}
                </TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.L, 1)} m</TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.U, 2)}</TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.op?.dT, 1)} K</TableCell>
                <TableCell className="text-right font-medium text-orange-600 bg-orange-50/10">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.op?.Q_loss, 1)}</TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.storage?.V_s, 1)} L</TableCell>
                <TableCell className="text-right text-slate-400">-</TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.storage?.op?.Q_loss, 1)}</TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-50 border-b border-orange-50/50">
                <TableCell className="font-medium text-slate-700 flex items-center gap-1.5 pl-4">
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  비사용일 (Non-Usage)
                </TableCell>
                <TableCell className="text-right text-slate-600">
                  {formatNum(
                    (currentMonthData.systemLosses?.heating?.details?.distribution?.non_op?.hours || 0) / 24,
                    1
                  )}
                </TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.L, 1)} m</TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.U, 2)}</TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.non_op?.dT, 1)} K</TableCell>
                <TableCell className="text-right font-medium text-orange-600 bg-orange-50/10">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.non_op?.Q_loss, 1)}</TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.storage?.V_s, 1)} L</TableCell>
                <TableCell className="text-right text-slate-400">-</TableCell>
                <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.storage?.non_op?.Q_loss, 1)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="bg-slate-50/30 px-4 py-2 border-t border-orange-100 flex items-center justify-end gap-x-6">
          <div className="text-[10px] text-slate-500 font-serif italic">
            <InlineMath math="Q_{sys} = Q_d + Q_s" />
          </div>
          <div className="text-[10px] text-slate-400 font-serif italic">
            <InlineMath math="Q_d = L \cdot U \cdot \Delta \theta \cdot t \cdot 10^{-3}" />, <InlineMath math="Q_s = Q_{s,d} \cdot d" />
          </div>
        </div>
      </div>
    </VerificationSection>
  );
}
