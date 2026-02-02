import React, { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import {
    FormControl,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, Info } from "lucide-react";

/**
 * Generator Selection Component
 * Handles the dependent selection logic for System Type (Medium) -> Generator/Fuel
 */

interface GeneratorSelectionProps {
    form: UseFormReturn<any>;
    mode: "HEATING" | "COOLING";
}

// Data Definitions
const SYSTEM_METHOD_LABELS: Record<string, string> = {
    hydronic: "수배관 방식 (보일러/히트펌프/칠러)",
    refrigerant: "냉매 방식 (시스템 에어컨/EHP)",
    district: "지역 공급 방식",
    electric_local: "개별 전열 방식",
};

const SYSTEM_METHOD_DESCRIPTIONS: Record<string, string> = {
    hydronic: "물을 냉/열매체로 사용하여 에어컨(FCU)이나 바닥으로 공급합니다. 대형 건물에 주로 쓰입니다.",
    refrigerant: "냉매 파이프를 통해 실내기에서 직접 열교환합니다. 학교, 오피스, 상가 등에 주로 쓰입니다 (EHP/VRF).",
    district: "지역난방공사 등 외부에서 공급된 열/냉수를 그대로 사용합니다.",
    electric_local: "바닥 전기 판넬, 전기 라디에이터 등 개별적인 전열 기구를 사용합니다.",
};

// Mappings & Tooltips
const HEATING_OPTIONS = {
    hydronic: [
        { label: "콘덴싱 보일러 (가스)", type: "condensing_boiler", energyCarrier: "natural_gas", desc: "가스를 연소하여 온수를 만듭니다. 효율이 높습니다." },
        { label: "일반 보일러 (등유/LPG)", type: "std_boiler", energyCarrier: "oil", desc: "기름이나 LPG를 사용하는 일반적인 보일러입니다." },
        { label: "히트펌프 칠러 (공기열)", type: "heat_pump", energyCarrier: "electricity", heatSource: "outdoor_air", desc: "외부 공기의 열을 흡수하여 온수를 만듭니다. (에어컨의 반대 원리)" },
        { label: "히트펌프 칠러 (지열)", type: "heat_pump", energyCarrier: "electricity", heatSource: "ground_brine", desc: "땅속의 열을 흡수하여 온수를 만듭니다. 효율이 매우 좋습니다." },
        { label: "전기 보일러", type: "electric", energyCarrier: "electricity", desc: "전기 히터로 물을 데웁니다. 설치는 간편하나 운전 비용이 높을 수 있습니다." },
    ],
    refrigerant: [
        { label: "시스템 에어컨 (EHP - 전기)", type: "ehp", energyCarrier: "electricity", heatSource: "outdoor_air", desc: "전기를 사용하여 냉매를 압축하는 히트펌프 시스템입니다." },
        { label: "시스템 에어컨 (GHP - 가스)", type: "ehp", energyCarrier: "natural_gas", heatSource: "outdoor_air", desc: "가스 엔진으로 압축기를 구동합니다. 전력 사용량이 적습니다." },
        { label: "개별 에어컨 (가정용)", type: "split", energyCarrier: "electricity", heatSource: "outdoor_air", desc: "일반적인 가정용 벽걸이/스탠드 에어컨입니다." },
    ],
    district: [
        { label: "지역 난방", type: "district", energyCarrier: "district_heating", desc: "열병합 발전소 등에서 공급되는 온수를 사용합니다." },
    ],
    electric_local: [
        { label: "전기 난방 (바닥판넬 등)", type: "electric", energyCarrier: "electricity", desc: "전기 필름, 판넬 등 국소적인 난방 장치입니다." },
    ]
};

const COOLING_OPTIONS = {
    hydronic: [
        { label: "터보/스크류 냉동기 (전기)", type: "compression_chiller", energyCarrier: "electricity", desc: "냉방 전용 장비입니다. 대용량 냉방에 효율적입니다. 난방 불가." },
        { label: "흡수식 냉동기 (가스/온수)", type: "absorption_chiller", energyCarrier: "natural_gas", desc: "가스나 폐열(온수)을 이용하여 냉수를 만듭니다. 전기를 적게 씁니다." },
        { label: "히트펌프 칠러 (공기열)", type: "heat_pump", energyCarrier: "electricity", heatSource: "outdoor_air", desc: "냉방과 난방이 모두 가능한 장비입니다. (4-Way 밸브 사용)" },
        { label: "히트펌프 칠러 (지열)", type: "heat_pump", energyCarrier: "electricity", heatSource: "ground_brine", desc: "지열을 이용하여 냉방 효율이 매우 우수합니다." },
    ],
    refrigerant: [
        { label: "시스템 에어컨 (EHP - 전기)", type: "ehp", energyCarrier: "electricity", heatSource: "outdoor_air", desc: "실외기 하나에 여러 실내기를 연결하여 냉방합니다." },
        { label: "시스템 에어컨 (GHP - 가스)", type: "ehp", energyCarrier: "natural_gas", heatSource: "outdoor_air", desc: "가스를 연료로 사용하여 냉방합니다." },
        { label: "개별 에어컨 (가정용)", type: "split", energyCarrier: "electricity", heatSource: "outdoor_air", desc: "개별 실외기와 실내기가 1:1 또는 소규모로 연결됩니다." },
    ],
    district: [
        { label: "지역 냉방", type: "compression_chiller", energyCarrier: "district_heating", desc: "지역난방 열원을 이용한 흡수식 냉동이나 지역 냉수 공급을 의미합니다." },
    ]
};

export function GeneratorSelection({ form, mode }: GeneratorSelectionProps) {
    // Current Values
    const currentType = form.watch("generator.type");
    const currentCarrier = form.watch("generator.energyCarrier");
    const currentHeatSource = form.watch("generator.heatSource");

    // Infer current method based on type/carrier
    const inferMethod = (): string => {
        if (["ehp", "split"].includes(currentType)) return "refrigerant";
        if (currentType === "district") return "district";
        if (mode === "HEATING") {
            if (currentType === "electric" && currentCarrier === "electricity") {
                return "hydronic";
            }
        }
        if (mode === "COOLING") {
            if (currentCarrier === "district_heating") return "district";
        }
        return "hydronic"; // Default
    };

    const [method, setMethod] = useState<string>(inferMethod());

    // Update method if external changes happen
    useEffect(() => {
        const inferred = inferMethod();
        if (inferred !== method) {
            // setMethod(inferred);
        }
    }, [currentType, currentCarrier]);

    const OPTIONS_MAP = mode === "HEATING" ? HEATING_OPTIONS : COOLING_OPTIONS;

    const handleMethodChange = (newMethod: string) => {
        setMethod(newMethod);
        const defaultOption = (OPTIONS_MAP as any)[newMethod][0];
        if (defaultOption) {
            form.setValue("generator.type", defaultOption.type);
            form.setValue("generator.energyCarrier", defaultOption.energyCarrier);
            form.setValue("generator.heatSource", defaultOption.heatSource);
        }
    };

    const handleSourceChange = (val: string) => {
        const [t, ec, hs] = val.split(":");
        form.setValue("generator.type", t);
        form.setValue("generator.energyCarrier", ec);
        form.setValue("generator.heatSource", hs || undefined);
    };

    const sourceOptions = (OPTIONS_MAP as any)[method] || [];
    const currentSourceValue = `${currentType}:${currentCarrier}${currentHeatSource ? `:${currentHeatSource}` : ""}`;

    // Helper to get description for current selection
    const currentSourceDesc = sourceOptions.find((o: any) =>
        o.type === currentType &&
        o.energyCarrier === currentCarrier &&
        (o.heatSource === currentHeatSource || (!o.heatSource && !currentHeatSource))
    )?.desc;

    return (
        <TooltipProvider delayDuration={300}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <h3 className="font-semibold text-sm flex items-center gap-2 col-span-full">
                    열원 설비 선택
                </h3>

                {/* 1. System Method Selection */}
                <FormItem>
                    <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="mb-0">시스템 방식 (1단계)</FormLabel>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[300px]">
                                <p>{SYSTEM_METHOD_DESCRIPTIONS[method]}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Select onValueChange={handleMethodChange} value={method}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="refrigerant">{SYSTEM_METHOD_LABELS.refrigerant}</SelectItem>
                            <SelectItem value="hydronic">{SYSTEM_METHOD_LABELS.hydronic}</SelectItem>
                            <SelectItem value="district">{SYSTEM_METHOD_LABELS.district}</SelectItem>
                            {mode === "HEATING" && (
                                <SelectItem value="electric_local">{SYSTEM_METHOD_LABELS.electric_local}</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </FormItem>

                {/* 2. Specific Source Selection */}
                <FormItem>
                    <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="mb-0">상세 열원 (2단계)</FormLabel>
                        {currentSourceDesc && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-primary cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[300px] bg-primary text-primary-foreground">
                                    <p>{currentSourceDesc}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                    <Select onValueChange={handleSourceChange} value={currentSourceValue}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="열원 선택" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {sourceOptions.map((opt: any, idx: number) => (
                                <SelectItem
                                    key={idx}
                                    value={`${opt.type}:${opt.energyCarrier}${opt.heatSource ? `:${opt.heatSource}` : ""}`}
                                >
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            </div>
        </TooltipProvider>
    );
}
