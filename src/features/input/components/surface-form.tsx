"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Surface, SurfaceType, Orientation, Construction } from "@/types/project";
import { createSurface, updateSurface } from "@/services/surface-service";
import { getFxDefault } from "@/lib/standard-values";
import { useState, useEffect } from "react";
import { Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateSHGC } from "@/lib/shgc-calculator";

const FX_OPTIONS = [
    { value: 1.0, label: "직접 (Direct) (Fx=1.0)" },
    { value: 0.6, label: "지면 (Ground) (Fx=0.6)" },
    { value: 0.5, label: "간접 (Indirect) (Fx=0.5)" },
];

// Use z.number() directly for stricter type inference if possible, but form inputs return strings usually.
// z.coerce.number() is correct for handling "123" -> 123.
const formSchema = z.object({
    name: z.string().optional(),
    type: z.enum([
        "wall_exterior",
        "wall_interior",
        "wall_ground",
        "roof_exterior",
        "roof_interior",
        "roof_ground",
        "floor_ground",
        "floor_interior",
        "floor_exterior",
        "window",
        "door"
    ]),
    area: z.coerce.number().min(0.01, "면적은 0보다 커야 합니다."),
    uValue: z.coerce.number().min(0.01, "열관류율은 0보다 커야 합니다."),
    fx: z.coerce.number().min(0).max(1).optional(),
    orientation: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW", "Horiz", "NoExposure"]).optional(),
    tilt: z.coerce.number().min(0).max(180).optional(),
    shgc: z.coerce.number().min(0).max(1).optional(),
});

type SurfaceFormValues = z.infer<typeof formSchema>;

interface SurfaceFormProps {
    projectId: string;
    zoneId: string;
    surface?: Surface;
    onSuccess?: () => void;
    onCancel?: () => void;
    constructions?: Construction[];
}

export function SurfaceForm({ projectId, zoneId, surface, onSuccess, onCancel, constructions = [] }: SurfaceFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedConstructionId, setSelectedConstructionId] = useState(surface?.constructionId || "");

    const form = useForm<SurfaceFormValues>({
        // casting zodResolver to any as a workaround for strict type issues with coerce
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: surface?.name || "",
            type: (() => {
                const t = (surface?.type || "wall_exterior") as string;
                if (t === "roof") return "roof_exterior";
                if (t === "floor") return "floor_ground";
                if (t === "wall") return "wall_exterior";
                return t;
            })() as any,
            area: surface?.area || 0,
            uValue: surface?.uValue || 0.20,
            fx: surface?.fx !== undefined ? surface.fx : getFxDefault(surface?.type || "wall_exterior"),
            orientation: (surface?.orientation as any) || "S",

            tilt: surface?.tilt !== undefined ? surface.tilt : 90,
            shgc: surface?.shgc !== undefined ? surface.shgc : 0.6,
        },
    });

    // Watch type to conditionally show fields
    const currentType = form.watch("type");
    const isExterior = currentType === "wall_exterior" || currentType === "roof_exterior" || currentType === "floor_exterior" || currentType === "floor_ground" || currentType === "window" || currentType === "door"; // Added floor_ground to visible fields logic
    const isHorizontal = ["roof_exterior", "floor_ground", "floor_interior", "floor_exterior", "roof_ground", "roof_interior"].includes(currentType);
    const isWindowOrDoor = currentType === "window" || currentType === "door";

    // Filter constructions by type match
    const currentCategory = (() => {
        if (currentType.startsWith("wall")) return "wall";
        if (currentType.startsWith("roof")) return "roof";
        if (currentType.startsWith("floor")) return "floor";
        return currentType;
    })();

    const filteredConstructions = constructions.filter(c => {
        if (c.type === currentType) return true; // Exact match
        // Or Category match
        if (currentCategory === "wall" && c.type.startsWith("wall")) return true;
        if (currentCategory === "roof" && c.type.startsWith("roof")) return true;
        if (currentCategory === "floor" && c.type.startsWith("floor")) return true;
        if (currentCategory === "window" && c.type === "window") return true;
        if (currentCategory === "door" && c.type === "door") return true;
        return false;
    });

    // Sync form values when constructions library updates (cascading changes)
    useEffect(() => {
        if (selectedConstructionId) {
            const constr = constructions.find(c => c.id === selectedConstructionId);
            if (constr) {
                form.setValue("uValue", constr.uValue);
                if (constr.shgc !== undefined) {
                    form.setValue("shgc", constr.shgc);
                }
            }
        }
    }, [constructions, selectedConstructionId, form]);

    const handleConstructionSelect = (id: string) => {
        setSelectedConstructionId(id);
        const constr = constructions.find(c => c.id === id);
        if (constr) {
            form.setValue("uValue", constr.uValue);

            // Handle legacy/generic types from constructions
            let typeToUse = constr.type as string;
            if (typeToUse === 'roof') typeToUse = 'roof_exterior';
            if (typeToUse === 'floor') typeToUse = 'floor_ground';
            if (typeToUse === 'wall') typeToUse = 'wall_exterior';

            // Only update type if it's compatible with current category (to avoid unexpected jumps)
            // But usually construction type dictates the surface type.
            form.setValue("type", typeToUse as any);

            form.setValue("fx", getFxDefault(typeToUse as SurfaceType));

            // Recalculate SHGC from layers if possible to ensure latest logic is applied
            // (fixes issue where old presets have stale SHGC values)
            let shgcToUse = constr.shgc;

            if (!constr.isShgcManual && constr.layers && constr.layers.length > 0 && (constr.type === 'window' || constr.type === 'door')) {
                const calculated = calculateSHGC(constr.layers);
                // Only use calculated if valid (> 0), otherwise fall back to stored
                if (calculated > 0) {
                    shgcToUse = calculated;
                }
            }

            if (shgcToUse !== undefined) {
                form.setValue("shgc", shgcToUse);
            }

            // Set default tilt based on type
            if (constr.type.startsWith("wall")) {
                form.setValue("tilt", 90);
                // Also reset orientation to defaults if needed, but keeping current is usually better unless invalid
            } else if (typeToUse === "roof_exterior" || typeToUse === "roof") {
                form.setValue("tilt", 0);
                form.setValue("orientation", "Horiz");
            }
        }
    };

    // Helper for default name
    const getDefaultName = (type: string) => {
        switch (type) {
            case "wall_exterior": return "외벽";
            case "wall_interior": return "내벽";
            case "wall_ground": return "지중벽";
            case "roof_exterior": return "지붕 (외기)";
            case "roof_interior": return "천장 (내부)";
            case "roof_ground": return "지중 지붕";
            case "floor_ground": return "바닥";
            case "floor_interior": return "층간바닥";
            case "floor_exterior": return "외기개방 바닥";
            case "window": return "창호";
            case "door": return "문";
            default: return "표면";
        }
    }

    const onSubmit: SubmitHandler<SurfaceFormValues> = async (values) => {
        setLoading(true);
        setError("");
        try {
            // Generate default name if empty
            let finalName = values.name;
            if (!finalName || finalName.trim() === "") {
                const baseName = getDefaultName(values.type);
                if ((values.type.startsWith("wall") || values.type === "window" || values.type === "door") && values.orientation && values.orientation !== "Horiz") {
                    finalName = `${baseName} (${values.orientation})`;
                } else {
                    finalName = baseName;
                }
            }

            const surfaceData: any = {
                name: finalName, // Use the generated name
                type: values.type as SurfaceType,
                area: values.area,
                uValue: values.uValue,
                fx: values.fx,
                constructionId: selectedConstructionId || undefined,
            };

            if (isExterior || values.type === 'roof_exterior') {
                surfaceData.orientation = values.orientation as Orientation;
                surfaceData.tilt = values.tilt;
            }

            if (isExterior && (surfaceData.type === 'window' || surfaceData.type === 'door')) {
                if (values.shgc !== undefined) {
                    surfaceData.shgc = values.shgc;
                }
            }

            if (surface && surface.id) {
                await updateSurface(projectId, zoneId, surface.id, surfaceData);
            } else {
                await createSurface(projectId, zoneId, surfaceData);
            }

            form.reset();
            if (onSuccess) onSuccess();
        } catch (e: any) {
            console.error("Surface save error:", e);
            setError(e.message || "Failed to save surface");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded-lg bg-card text-card-foreground shadow-sm">
                <div className="grid grid-cols-1 gap-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>표면 이름</FormLabel>
                                <FormControl>
                                    <Input placeholder="예: 남측 외벽" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Row 2: Type, Assembly Preset, Area */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Type Selection */}
                        <div className="space-y-2">
                            <FormLabel>유형</FormLabel>
                            <Select
                                value={currentCategory}
                                onValueChange={(cat) => {
                                    // Default defaults when switching category, implicitly setting type
                                    let newType = "wall_exterior";
                                    let newTilt = 90;

                                    if (cat === "wall") {
                                        newType = "wall_exterior";
                                        newTilt = 90;
                                        form.setValue("orientation", "S");
                                    } else if (cat === "roof") {
                                        newType = "roof_exterior";
                                        newTilt = 0;
                                    } else if (cat === "floor") {
                                        newType = "floor_ground";
                                        form.setValue("orientation", "NoExposure" as any); // Cast to any temporary if type is stuck
                                        form.setValue("tilt", 0);
                                    } else if (cat === "window") {
                                        newType = "window";
                                        form.setValue("orientation", "S");
                                        form.setValue("tilt", 90);
                                    } else if (cat === "door") {
                                        newType = "door";
                                        form.setValue("orientation", "S");
                                        form.setValue("tilt", 90);
                                    }

                                    form.setValue("type", newType as any);
                                    if (cat === "wall" || cat === "roof") {
                                        form.setValue("tilt", newTilt);
                                    }
                                    if (cat === "roof") {
                                        form.setValue("orientation", "Horiz");
                                    }
                                    setSelectedConstructionId(""); // Reset construction preset
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="유형 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="wall">벽체 (Wall)</SelectItem>
                                    <SelectItem value="roof">지붕 (Roof)</SelectItem>
                                    <SelectItem value="floor">바닥 (Floor)</SelectItem>
                                    <SelectItem value="window">창호 (Window)</SelectItem>
                                    <SelectItem value="door">문 (Door)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Construction Selection (Assembly Preset) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <FormLabel>외피 유형 선택 (Preset)</FormLabel>
                                {selectedConstructionId && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                                        onClick={() => handleConstructionSelect("")}
                                    >
                                        선택 해제
                                    </Button>
                                )}
                            </div>
                            <Select value={selectedConstructionId} onValueChange={handleConstructionSelect}>
                                <SelectTrigger className={!selectedConstructionId ? "text-muted-foreground" : ""}>
                                    <SelectValue placeholder="선택 (열관류율 자동 입력)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredConstructions.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name} (U={c.uValue})
                                        </SelectItem>
                                    ))}
                                    {filteredConstructions.length === 0 && (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            해당 유형의 외피 유형이 없습니다.
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>


                        <FormField
                            control={form.control}
                            name="area"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>면적 (m²)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Row 3: U-Value, Fx, SHGC */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                            control={form.control}
                            name="uValue"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>열관류율 (W/m²K)</FormLabel>
                                    {selectedConstructionId ? (
                                        <div className="px-3 py-2 bg-secondary/20 rounded-md text-sm font-medium text-foreground border border-transparent">
                                            {field.value}
                                        </div>
                                    ) : (
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.20"
                                                {...field}
                                            />
                                        </FormControl>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="fx"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-1">
                                        <FormLabel>외기 접촉 유형 (Condition)</FormLabel>
                                        {!selectedConstructionId && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-[200px]">
                                                        <p>외기=1.0, 간접/비난방=0.5, 지면=0.6</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    {selectedConstructionId ? (
                                        <div className="px-3 py-2 bg-secondary/20 rounded-md text-sm font-medium text-foreground border border-transparent">
                                            {FX_OPTIONS.find(opt => Math.abs(opt.value - (field.value || 0)) < 0.001)?.label || `사용자 정의 (Fx=${field.value})`}
                                        </div>
                                    ) : (
                                        <Select
                                            onValueChange={(val) => field.onChange(parseFloat(val))}
                                            value={field.value?.toString()}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="접촉 조건 선택" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {FX_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value.toString()}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {isWindowOrDoor && (
                            <FormField
                                control={form.control}
                                name="shgc"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>일사취득계수 (SHGC)</FormLabel>
                                        {selectedConstructionId ? (
                                            <div className="px-3 py-2 bg-secondary/20 rounded-md text-sm font-medium text-foreground border border-transparent">
                                                {field.value}
                                            </div>
                                        ) : (
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.001"
                                                    min="0"
                                                    max="1"
                                                    placeholder="0.60"
                                                    {...field}
                                                />
                                            </FormControl>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>

                    {isExterior && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/40 rounded-md">
                            <FormField
                                control={form.control}
                                name="orientation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>방위</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || "S"}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="방위 선택" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="S">남 (South)</SelectItem>
                                                <SelectItem value="SE">남동 (South-East)</SelectItem>
                                                <SelectItem value="E">동 (East)</SelectItem>
                                                <SelectItem value="NE">북동 (North-East)</SelectItem>
                                                <SelectItem value="N">북 (North)</SelectItem>
                                                <SelectItem value="NW">북서 (North-West)</SelectItem>
                                                <SelectItem value="W">서 (West)</SelectItem>
                                                <SelectItem value="SW">남서 (South-West)</SelectItem>
                                                <SelectItem value="Horiz">수평 (Horizontal)</SelectItem>
                                                <SelectItem value="NoExposure">일사없음 (No Exposure)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="tilt"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-1">
                                            <FormLabel>경사각 (°)</FormLabel>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>수직=90, 수평=0</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="1"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        {onCancel && (
                            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
                                취소
                            </Button>
                        )}
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {surface ? "수정 저장" : "표면 추가"}
                        </Button>
                    </div>
                </div>
            </form >
        </Form >
    );
}
