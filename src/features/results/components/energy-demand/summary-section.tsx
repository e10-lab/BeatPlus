"use client";

import React from "react";
import { MonthlyResult } from "@/engine/types";
import { Flame, ThermometerSnowflake, Droplets, Zap } from "lucide-react";
import { Latex } from "@/components/ui/latex";
import { formatNum } from "../../utils/formatters";
import { VerificationSection } from "../shared/verification-ui";

interface SummarySectionProps {
  currentMonthData: any;
  h: any;
  c: any;
  isExpanded: boolean;
  onToggle: () => void;
}

export function SummarySection({
  currentMonthData,
  h,
  c,
  isExpanded,
  onToggle
}: SummarySectionProps) {
  return (
    <VerificationSection 
      step="Step 1" 
      title="에너지 요구량 요약 (Energy Demand Summary)"
      collapsible
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-red-50 border border-red-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-red-500" />
              <div className="text-xs text-red-600 font-medium">난방 요구량 (Heating)</div>
            </div>
            <div className="text-2xl font-bold text-red-700">{formatNum(currentMonthData.Q_h_b)} <span className="text-sm font-normal">kWh/월</span></div>
          </div>
          <div className="text-[10px] text-red-400 mt-2 font-mono italic flex justify-between items-center">
            <Latex formula="Q_{h,b}" />
            <span className="text-[9px] opacity-70">Util: {formatNum(h?.eta, 3)}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ThermometerSnowflake className="h-4 w-4 text-blue-500" />
              <div className="text-xs text-blue-600 font-medium">냉방 요구량 (Cooling)</div>
            </div>
            <div className="text-2xl font-bold text-blue-700">{formatNum(currentMonthData.Q_c_b)} <span className="text-sm font-normal">kWh/월</span></div>
          </div>
          <div className="text-[10px] text-blue-400 mt-2 font-mono italic flex justify-between items-center">
            <Latex formula="Q_{c,b}" />
            <span className="text-[9px] opacity-70">Util: {formatNum(c?.eta, 3)}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-cyan-50 border border-cyan-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="h-4 w-4 text-cyan-500" />
              <div className="text-xs text-cyan-600 font-medium">급탕 요구량 (DHW)</div>
            </div>
            <div className="text-2xl font-bold text-cyan-700">{formatNum(currentMonthData.Q_w_b)} <span className="text-sm font-normal">kWh/월</span></div>
          </div>
          <div className="text-[10px] text-cyan-400 mt-2 font-mono italic">
            <Latex formula="Q_{w,b}" />
          </div>
        </div>
        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <div className="text-xs text-yellow-600 font-medium">조명 요구량 (Lighting)</div>
            </div>
            <div className="text-2xl font-bold text-yellow-700">{formatNum(currentMonthData.Q_l_b)} <span className="text-sm font-normal">kWh/월</span></div>
          </div>
          <div className="text-[10px] text-yellow-500 mt-2 font-mono italic">
            <Latex formula="Q_{l,b}" />
          </div>
        </div>
      </div>
    </VerificationSection>
  );
}
