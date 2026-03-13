"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Droplets } from "lucide-react";
import { Latex } from "@/components/ui/latex";
import { formatNum } from "../../utils/formatters";
import { VerificationSection, MathTooltip } from "../shared/verification-ui";

interface DHWSectionProps {
  currentMonthData: any;
  zone: any;
  isExpanded: boolean;
  onToggle: () => void;
}

export function DHWSection({
  currentMonthData,
  zone,
  isExpanded,
  onToggle
}: DHWSectionProps) {
  return (
    <VerificationSection 
      step="Step 5" 
      title="급탕 요구량 및 열획득 상세 (DHW Verification)"
      collapsible
      isExpanded={isExpanded}
      onToggle={onToggle}
      rightElement={<div className="text-blue-700 font-bold text-sm">{formatNum(currentMonthData.Q_w_b, 1)} kWh/월</div>}
      className="border-blue-100"
    >
      <div className="rounded-md border border-blue-100 overflow-hidden bg-white">
        <Table className="text-xs">
          <TableHeader className="bg-blue-50/50">
            <TableRow className="hover:bg-transparent border-b-blue-100">
              <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
              <TableHead className="text-right">
                <MathTooltip math="A_{NGF}" title="참조 바닥 면적 (A_{NGF}) 급탕 수요가 발생하는 유효 바닥 면적 (Nettogrundfläche)">면적 (m²)</MathTooltip>
              </TableHead>
              <TableHead className="text-right">
                <MathTooltip math="q_{w,b,day}" title="급탕 원단위 (q_{w,b,day}) 단위 면적당 일일 급탕 에너지 요구량 (Wh/m²d)">원단위 (Wh/m²d)</MathTooltip>
              </TableHead>
              <TableHead className="text-right">
                <MathTooltip math="d" title="운영 일수 (d) 월간 급탕 설비 가동 일수">일수 (d)</MathTooltip>
              </TableHead>
              <TableHead className="text-right font-bold text-blue-700">
                <MathTooltip math="Q_{w,b}" title="급탕 에너지 요구량 (Q_{w,b}) 최종 유효 급탕 에너지 수요 (kWh/월) <div className='mt-1 text-slate-400'><Latex formula='Q_{w,b} = q_{w,b,day} \cdot A_{NGF} \cdot d \cdot 10^{-3}' /></div>">요구량 (kWh)</MathTooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
              <TableCell className="font-medium flex items-center gap-1.5">
                <Droplets className="h-3 w-3 text-blue-400" />
                사용일 (Usage)
              </TableCell>
              <TableCell className="text-right font-mono text-slate-600 font-medium">{formatNum(currentMonthData.internalGains?.metadata?.A_NGF || zone?.area, 1)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.q_w_b_day, 1)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.d_nutz, 2)}</TableCell>
              <TableCell className="text-right font-mono font-medium text-blue-700">{formatNum(currentMonthData.internalGains?.op?.Q_w_b, 1)}</TableCell>
            </TableRow>
            <TableRow className="hover:bg-slate-50 border-b border-blue-50/50 italic opacity-85">
              <TableCell className="font-medium flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full border border-slate-300" />
                비사용일 (Non-op)
              </TableCell>
              <TableCell className="text-right font-mono text-slate-400">-</TableCell>
              <TableCell className="text-right font-mono text-slate-400">-</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.d_non, 2)}</TableCell>
              <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.non_op?.Q_w_b, 1)}</TableCell>
            </TableRow>
            <TableRow className="bg-blue-50/20 hover:bg-blue-50/40 font-bold border-t-2 border-blue-100">
              <TableCell className="text-blue-800">월간 합계 (Total)</TableCell>
              <TableCell className="text-right font-mono text-slate-400 italic font-normal">Sum</TableCell>
              <TableCell className="text-right font-mono text-slate-400 italic font-normal">-</TableCell>
              <TableCell className="text-right font-mono text-slate-600 font-medium">{formatNum((currentMonthData.internalGains?.metadata?.d_nutz || 0) + (currentMonthData.internalGains?.metadata?.d_non || 0), 2)}</TableCell>
              <TableCell className="text-right font-mono text-blue-700 font-bold text-[13px]">{formatNum(currentMonthData.Q_w_b, 1)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="bg-slate-50/30 px-4 py-2 border-t border-blue-100 flex flex-wrap items-center justify-end gap-x-6">
          <div className="text-[10px] text-slate-500 font-serif italic">
            <Latex formula="Q_{w,b} = q_{w,b,day} \cdot A_{NGF} \cdot d_{op} \cdot 10^{-3}" />
          </div>
          <div className="text-[10px] text-slate-400 font-serif italic">
            * 배관 및 저장 손실 상세 내역은 하단 테이블 참조
          </div>
        </div>
      </div>

      {/* 급탕 배관 및 저장 손실 상세 */}
      <div className="mt-6 bg-white rounded-md border border-blue-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <h4 className="text-xs font-bold text-blue-800">
            급탕 배관 및 저장 손실 상세 (DHW Loss Breakdown)
          </h4>
        </div>
        <div className="p-0">
          <Table className="text-[11px]">
            <TableHeader className="bg-blue-50/30">
              <TableRow className="hover:bg-transparent border-b-blue-100">
                <TableHead className="w-20 text-slate-600">구분</TableHead>
                <TableHead className="text-right">
                  <MathTooltip math="d" title="운영 일수">일수 (d)</MathTooltip>
                </TableHead>
                <TableHead className="text-right text-slate-500">
                  <MathTooltip math="L_{w,d}" title="급탕 배관의 총 길이. 기본 산정식: L_{w,d} = 10 + 0.1 \cdot A_{NGF}">배관길이</MathTooltip>
                </TableHead>
                <TableHead className="text-right text-slate-500">
                  <MathTooltip math="U_l" title="선형 열관류율 (W/mK). 표준 단열 기준: 0.25 W/mK">열관류율</MathTooltip>
                </TableHead>
                <TableHead className="text-right text-slate-500">
                  <MathTooltip math="\theta_{w,av} - \theta_i" title="배관 내 온수 평균 온도와 주위 실내 온도의 차이. \Delta \theta = 60^\circ\text{C} - \theta_i">온도차</MathTooltip>
                </TableHead>
                <TableHead className="text-right font-semibold text-blue-700">
                  <MathTooltip math="Q_{w,d}" title="배관 표면을 통해 손실되는 열량. Q_{w,d} = L_{w,d} \cdot U_l \cdot \Delta \theta \cdot 24 \cdot d">배관손실</MathTooltip>
                </TableHead>
                <TableHead className="text-right text-slate-500">
                  <MathTooltip math="V_s" title="저장 탱크 용량. V_s = \max(30, (A_{NGF} / 40) \cdot 100)">저장용량</MathTooltip>
                </TableHead>
                <TableHead className="text-right text-slate-500">
                  <MathTooltip math="q_{w,s,day}" title="저장 탱크의 하루 대기 열손실량. q_{w,s,day} = (0.8 + 0.02 \cdot V_s^{0.77}) \cdot 10^3">일일손실</MathTooltip>
                </TableHead>
                <TableHead className="text-right font-semibold text-blue-700">
                  <MathTooltip math="Q_{w,s}" title="저장 탱크에서 발생하는 월간 총 열손실. Q_{w,s} = q_{w,s,day} \cdot d \cdot 10^{-3}">저장손실</MathTooltip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                <TableCell className="font-medium text-slate-700">사용일</TableCell>
                <TableCell className="text-right font-mono">{formatNum(currentMonthData.internalGains?.metadata?.d_nutz, 2)}</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.L_w_d, 1)} m</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.U_l_w_d, 2)}</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.dT_pipe, 1)} K</TableCell>
                <TableCell className="text-right font-mono font-medium text-blue-600">{formatNum(currentMonthData.internalGains?.op?.Q_w_d, 1)}</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.V_storage, 0)} L</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.q_w_s_day, 1)} Wh</TableCell>
                <TableCell className="text-right font-mono font-medium text-blue-600">{formatNum(currentMonthData.internalGains?.op?.Q_w_s, 1)}</TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                <TableCell className="font-medium text-slate-500">비사용일</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.d_non, 2)}</TableCell>
                <TableCell className="text-right font-mono text-slate-300">-</TableCell>
                <TableCell className="text-right font-mono text-slate-300">-</TableCell>
                <TableCell className="text-right font-mono text-slate-300">-</TableCell>
                <TableCell className="text-right font-mono text-slate-400">{formatNum(currentMonthData.internalGains?.non_op?.Q_w_d, 1)}</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.V_storage, 0)} L</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.q_w_s_day, 1)} Wh</TableCell>
                <TableCell className="text-right font-mono font-medium text-blue-600">{formatNum(currentMonthData.internalGains?.non_op?.Q_w_s, 1)}</TableCell>
              </TableRow>
              <TableRow className="bg-blue-50/20 font-bold text-blue-900">
                <TableCell>합계</TableCell>
                <TableCell className="text-right font-mono">{formatNum((currentMonthData.internalGains?.metadata?.d_nutz || 0) + (currentMonthData.internalGains?.metadata?.d_non || 0), 2)}</TableCell>
                <TableCell className="text-right text-slate-300">-</TableCell>
                <TableCell className="text-right text-slate-300">-</TableCell>
                <TableCell className="text-right text-slate-300">-</TableCell>
                <TableCell className="text-right font-mono">{formatNum(currentMonthData.internalGains?.metadata?.Q_w_d, 1)}</TableCell>
                <TableCell className="text-right text-slate-300">-</TableCell>
                <TableCell className="text-right text-slate-300">-</TableCell>
                <TableCell className="text-right font-mono">{formatNum(currentMonthData.internalGains?.metadata?.Q_w_s, 1)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-3 bg-slate-50/30 border-t border-blue-50 mt-6 md:px-4">
        <div className="text-[10px] text-blue-800 font-serif opacity-80">
          <Latex formula="Q_{w,d} = L_{w,d} \cdot U_l \cdot (\theta_{w,av} - \theta_i) \cdot 24 \cdot d \cdot 10^{-3}" />
        </div>
        <div className="text-[10px] text-blue-800 font-serif opacity-80">
          <Latex formula="Q_{w,s} = q_{w,s,day} \cdot d \cdot 10^{-3}" />
        </div>
      </div>
    </VerificationSection>
  );
}
