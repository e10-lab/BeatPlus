"use client";

import { useState, useCallback, useMemo } from "react";
import {
    ReactFlow,
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    BackgroundVariant,
    type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Props ──────────────────────────────────────────────
interface DataLineageDiagramProps {
    data: MonthlyResult[];
    totalArea: number;
}

// ─── Custom Node Data Types ─────────────────────────────
interface BaseNodeData {
    label: string;
    sublabel?: string;
    value?: string;
    unit?: string;
    tooltip?: string;
    color?: string;
    items?: { label: string; value: string; unit?: string }[];
    [key: string]: unknown;
}

// ─── Custom Node Components ─────────────────────────────

// Layer 1: Input Node (Zone parameters)
function InputNode({ data }: NodeProps<Node<BaseNodeData>>) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="px-4 py-3 rounded-xl border-2 border-sky-400 bg-gradient-to-br from-sky-50 to-white shadow-lg shadow-sky-100/50 min-w-[180px] cursor-default transition-all hover:shadow-xl hover:shadow-sky-200/50 hover:scale-[1.02]">
                        <Handle type="source" position={Position.Right} className="!bg-sky-400 !w-2.5 !h-2.5 !border-2 !border-white" />
                        <div className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider mb-1.5">
                            {data.sublabel || "Input"}
                        </div>
                        <div className="text-sm font-bold text-slate-800 mb-2">{data.label}</div>
                        {data.items && data.items.length > 0 && (
                            <div className="space-y-1 border-t border-sky-100 pt-2">
                                {data.items.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-500">{item.label}</span>
                                        <span className="font-mono font-semibold text-slate-700">
                                            {item.value} <span className="text-slate-400 text-[9px]">{item.unit}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {data.value && !data.items && (
                            <div className="text-lg font-mono font-bold text-sky-700">
                                {data.value} <span className="text-xs text-sky-400">{data.unit}</span>
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                {data.tooltip && (
                    <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">{data.tooltip}</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}

// Layer 2-4: Calculation Node (intermediate calculations)
function CalcNode({ data }: NodeProps<Node<BaseNodeData>>) {
    const borderColor = data.color || "emerald";
    const colorMap: Record<string, { border: string; bg: string; text: string; shadow: string; accent: string }> = {
        emerald: { border: "border-emerald-400", bg: "from-emerald-50 to-white", text: "text-emerald-700", shadow: "shadow-emerald-100/50", accent: "text-emerald-600" },
        amber: { border: "border-amber-400", bg: "from-amber-50 to-white", text: "text-amber-700", shadow: "shadow-amber-100/50", accent: "text-amber-600" },
        violet: { border: "border-violet-400", bg: "from-violet-50 to-white", text: "text-violet-700", shadow: "shadow-violet-100/50", accent: "text-violet-600" },
        rose: { border: "border-rose-400", bg: "from-rose-50 to-white", text: "text-rose-700", shadow: "shadow-rose-100/50", accent: "text-rose-600" },
        orange: { border: "border-orange-400", bg: "from-orange-50 to-white", text: "text-orange-700", shadow: "shadow-orange-100/50", accent: "text-orange-600" },
        slate: { border: "border-slate-400", bg: "from-slate-50 to-white", text: "text-slate-700", shadow: "shadow-slate-100/50", accent: "text-slate-600" },
    };
    const c = colorMap[borderColor] || colorMap.emerald;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`px-4 py-3 rounded-xl border-2 ${c.border} bg-gradient-to-br ${c.bg} shadow-lg ${c.shadow} min-w-[180px] cursor-default transition-all hover:shadow-xl hover:scale-[1.02]`}>
                        <Handle type="target" position={Position.Left} className={`!bg-slate-400 !w-2.5 !h-2.5 !border-2 !border-white`} />
                        <Handle type="source" position={Position.Right} className={`!bg-slate-400 !w-2.5 !h-2.5 !border-2 !border-white`} />
                        <div className={`text-[10px] font-semibold ${c.accent} uppercase tracking-wider mb-1.5`}>
                            {data.sublabel || "Calculation"}
                        </div>
                        <div className="text-sm font-bold text-slate-800 mb-1">{data.label}</div>
                        {data.items && data.items.length > 0 && (
                            <div className="space-y-1 border-t border-slate-100 pt-2 mt-1">
                                {data.items.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-500">{item.label}</span>
                                        <span className="font-mono font-semibold text-slate-700">
                                            {item.value} <span className="text-slate-400 text-[9px]">{item.unit}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {data.value && !data.items && (
                            <div className={`text-lg font-mono font-bold ${c.text} mt-1`}>
                                {data.value} <span className="text-xs opacity-60">{data.unit}</span>
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                {data.tooltip && (
                    <TooltipContent side="top" className="max-w-sm">
                        <p className="text-xs whitespace-pre-line">{data.tooltip}</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}

// Layer 5: Result Node (final heating/cooling demands)
function ResultNode({ data }: NodeProps<Node<BaseNodeData>>) {
    const isHeating = data.color === "heating";
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`px-5 py-4 rounded-2xl border-2 shadow-xl min-w-[160px] cursor-default transition-all hover:scale-[1.03] ${isHeating
                        ? "border-red-400 bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-red-200/60"
                        : "border-blue-400 bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-blue-200/60"
                        }`}>
                        <Handle type="target" position={Position.Left} className="!bg-white !w-3 !h-3 !border-2 !border-slate-300" />
                        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-1">
                            {data.sublabel || "Result"}
                        </div>
                        <div className="text-sm font-bold mb-1">{data.label}</div>
                        <div className="text-2xl font-mono font-black">
                            {data.value} <span className="text-sm font-normal opacity-70">{data.unit}</span>
                        </div>
                    </div>
                </TooltipTrigger>
                {data.tooltip && (
                    <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">{data.tooltip}</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}

const nodeTypes = {
    input_custom: InputNode,
    calc: CalcNode,
    result: ResultNode,
};

// ─── Month Names ────────────────────────────────────────
const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

// ─── Helper ─────────────────────────────────────────────
function fmt(v: number | undefined, decimals = 1): string {
    if (v === undefined || v === null || isNaN(v)) return "—";
    return v.toFixed(decimals);
}

// ─── Build Nodes & Edges ────────────────────────────────
function buildNodesAndEdges(m: MonthlyResult, area: number): { nodes: Node<BaseNodeData>[]; edges: Edge[] } {
    const RHO_C = 0.34;
    const V = m.V_net || 0;

    // Positional constants
    const COL = [0, 280, 560, 840, 1120]; // x positions for 5 layers
    const ROW_GAP = 160;

    const nodes: Node<BaseNodeData>[] = [];
    const edges: Edge[] = [];

    // ─── Layer 1: Zone Inputs ───
    nodes.push({
        id: "zone_phys",
        type: "input_custom",
        position: { x: COL[0], y: 0 },
        data: {
            label: "존 물리량",
            sublabel: "Zone Physical",
            tooltip: "기본 존 형상 파라미터 (면적, 높이, 체적)",
            items: [
                { label: "A_NGF", value: fmt(m.A_NGF, 1), unit: "m²" },
                { label: "h_R", value: fmt(m.roomHeight, 2), unit: "m" },
                { label: "V_net", value: fmt(V, 1), unit: "m³" },
            ],
        },
    });

    nodes.push({
        id: "zone_temp",
        type: "input_custom",
        position: { x: COL[0], y: ROW_GAP * 1.5 },
        data: {
            label: "설정 온도",
            sublabel: "Setpoints",
            tooltip: "난방/냉방 실내 설정온도 및 외기온도",
            items: [
                { label: "θ_i,h", value: fmt(m.Theta_i_h || m.avg_Ti, 1), unit: "°C" },
                { label: "θ_i,c", value: fmt(m.Theta_int_C, 1), unit: "°C" },
                { label: "θ_e", value: fmt(m.Theta_e, 1), unit: "°C" },
            ],
        },
    });

    nodes.push({
        id: "zone_vent",
        type: "input_custom",
        position: { x: COL[0], y: ROW_GAP * 3 },
        data: {
            label: "환기 파라미터",
            sublabel: "Ventilation Params",
            tooltip: "침기, 창문환기, 기계환기 계수",
            items: [
                { label: "n_inf", value: fmt(m.n_inf, 4), unit: "1/h" },
                { label: "n_win", value: fmt(m.n_win, 4), unit: "1/h" },
                { label: "n_mech", value: fmt(m.n_mech, 4), unit: "1/h" },
                { label: "η_WRG", value: fmt((m.heatRecoveryEff || 0) * 100, 0), unit: "%" },
            ],
        },
    });

    // ─── Layer 2: Heat Transfer Coefficients ───
    const H_tr = m.H_tr || m.H_tr_total || 0;
    const H_ve = m.H_ve || m.H_ve_total || 0;

    nodes.push({
        id: "h_tr",
        type: "calc",
        position: { x: COL[1], y: ROW_GAP * 0.3 },
        data: {
            label: "H_tr (관류 열전달계수)",
            sublabel: "Transmission",
            color: "emerald",
            value: fmt(H_tr, 1),
            unit: "W/K",
            tooltip: `H_tr = H_D + H_g + H_u + H_A + H_WB\n= ${fmt(m.H_tr_D)} + ${fmt(m.H_tr_g)} + ${fmt(m.H_tr_u)} + ${fmt(m.H_tr_A)} + ${fmt(m.H_tr_WB)} W/K`,
        },
    });

    nodes.push({
        id: "h_ve",
        type: "calc",
        position: { x: COL[1], y: ROW_GAP * 2 },
        data: {
            label: "H_ve (환기 열전달계수)",
            sublabel: "Ventilation",
            color: "amber",
            tooltip: `H_ve = V × ρc × (n_inf + n_win + n_mech)\n= ${fmt(V)} × 0.34 × (${fmt(m.n_inf, 4)} + ${fmt(m.n_win, 4)} + ${fmt(m.n_mech, 4)})`,
            items: [
                { label: "H_ve,inf", value: fmt(m.H_ve_inf || V * RHO_C * (m.n_inf || 0), 1), unit: "W/K" },
                { label: "H_ve,win", value: fmt(m.H_ve_win || V * RHO_C * (m.n_win || 0), 1), unit: "W/K" },
                { label: "H_ve,mech", value: fmt(m.H_ve_mech || V * RHO_C * (m.n_mech || 0), 1), unit: "W/K" },
                { label: "H_ve,total", value: fmt(H_ve, 1), unit: "W/K" },
            ],
        },
    });

    // ─── Layer 3: Energy Components ───
    nodes.push({
        id: "q_t",
        type: "calc",
        position: { x: COL[2], y: 0 },
        data: {
            label: "Q_T (관류 열손실)",
            sublabel: "Transmission Loss",
            color: "emerald",
            value: fmt(m.QT, 1),
            unit: "kWh",
            tooltip: `Q_T = H_tr × (θ_i - θ_e) × t\n= ${fmt(H_tr)} × ΔT × ${fmt(m.hours)} h\n단위면적: ${fmt((m.QT || 0) / area, 1)} kWh/m²`,
        },
    });

    nodes.push({
        id: "q_v",
        type: "calc",
        position: { x: COL[2], y: ROW_GAP },
        data: {
            label: "Q_V (환기 열손실)",
            sublabel: "Ventilation Loss",
            color: "amber",
            value: fmt(m.QV, 1),
            unit: "kWh",
            tooltip: `Q_V = H_ve × (θ_i - θ_e) × t\n= ${fmt(H_ve)} × ΔT × ${fmt(m.hours)} h\n단위면적: ${fmt((m.QV || 0) / area, 1)} kWh/m²`,
        },
    });

    nodes.push({
        id: "q_s",
        type: "calc",
        position: { x: COL[2], y: ROW_GAP * 2 },
        data: {
            label: "Q_S (일사 취득)",
            sublabel: "Solar Gain",
            color: "orange",
            value: fmt(m.QS, 1),
            unit: "kWh",
            tooltip: `Q_S = Σ(I_sol × g × A_w × F_sh)\n단위면적: ${fmt((m.QS || 0) / area, 1)} kWh/m²`,
        },
    });

    nodes.push({
        id: "q_i",
        type: "calc",
        position: { x: COL[2], y: ROW_GAP * 3 },
        data: {
            label: "Q_I (내부 발열)",
            sublabel: "Internal Gain",
            color: "rose",
            value: fmt(m.QI, 1),
            unit: "kWh",
            tooltip: `Q_I = q_i × A_NGF × t_nutz\n단위면적: ${fmt((m.QI || 0) / area, 1)} kWh/m²`,
        },
    });

    // ─── Layer 4: Balance ───
    nodes.push({
        id: "balance",
        type: "calc",
        position: { x: COL[3], y: ROW_GAP * 0.8 },
        data: {
            label: "에너지 밸런스",
            sublabel: "Energy Balance",
            color: "violet",
            tooltip: `Q_loss = Q_T + Q_V\nQ_gain = Q_S + Q_I\nγ_H = Q_gain / Q_loss\nη_H = 이용 효율`,
            items: [
                { label: "Q_loss", value: fmt(m.Qloss, 1), unit: "kWh" },
                { label: "Q_gain", value: fmt(m.Qgain, 1), unit: "kWh" },
                { label: "γ_H", value: fmt(m.gamma, 3) },
                { label: "η_H", value: fmt(m.eta, 3) },
                { label: "τ", value: fmt(m.tau_h || m.tau, 1), unit: "h" },
                { label: "a_H", value: fmt(m.a_H, 2) },
            ],
        },
    });

    nodes.push({
        id: "balance_cool",
        type: "calc",
        position: { x: COL[3], y: ROW_GAP * 2.8 },
        data: {
            label: "냉방 밸런스",
            sublabel: "Cooling Balance",
            color: "slate",
            tooltip: `γ_C = Q_loss / Q_gain (냉방: 역비)\nη_C = 냉방 이용률`,
            items: [
                { label: "γ_C", value: fmt(m.gamma_C, 3) },
                { label: "η_C", value: fmt(m.eta_C, 3) },
                { label: "τ_c", value: fmt(m.tau_c || m.tau, 1), unit: "h" },
                { label: "a_C", value: fmt(m.a_C, 2) },
            ],
        },
    });

    // ─── Layer 5: Results ───
    nodes.push({
        id: "q_heating",
        type: "result",
        position: { x: COL[4], y: ROW_GAP * 0.5 },
        data: {
            label: "난방 요구량",
            sublabel: "Heating Demand",
            color: "heating",
            value: fmt(m.Q_h_b, 1),
            unit: "kWh",
            tooltip: `Q_h = Q_loss - η_H × Q_gain\n= ${fmt(m.Qloss)} - ${fmt(m.eta)} × ${fmt(m.Qgain)}\n= ${fmt(m.Q_h_b)} kWh\n단위면적: ${fmt((m.Q_h_b || 0) / area, 1)} kWh/m²`,
        },
    });

    nodes.push({
        id: "q_cooling",
        type: "result",
        position: { x: COL[4], y: ROW_GAP * 2.5 },
        data: {
            label: "냉방 요구량",
            sublabel: "Cooling Demand",
            color: "cooling",
            value: fmt(m.Q_c_b, 1),
            unit: "kWh",
            tooltip: `Q_c = Q_gain - η_C × Q_loss\n= ${fmt(m.Qgain)} - ${fmt(m.eta_C)} × ${fmt(m.Qloss)}\n= ${fmt(m.Q_c_b)} kWh\n단위면적: ${fmt((m.Q_c_b || 0) / area, 1)} kWh/m²`,
        },
    });

    // ─── Edges ──────────────────────────────────────────
    const edgeDefaults = {
        animated: true,
        style: { strokeWidth: 2 },
    };

    // Layer 1 → Layer 2
    edges.push({ id: "e-phys-htr", source: "zone_phys", target: "h_tr", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#38bdf8" } });
    edges.push({ id: "e-phys-hve", source: "zone_phys", target: "h_ve", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#38bdf8" } });
    edges.push({ id: "e-vent-hve", source: "zone_vent", target: "h_ve", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#fbbf24" } });

    // Layer 2 → Layer 3
    edges.push({ id: "e-htr-qt", source: "h_tr", target: "q_t", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#34d399" } });
    edges.push({ id: "e-hve-qv", source: "h_ve", target: "q_v", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#fbbf24" } });
    edges.push({ id: "e-temp-qt", source: "zone_temp", target: "q_t", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#818cf8" } });
    edges.push({ id: "e-temp-qv", source: "zone_temp", target: "q_v", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#818cf8" } });

    // Layer 3 → Layer 4
    edges.push({ id: "e-qt-bal", source: "q_t", target: "balance", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#34d399" }, label: "손실" });
    edges.push({ id: "e-qv-bal", source: "q_v", target: "balance", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#fbbf24" }, label: "손실" });
    edges.push({ id: "e-qs-bal", source: "q_s", target: "balance", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#fb923c" }, label: "취득" });
    edges.push({ id: "e-qi-bal", source: "q_i", target: "balance", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#fb7185" }, label: "취득" });

    edges.push({ id: "e-qt-balc", source: "q_t", target: "balance_cool", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#94a3b8" } });
    edges.push({ id: "e-qv-balc", source: "q_v", target: "balance_cool", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#94a3b8" } });
    edges.push({ id: "e-qs-balc", source: "q_s", target: "balance_cool", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#94a3b8" } });
    edges.push({ id: "e-qi-balc", source: "q_i", target: "balance_cool", ...edgeDefaults, style: { ...edgeDefaults.style, stroke: "#94a3b8" } });

    // Layer 4 → Layer 5
    edges.push({ id: "e-bal-qh", source: "balance", target: "q_heating", ...edgeDefaults, style: { strokeWidth: 3, stroke: "#ef4444" } });
    edges.push({ id: "e-balc-qc", source: "balance_cool", target: "q_cooling", ...edgeDefaults, style: { strokeWidth: 3, stroke: "#3b82f6" } });

    return { nodes, edges };
}

// ─── Main Component ─────────────────────────────────────
export function DataLineageDiagram({ data, totalArea }: DataLineageDiagramProps) {
    const [selectedMonth, setSelectedMonth] = useState(1);

    const monthData = useMemo(() => {
        return data.find(d => d.month === selectedMonth) || data[0];
    }, [data, selectedMonth]);

    const { nodes: initialNodes, edges: initialEdges } = useMemo(
        () => buildNodesAndEdges(monthData, totalArea),
        [monthData, totalArea]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Update nodes/edges when month changes
    const prevMonthRef = useMemo(() => ({ current: selectedMonth }), []);
    if (prevMonthRef.current !== selectedMonth) {
        prevMonthRef.current = selectedMonth;
        setNodes(initialNodes);
        setEdges(initialEdges);
    }

    // Summary bar data
    const summaryItems = useMemo(() => {
        if (!monthData) return [];
        const area = totalArea > 0 ? totalArea : 1;
        return [
            { label: "Q_T", value: `${fmt(monthData.QT, 1)} kWh`, sub: `${fmt(monthData.QT / area, 1)} kWh/m²`, color: "text-emerald-600" },
            { label: "Q_V", value: `${fmt(monthData.QV, 1)} kWh`, sub: `${fmt(monthData.QV / area, 1)} kWh/m²`, color: "text-amber-600" },
            { label: "Q_S", value: `${fmt(monthData.QS, 1)} kWh`, sub: `${fmt(monthData.QS / area, 1)} kWh/m²`, color: "text-orange-600" },
            { label: "Q_I", value: `${fmt(monthData.QI, 1)} kWh`, sub: `${fmt(monthData.QI / area, 1)} kWh/m²`, color: "text-rose-600" },
            { label: "Q_h", value: `${fmt(monthData.Q_h_b, 1)} kWh`, sub: `${fmt(monthData.Q_h_b / area, 1)} kWh/m²`, color: "text-red-600" },
            { label: "Q_c", value: `${fmt(monthData.Q_c_b, 1)} kWh`, sub: `${fmt(monthData.Q_c_b / area, 1)} kWh/m²`, color: "text-blue-600" },
        ];
    }, [monthData, totalArea]);

    if (!data || data.length === 0) {
        return <div className="text-center text-muted-foreground p-8">계산 데이터가 없습니다.</div>;
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <span className="text-xl">🔀</span> 데이터 계보도 (Data Lineage)
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            존 입력값에서 최종 에너지 요구량까지의 계산 흐름
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">월 선택:</span>
                        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MONTH_NAMES.map((name, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Summary Bar */}
                <div className="flex gap-4 mt-3 pt-3 border-t overflow-x-auto">
                    {summaryItems.map((item) => (
                        <div key={item.label} className="flex flex-col items-center min-w-[80px]">
                            <span className={`text-xs font-semibold ${item.color}`}>{item.label}</span>
                            <span className="text-sm font-mono font-bold text-slate-800">{item.value}</span>
                            <span className="text-[10px] text-slate-400">{item.sub}</span>
                        </div>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div style={{ width: "100%", height: "650px" }} className="border-t">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        minZoom={0.3}
                        maxZoom={2}
                        proOptions={{ hideAttribution: true }}
                        defaultEdgeOptions={{
                            type: "smoothstep",
                            animated: true,
                        }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
                        <Controls
                            showInteractive={false}
                            className="!bg-white/80 !backdrop-blur-sm !border !border-slate-200 !rounded-lg !shadow-lg"
                        />
                        <MiniMap
                            nodeColor={(node) => {
                                if (node.type === "result") return node.data?.color === "heating" ? "#ef4444" : "#3b82f6";
                                if (node.type === "input_custom") return "#38bdf8";
                                return "#a3e635";
                            }}
                            className="!bg-white/80 !backdrop-blur-sm !border !border-slate-200 !rounded-lg"
                            maskColor="rgba(0,0,0,0.08)"
                        />
                    </ReactFlow>
                </div>
            </CardContent>
        </Card>
    );
}
