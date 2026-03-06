"use client";

import { useMemo, useEffect, useRef } from "react";
import { RefreshCcw, Warehouse, LayoutGrid } from "lucide-react";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";
import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Zone } from "@/types/project";

export function HeatingEmissionParams({ form, zones = [], isShared = true, linkedZoneIds = [] }: {
    form: any;
    zones?: Zone[];
    isShared?: boolean;
    linkedZoneIds?: string[];
}) {
    const spaceCategory = form.watch("emission.spaceCategory");
    const emissionType = form.watch("emission.type");

    // 수동 높이 입력 추적
    const heightOverrideRef = useRef(false);

    // 연결된 존의 면적 가중평균 높이 계산
    const { weightedAvgHeight } = useMemo(() => {
        const targetZones = isShared
            ? zones
            : zones.filter(z => linkedZoneIds.includes(z.id || ""));

        if (targetZones.length === 0) {
            return { weightedAvgHeight: null };
        }

        const totalArea = targetZones.reduce((sum, z) => sum + (z.area || 0), 0);
        if (totalArea === 0) {
            return { weightedAvgHeight: null };
        }

        const wAvg = targetZones.reduce((sum, z) => sum + (z.area || 0) * (z.height || 0), 0) / totalArea;
        return {
            weightedAvgHeight: wAvg,
        };
    }, [zones, isShared, linkedZoneIds]);

    // 최종 결정된 높이 (수동 입력 우선, 없으면 가중평균)
    const currentHeight = form.watch("emission.roomHeight") || weightedAvgHeight;

    // 높이에 따른 목표 카테고리 결정
    const targetCategory = useMemo(() => {
        if (currentHeight === null || isNaN(currentHeight)) return null;
        return currentHeight > 4 ? "hall" : "standard";
    }, [currentHeight]);

    // 공간 분류 동기화
    useEffect(() => {
        if (targetCategory && spaceCategory !== targetCategory) {
            form.setValue("emission.spaceCategory", targetCategory, { shouldDirty: true });
        }
    }, [targetCategory, spaceCategory, form]);

    // 초기 가중평균 높이 자동 설정
    useEffect(() => {
        if (weightedAvgHeight !== null && !heightOverrideRef.current) {
            const currentRoomHeight = form.getValues("emission.roomHeight");
            const wAvgFixed = parseFloat(weightedAvgHeight.toFixed(1));
            if (currentRoomHeight !== wAvgFixed) {
                form.setValue("emission.roomHeight", wAvgFixed);
            }
        }
    }, [weightedAvgHeight, form]);

    // 사용자가 수동으로 변경했는지 판별
    const isManualOverride = heightOverrideRef.current;

    const isHall = (spaceCategory || targetCategory) === "hall";

    // 높이 입력 핸들러
    const handleHeightChange = (value: string) => {
        const h = parseFloat(value);
        if (!isNaN(h) && h > 0) {
            heightOverrideRef.current = true;
            form.setValue("emission.roomHeight", h);
        } else if (value === "" && weightedAvgHeight !== null) {
            // 입력을 다 지우면 다시 가중평균으로 복귀
            heightOverrideRef.current = false;
            form.setValue("emission.roomHeight", parseFloat(weightedAvgHeight.toFixed(1)));
        }
    };

    const pipingType = form.watch("emission.pipingType");
    const hydraulicBalancing = form.watch("emission.hydraulicBalancing");
    const embeddingType = form.watch("emission.embeddingType");

    // 모든 입력 필드별 편차값 계산 (DIN/TS 18599-5 규정 준수)
    const calculatedDeltas = useMemo(() => {
        const pType = form.watch("emission.pipingType") || "two_pipe";
        const hBal = form.watch("emission.hydraulicBalancing") || "static";
        const cType = form.watch("emission.controlType") || "p_control";
        const isCert = form.watch("emission.isCertified") || false;
        const rAut = form.watch("emission.roomAutomation") || "none";
        const fIns = form.watch("emission.floorInsulation") || "standard";
        const eType = emissionType;
        const eCount = form.watch("emission.emitterCount") || 10;
        const tRegime = form.watch("emission.temperatureRegime") || "70/55";
        const hVent = form.watch("emission.hasVentilationLink") || false;
        const rPos = form.watch("emission.radiatorPosition") || "exterior_wall_opaque";
        const sProt = form.watch("emission.sunProtection") || false;
        const isInter = form.watch("emission.isIntermittent") || false;
        const embType = form.watch("emission.embeddingType") || "wet";

        // 1. 수력 균형 편차 (Δθ_hydr)
        let hydr = 0;
        const nOver10 = eCount > 10;
        if (pType === "one_pipe" || pType === "one_pipe_improved") {
            switch (hBal) {
                case "none": hydr = 0.7; break;
                case "static_loop": hydr = 0.4; break;
                case "dynamic_loop": hydr = 0.3; break;
                case "dynamic_return_temp": hydr = 0.2; break;
                case "dynamic_delta_temp": hydr = 0.1; break;
                default: hydr = 0.4;
            }
        } else if (pType === "distributed") {
            hydr = 0.0;
        } else {
            switch (hBal) {
                case "none": hydr = 0.6; break;
                case "static": hydr = nOver10 ? 0.4 : 0.3; break;
                case "static_group_static": hydr = nOver10 ? 0.3 : 0.2; break;
                case "static_group_dynamic": hydr = nOver10 ? 0.2 : 0.1; break;
                case "dynamic": hydr = 0.0; break;
                default: hydr = nOver10 ? 0.4 : 0.3;
            }
        }

        // 2. 제어 편차 (Δθ_ctr)
        let ctr = 0;
        const isOnePipe = pType === "one_pipe" || pType === "one_pipe_improved";
        if (isOnePipe) {
            ctr = isCert ? 1.8 : 2.0;
        } else {
            switch (cType) {
                case "manual": ctr = 2.5; break;
                case "central": ctr = isCert ? 1.8 : 2.0; break;
                case "electromechanical": ctr = isCert ? 1.6 : 1.8; break;
                case "p_control":
                case "pi_control": ctr = isCert ? 0.7 : 1.2; break;
                case "pi_optimized": ctr = isCert ? 0.5 : 0.9; break;
                default: ctr = isCert ? 0.7 : 1.2;
            }
        }

        // 3. 실내 자동화 보정 (Δθ_roomaut)
        let aut = 0;
        const isAutDisabled = isOnePipe || cType === "manual" || cType === "central";
        if (!isAutDisabled) {
            switch (rAut) {
                case "none": aut = 0.0; break;
                case "time_control": aut = -0.5; break;
                case "start_stop_optimized": aut = -1.0; break;
                case "full_automation": aut = -1.2; break;
            }
        }

        // 4. 매립 손실 (Δθ_emb,1, Δθ_emb,2) 및 공기 층화 (Δθ_str)
        let emb1 = 0.7;
        let emb2 = 0.5;
        let str_emb = 0;
        switch (eType) {
            case "floor_heating":
                str_emb = 0;
                if (embType === "wet") emb1 = 0.7;
                else if (embType === "dry") emb1 = 0.4;
                else if (embType === "low_coverage") emb1 = 0.2;
                break;
            case "wall_heating":
                str_emb = hVent ? 0 : 0.4;
                emb1 = 0.7;
                break;
            case "ceiling_heating":
                str_emb = hVent ? 0 : 0.7;
                emb1 = 0.7;
                break;
        }
        switch (fIns) {
            case "none": emb2 = 1.4; break;
            case "standard": emb2 = 0.5; break;
            case "enhanced": emb2 = 0.1; break;
        }

        // 5. 공기 층화 편차 1 (Δθ_str,1)
        let s1 = 0;
        if (hVent) {
            s1 = 0.2;
        } else if (pType === 'one_pipe') {
            switch (tRegime) {
                case '90/70': s1 = 1.6; break;
                case '70/55': s1 = 1.2; break;
                default: s1 = 1.2;
            }
        } else {
            switch (tRegime) {
                case '90/70': s1 = 1.2; break;
                case '70/55': s1 = 0.7; break;
                case '55/45': s1 = 0.5; break;
                case '45/35': s1 = 0.4; break;
                default: s1 = 0.7;
            }
        }
        if (eType === 'fcu') s1 = Math.max(0, s1 - 0.2);

        // 6. 공기 층화 편차 2 (Δθ_str,2)
        let s2 = 0;
        switch (rPos) {
            case 'interior_wall': s2 = 1.3; break;
            case 'exterior_wall_opaque': s2 = 0.3; break;
            case 'exterior_wall_transparent': s2 = sProt ? 1.2 : 1.7; break;
        }

        // 7. 간헐 운전 편차 (Δθ_im)
        let im = 0;
        if (isInter && !isHall) {
            switch (eType) {
                case "radiator":
                case "convector":
                case "fcu":
                    im = -0.3;
                    break;
                case "floor_heating":
                    if (embType === "low_coverage") im = -0.2;
                    else if (embType === "dry") im = -0.15;
                    else im = 0;
                    break;
                default:
                    im = 0;
            }
        }

        return { hydr, ctr, aut, emb1, emb2, str_emb, s1, s2, im };
    }, [
        form.watch("emission.pipingType"),
        form.watch("emission.hydraulicBalancing"),
        form.watch("emission.controlType"),
        form.watch("emission.isCertified"),
        form.watch("emission.roomAutomation"),
        form.watch("emission.floorInsulation"),
        form.watch("emission.emitterCount"),
        form.watch("emission.temperatureRegime"),
        form.watch("emission.hasVentilationLink"),
        form.watch("emission.radiatorPosition"),
        form.watch("emission.sunProtection"),
        form.watch("emission.isIntermittent"),
        form.watch("emission.embeddingType"),
        emissionType,
        isHall
    ]);

    // 배관 방식 변경 시 수력 균형 옵션 유효성 체크 및 자동 전환
    useEffect(() => {
        const currentBalancing = form.getValues("emission.hydraulicBalancing");
        
        if (pipingType === "distributed") {
            if (currentBalancing !== "none") {
                form.setValue("emission.hydraulicBalancing", "none", { shouldDirty: true });
            }
        } else if (pipingType === "one_pipe" || pipingType === "one_pipe_improved") {
            // 1관식 유효 옵션인지 확인
            const validOnePipeOptions = ["none", "static_loop", "dynamic_loop", "dynamic_return_temp", "dynamic_delta_temp"];
            if (!validOnePipeOptions.includes(currentBalancing)) {
                form.setValue("emission.hydraulicBalancing", "none", { shouldDirty: true });
            }
        } else if (pipingType === "two_pipe") {
            // 2관식 유효 옵션인지 확인 (기본값 static)
            const validTwoPipeOptions = ["none", "static", "static_group_static", "static_group_dynamic", "dynamic"];
            if (!validTwoPipeOptions.includes(currentBalancing)) {
                form.setValue("emission.hydraulicBalancing", "static", { shouldDirty: true });
            }
        }
    }, [pipingType, form]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-6 gap-4 items-end pb-6 border-b border-muted/60">
                {/* 1. 공간 분류 (전체 폭의 1/2 = 3/6) */}
                <div className="col-span-3 flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">
                        공간 분류
                    </span>
                    <div className="h-10 flex items-center">
                        {isHall ? (
                            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm animate-in fade-in zoom-in duration-300 w-full">
                                <Warehouse className="size-4 shrink-0 text-amber-600" />
                                <span className="text-sm font-bold">대공간</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 shadow-sm animate-in fade-in zoom-in duration-300 w-full">
                                <LayoutGrid className="size-4 shrink-0 text-blue-600" />
                                <span className="text-sm font-bold">일반 공간</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. 천장고 (우측 1/2 중 2/3 = 2/6) */}
                <FormField
                    control={form.control}
                    name="emission.roomHeight"
                    render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-sm font-medium text-foreground flex items-center gap-2">
                                천장고 (m)
                                {!isManualOverride && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold border border-green-200 uppercase tracking-tight">자동</span>
                                )}
                            </FormLabel>
                            <div className="mt-2">
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        className={cn(
                                            "h-10 transition-colors focus:ring-0 w-full",
                                            !isManualOverride ? "bg-muted/30 text-muted-foreground font-medium" : "bg-background font-semibold border-amber-200"
                                        )}
                                        placeholder={weightedAvgHeight !== null ? `${weightedAvgHeight.toFixed(1)}` : "3.0"}
                                        {...field}
                                        onChange={(e) => {
                                            field.onChange(e);
                                            handleHeightChange(e.target.value);
                                        }}
                                    />
                                </FormControl>
                            </div>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                />

                {/* 3. 자동 복귀 버튼 (우측 1/2 중 1/3 = 1/6) */}
                <div className="col-span-1 flex flex-col gap-2">
                    <span className="text-sm font-medium text-transparent select-none">
                        복귀
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant={isManualOverride ? "outline" : "ghost"}
                                    size="icon"
                                    className={cn(
                                        "h-10 w-full rounded-lg transition-all",
                                        isManualOverride 
                                            ? "text-amber-600 border-amber-200 bg-amber-50/50 hover:bg-amber-100/80 hover:text-amber-700" 
                                            : "text-muted-foreground/40 cursor-default opacity-50"
                                    )}
                                    disabled={!isManualOverride || weightedAvgHeight === null}
                                    onClick={() => {
                                        heightOverrideRef.current = false;
                                        if (weightedAvgHeight !== null) {
                                            form.setValue("emission.roomHeight", parseFloat(weightedAvgHeight.toFixed(1)), { shouldDirty: true });
                                        }
                                    }}
                                >
                                    <RefreshCcw className={cn("size-4", isManualOverride && "animate-spin-slow")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="text-xs font-medium">자동 계산값(가중평균)으로 복귀</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="emission.type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>방열 방식 (Emission Type)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {isHall ? (
                                        <>
                                            <SelectItem value="hall_air">대공간 공기 난방</SelectItem>
                                            <SelectItem value="infrared_radiant">적외선 복사 난방</SelectItem>
                                            <SelectItem value="ceiling_radiant_panel">천장 복사 패널</SelectItem>
                                            <SelectItem value="hall_floor_heating">대공간 바닥 매립 난방</SelectItem>
                                            <SelectItem value="radiator">라디에이터 (기존 건물)</SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="radiator">라디에이터 / 컨벡터</SelectItem>
                                            <SelectItem value="fcu">팬코일 유닛 (FCU)</SelectItem>
                                            <SelectItem value="ceiling_radiant_panel">천장 복사 패널</SelectItem>
                                            <SelectItem value="floor_heating">바닥 매립 난방</SelectItem>
                                            <SelectItem value="wall_heating">벽면 매립 난방</SelectItem>
                                            <SelectItem value="ceiling_heating">천장 매립 난방</SelectItem>
                                            <SelectItem value="tabs">TABS (콘크리트코어 활성화)</SelectItem>
                                            <SelectItem value="supply_air">급기 난방</SelectItem>
                                            <SelectItem value="electric_heater">독립형 전기 난방기</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* 대공간 공기 난방 세부 */}
                {emissionType === "hall_air" && (
                    <FormField
                        control={form.control}
                        name="emission.hallAirSubType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>토출 방식</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "low_temp_horizontal"}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="wall_horizontal">벽면 수평 토출</SelectItem>
                                        <SelectItem value="ceiling_downward">천장 하향 토출</SelectItem>
                                        <SelectItem value="low_temp_horizontal">저온 수평 토출 (수평 유동)</SelectItem>
                                        <SelectItem value="low_temp_ceiling">저온 천장 토출 (하향 유동)</SelectItem>
                                        <SelectItem value="ceiling_fan_2pos">천장 팬 (2단 제어)</SelectItem>
                                        <SelectItem value="ceiling_fan_pi">천장 팬 (PI 제어)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                )}

                {/* 적외선 복사 난방 세부 */}
                {emissionType === "infrared_radiant" && (
                    <>
                        <FormField
                            control={form.control}
                            name="emission.infraredSubType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>기기 등급</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "standard"}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="standard">표준형 (Standard)</SelectItem>
                                            <SelectItem value="improved">개선형 (Improved)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="emission.hallHeatingLoad"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>단위면적당 난방부하 (W/m²)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            onChange={e => field.onChange(parseFloat(e.target.value))}
                                            placeholder="50"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}

                {/* 천장 복사 패널 세부 (6.2.2.4.3 및 6.2.2.4.8 공통) */}
                {emissionType === "ceiling_radiant_panel" && (
                    <>
                        <FormField
                            control={form.control}
                            name="emission.ceilingPanelSubType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>패널 유형 및 설치</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "standard"}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="general">단순형 (상부 단열 없음)</SelectItem>
                                            <SelectItem value="standard_no_gap">표준형 (외벽 이격 미준수)</SelectItem>
                                            <SelectItem value="standard_gap">표준형 (외벽 이격 준수)</SelectItem>
                                            <SelectItem value="improved_no_gap">개선형 (외벽 이격 미준수)</SelectItem>
                                            <SelectItem value="improved_gap">개선형 (외벽 이격 준수)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="emission.hallHeatingLoad"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>단위면적당 난방부하 (W/m²)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            onChange={e => field.onChange(parseFloat(e.target.value))}
                                            placeholder="50"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}

                {/* 대공간 바닥 난방 세부 */}
                {emissionType === "hall_floor_heating" && (
                    <>
                        <FormField
                            control={form.control}
                            name="emission.hallFloorDepth"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>매설 깊이</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "shallow"}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="shallow">얇은 매설 (&le; 10cm)</SelectItem>
                                            <SelectItem value="deep">깊은 매설 (&gt; 10cm)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="emission.hallFloorInsulation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>하부 단열 수준</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "min1"}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">단열 없음</SelectItem>
                                            <SelectItem value="min1">최소 단열 1단계</SelectItem>
                                            <SelectItem value="min2">최소 단열 2단계</SelectItem>
                                            <SelectItem value="full">전체 단열 (완전 분리)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </>
                )}
            </div>

            {/* 노출형 방열기 상세 */}
            {(emissionType === "radiator" || emissionType === "convector" || emissionType === "fcu") && (
                <div className="grid grid-cols-2 gap-4 border-t pt-4 border-dashed mt-4 text-sm font-medium">
                    <FormField
                        control={form.control}
                        name="emission.pipingType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>배관 방식</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "two_pipe"}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="two_pipe">2관식</SelectItem>
                                        <SelectItem value="one_pipe_improved">1관식 (개선형)</SelectItem>
                                        <SelectItem value="one_pipe">1관식 (기존)</SelectItem>
                                        <SelectItem value="distributed">분산형</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="emission.isIntermittent"
                        render={({ field }) => (
                            <FormItem className="flex items-center gap-2 pt-6">
                                <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="!m-0 pb-1 cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
                                    간헐 운전 실시 여부
                                    <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium ml-1">
                                        (<InlineMath math={`\\Delta\\theta_{im} = ${calculatedDeltas.im.toFixed(2)}K`} />)
                                    </span>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="size-3.5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground cursor-help font-serif italic">i</div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs font-medium">DIN/TS 18599 규정에 따른 간헐 운전 보정 계수 적용</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </FormLabel>
                            </FormItem>
                        )}
                    />
                </div>
            )}

            {/* 매립형 난방 상단 (배관 및 간헐운전) */}
            {(emissionType === "floor_heating" || emissionType === "wall_heating" || emissionType === "ceiling_heating") && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 border-dashed mt-4 text-sm font-medium">
                    <FormField
                        control={form.control}
                        name="emission.pipingType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>배관 방식</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "two_pipe"}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="two_pipe">2관식</SelectItem>
                                        <SelectItem value="one_pipe_improved">1관식 (개선형)</SelectItem>
                                        <SelectItem value="one_pipe">1관식 (기존)</SelectItem>
                                        <SelectItem value="distributed">분산형</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="emission.isIntermittent"
                        render={({ field }) => (
                            <FormItem className="flex items-center gap-2 pt-6">
                                <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="!m-0 pb-1 cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
                                    간헐 운전 실시 여부
                                    <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium ml-1">
                                        (<InlineMath math={`\\Delta\\theta_{im} = ${calculatedDeltas.im.toFixed(2)}K`} />)
                                    </span>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="size-3.5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground cursor-help font-serif italic">i</div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs font-medium">DIN/TS 18599 규정에 따른 간헐 운전 보정 계수 적용</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </FormLabel>
                            </FormItem>
                        )}
                    />
                </div>
            )}

            {/* 제어 (Control) 및 수력 균형 (Hydraulic) 공통 파라미터 */}
            {emissionType !== "tabs" && emissionType !== "electric_heater" && emissionType !== "supply_air" && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 border-dashed">
                    <FormField
                        control={form.control}
                        name="emission.hydraulicBalancing"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                                    수력 균형
                                    <span className="text-[10.5px] text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                                        (<InlineMath math={`\\Delta\\theta_{hydr} = +${calculatedDeltas.hydr.toFixed(1)}K`} />)
                                    </span>
                                </FormLabel>
                                <Select 
                                    onValueChange={field.onChange} 
                                    value={field.value}
                                    disabled={form.watch("emission.pipingType") === "distributed"}
                                >
                                    <FormControl>
                                        <SelectTrigger className="text-sm leading-tight px-2 h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {form.watch("emission.pipingType") === "distributed" ? (
                                            <SelectItem value="none">분산형 (해당 없음)</SelectItem>
                                        ) : form.watch("emission.pipingType") === "one_pipe" || form.watch("emission.pipingType") === "one_pipe_improved" ? (
                                            <>
                                                <SelectItem value="none">미조치</SelectItem>
                                                <SelectItem value="static_loop">회로별 정적 평형</SelectItem>
                                                <SelectItem value="dynamic_loop">회로별 동적 평형</SelectItem>
                                                <SelectItem value="dynamic_return_temp">환수온도 동적 평형</SelectItem>
                                                <SelectItem value="dynamic_delta_temp">차온 동적 평형</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                {(() => {
                                                    return (
                                                        <>
                                                            <SelectItem value="none">미조치</SelectItem>
                                                            <SelectItem value="static">정적 평형</SelectItem>
                                                            <SelectItem value="static_group_static">정적 + 그룹 정적 평형</SelectItem>
                                                            <SelectItem value="static_group_dynamic">정적 + 그룹 동적 평형</SelectItem>
                                                            <SelectItem value="dynamic">완전 동적 평형</SelectItem>
                                                        </>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="emission.emitterCount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>방열기 수량 (n)</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        {...field} 
                                        onChange={e => field.onChange(parseInt(e.target.value, 10))}
                                        placeholder="10"
                                        disabled={
                                            form.watch("emission.pipingType") === "distributed" ||
                                            form.watch("emission.pipingType") === "one_pipe" ||
                                            form.watch("emission.pipingType") === "one_pipe_improved"
                                        }
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="emission.controlType"
                        render={({ field }) => {
                            const pipingType = form.watch("emission.pipingType");
                            const isOnePipe = pipingType === "one_pipe" || pipingType === "one_pipe_improved";
                            const isCertified = form.watch("emission.isCertified");

                            return (
                                <FormItem className="col-span-1">
                                    <FormLabel className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                                        제어기 유형
                                        <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                                            (<InlineMath math={`\\Delta\\theta_{ctr} = +${calculatedDeltas.ctr.toFixed(1)}K`} />)
                                        </span>
                                    </FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        value={isOnePipe ? "one_pipe_default" : (field.value || "p_control")}
                                        disabled={isOnePipe}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="text-sm leading-tight px-2 h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {isOnePipe ? (
                                                <SelectItem value="one_pipe_default">
                                                    1관식 통합 제어
                                                </SelectItem>
                                            ) : (
                                                <>
                                                    <SelectItem value="manual">수동 밸브</SelectItem>
                                                    <SelectItem value="central">중앙 제어</SelectItem>
                                                    <SelectItem value="electromechanical">기계식 2점 제어</SelectItem>
                                                    <SelectItem value="p_control">비례 제어 (P)</SelectItem>
                                                    <SelectItem value="pi_control">비례적분 제어 (PI)</SelectItem>
                                                    <SelectItem value="pi_optimized">최적화 PI 제어</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            );
                        }}
                    />
                    <FormField
                        control={form.control}
                        name="emission.isCertified"
                        render={({ field }) => (
                            <FormItem className="flex items-center gap-2 pt-6">
                                <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="!m-0 pb-1 cursor-pointer">제어기 인증 여부 (EN 15500-1)</FormLabel>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="emission.roomAutomation"
                        render={({ field }) => {
                            const controlType = form.watch("emission.controlType");
                            const pipingType = form.watch("emission.pipingType");
                            // DIN/TS 18599-5 표 11, 12 규정: 
                            // 개별 실내 제어가 불가능한 유형(manual, central)이거나 1관식인 경우 자동화 보정 적용 불가
                            const isOnePipe = pipingType === "one_pipe" || pipingType === "one_pipe_improved";
                            const isAutomationDisabled = isOnePipe || controlType === "manual" || controlType === "central";

                            return (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                                        실내 자동화 수준
                                        <span className="text-[10.5px] text-violet-600 dark:text-violet-400 font-medium whitespace-nowrap">
                                            (<InlineMath math={`\\Delta\\theta_{roomaut} = ${calculatedDeltas.aut >= 0 ? "+" : ""}${calculatedDeltas.aut.toFixed(1)}K`} />)
                                        </span>
                                    </FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        value={isAutomationDisabled ? "none" : (field.value || "none")}
                                        disabled={isAutomationDisabled}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="text-sm leading-tight px-2 h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">자동화 없음</SelectItem>
                                            <SelectItem value="time_control">시간 제어 (개별실)</SelectItem>
                                            <SelectItem value="start_stop_optimized">단속 운전 최적화</SelectItem>
                                            <SelectItem value="full_automation">통합 실내 자동화</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            );
                        }}
                    />

                    {/* 상세 항목 (바닥/벽면/천장 매립 난방 전용) */}
                    {(emissionType === "floor_heating" || emissionType === "wall_heating" || emissionType === "ceiling_heating") && (
                        <div className="col-span-2 mt-2">
                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-muted/80" />
                                </div>
                                <div className="relative flex justify-start">
                                    <span className="bg-background pr-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 px-1 ml-1">
                                        <div className="size-1.5 rounded-full bg-blue-500/50" />
                                        {(() => {
                                            if (emissionType === "floor_heating") return "바닥 매립 난방 상세 파라미터";
                                            if (emissionType === "wall_heating") return "벽면 매립 난방 상세 파라미터";
                                            return "천장 매립 난방 상세 파라미터";
                                        })()}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <FormField
                                    control={form.control}
                                    name="emission.embeddingType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                                                시공 (매립) 방식
                                                <span className="text-[10.5px] font-medium whitespace-nowrap flex items-center gap-0.5">
                                                    (<span className="text-orange-600 dark:text-orange-400"><InlineMath math={`\\Delta\\theta_{str} = ${calculatedDeltas.str_emb.toFixed(1)}K`} /></span>,
                                                    <span className="text-rose-600 dark:text-rose-400 ml-1"><InlineMath math={`\\Delta\\theta_{emb,1} = ${calculatedDeltas.emb1.toFixed(1)}K`} /></span>)
                                                </span>
                                            </FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || "wet"}>
                                                <FormControl><SelectTrigger className="h-9 text-sm px-2 leading-tight"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="wet" className="text-sm">습식 (Wet)</SelectItem>
                                                    <SelectItem value="dry" className="text-sm">건식 (Dry)</SelectItem>
                                                    <SelectItem value="low_coverage" className="text-sm">낮은 피복 두께</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                {emissionType !== "floor_heating" ? (
                                    <FormField
                                        control={form.control}
                                        name="emission.hasVentilationLink"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center gap-2 pt-6">
                                                <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className="!m-0 pb-1 cursor-pointer whitespace-nowrap">환기 설비 연동 (<InlineMath math="\Delta\theta_{str}" /> 보정)</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                ) : <div />}
                                <FormField
                                    control={form.control}
                                    name="emission.floorInsulation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                                                하부 단열 수준
                                                <span className="text-[10.5px] text-rose-600 dark:text-rose-400 font-medium whitespace-nowrap">
                                                    (<InlineMath math={`\\Delta\\theta_{emb,2} = +${calculatedDeltas.emb2.toFixed(1)}K`} />)
                                                </span>
                                            </FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || "standard"}>
                                                <FormControl><SelectTrigger className="h-9 text-sm px-2 leading-tight"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none" className="text-sm">단열 없음</SelectItem>
                                                    <SelectItem value="standard" className="text-sm">표준 단열</SelectItem>
                                                    <SelectItem value="enhanced" className="text-sm">강화 단열</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <div />
                            </div>
                        </div>
                    )}

                    {/* 상세 항목 (라디에이터/컨벡터/FCU/천장복사패널 전용) */}
                    {(emissionType === "radiator" || emissionType === "convector" || emissionType === "fcu" || emissionType === "ceiling_radiant_panel") && (
                        <div className="col-span-2 mt-2">
                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-muted/80" />
                                </div>
                                <div className="relative flex justify-start">
                                    <span className="bg-background pr-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 px-1 ml-1">
                                        <div className="size-1.5 rounded-full bg-blue-500/50" />
                                        {(() => {
                                            if (emissionType === "fcu") return "팬코일 유닛 (FCU) 상세 파라미터";
                                            if (emissionType === "ceiling_radiant_panel") return "천장 복사 패널 상세 파라미터";
                                            return isHall ? "라디에이터 (기존 건물) 상세 파라미터" : "라디에이터 / 컨벡터 상세 파라미터";
                                        })()}
                                    </span>
                                </div>
                            </div>

                            {(() => {
                                const pipingType = form.watch("emission.pipingType") || "two_pipe";
                                const hasVentLink = form.watch("emission.hasVentilationLink") || false;
                                const sunProt = form.watch("emission.sunProtection") || false;

                                const getRegimeDelta = (regime: string) => {
                                    if (hasVentLink) return 0.2;
                                    let base = 0.7;
                                    if (pipingType === 'one_pipe') {
                                        switch (regime) {
                                            case '90/70': base = 1.6; break;
                                            case '70/55': base = 1.2; break;
                                            default: base = 1.2;
                                        }
                                    } else {
                                        switch (regime) {
                                            case '90/70': base = 1.2; break;
                                            case '70/55': base = 0.7; break;
                                            case '55/45': base = 0.5; break;
                                            case '45/35': base = 0.4; break;
                                            default: base = 0.7;
                                        }
                                    }
                                    if (emissionType === 'fcu') base = Math.max(0, base - 0.2);
                                    return base;
                                };

                                const getPosDelta = (pos: string) => {
                                    switch (pos) {
                                        case 'interior_wall': return 1.3;
                                        case 'exterior_wall_opaque': return 0.3;
                                        case 'exterior_wall_transparent': return sunProt ? 1.2 : 1.7;
                                        default: return 0.3;
                                    }
                                };

                                return (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                        <FormField
                                            control={form.control}
                                            name="emission.temperatureRegime"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                                                        설계 온도 조건
                                                        <span className="text-[10.5px] text-orange-600 dark:text-orange-400 font-medium whitespace-nowrap">
                                                            (<InlineMath math={`\\Delta\\theta_{str,1} = +${calculatedDeltas.s1.toFixed(1)}K`} />)
                                                        </span>
                                                    </FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || "70/55"}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-9 text-sm px-2 leading-tight">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="90/70" className="text-sm">90/70 (60K)</SelectItem>
                                                            <SelectItem value="70/55" className="text-sm">70/55 (42.5K)</SelectItem>
                                                            <SelectItem value="55/45" className="text-sm">55/45 (30K)</SelectItem>
                                                            <SelectItem value="45/35" className="text-sm">45/35 (20K)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="emission.hasVentilationLink"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2 pt-6">
                                                    <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                                    <FormLabel className="!m-0 pb-1 cursor-pointer whitespace-nowrap">환기 설비 연동 (<InlineMath math="\Delta\theta_{str,1}" /> 보정)</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="emission.radiatorPosition"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                                                        방열기 위치
                                                        <span className="text-[10.5px] text-orange-600 dark:text-orange-400 font-medium whitespace-nowrap">
                                                            (<InlineMath math={`\\Delta\\theta_{str,2} = +${calculatedDeltas.s2.toFixed(1)}K`} />)
                                                        </span>
                                                    </FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || "exterior_wall_opaque"}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-9 text-sm px-2 leading-tight">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="interior_wall" className="text-sm">내벽</SelectItem>
                                                            <SelectItem value="exterior_wall_opaque" className="text-sm">외벽 (불투명)</SelectItem>
                                                            <SelectItem value="exterior_wall_transparent" className="text-sm">외벽 (투명 창호 앞)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        {form.watch("emission.radiatorPosition") === "exterior_wall_transparent" ? (
                                            <FormField
                                                control={form.control}
                                                name="emission.sunProtection"
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center gap-2 pt-6">
                                                        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                                        <FormLabel className="!m-0 pb-1 cursor-pointer">일사 차단 있음</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        ) : <div />}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
