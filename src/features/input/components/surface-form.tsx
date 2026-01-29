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
import { useState } from "react";
import { Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    orientation: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW", "Horiz", "NoExposure"]).optional(),
    tilt: z.coerce.number().min(0).max(180).optional(),
    shading: z.object({
        hasDevice: z.boolean(),
        type: z.enum(["internal", "external", "intermediate"]).optional(),
        fcValue: z.coerce.number().min(0).max(1).optional(),
    }).optional(),
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
            type: surface?.type || "wall_exterior",
            area: surface?.area || 0,
            uValue: surface?.uValue || 0.20,
            orientation: (surface?.orientation as any) || "S",

            tilt: surface?.tilt !== undefined ? surface.tilt : 90,
            shading: {
                hasDevice: surface?.shading?.hasDevice || false,
                type: surface?.shading?.type || "external",
                fcValue: surface?.shading?.fcValue || 0.25,
            }
        },
    });

    const hasShading = form.watch("shading.hasDevice");

    // Watch type to conditionally show fields
    const currentType = form.watch("type");
    const isExterior = currentType === "wall_exterior" || currentType === "roof_exterior" || currentType === "floor_exterior" || currentType === "floor_ground" || currentType === "window" || currentType === "door"; // Added floor_ground to visible fields logic
    const isHorizontal = ["roof_exterior", "floor_ground", "floor_interior", "floor_exterior", "roof_ground", "roof_interior"].includes(currentType);

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

    const handleConstructionSelect = (id: string) => {
        setSelectedConstructionId(id);
        const constr = constructions.find(c => c.id === id);
        if (constr) {
            form.setValue("uValue", constr.uValue);
            form.setValue("type", constr.type as any);

            // Set default tilt based on type
            if (constr.type.startsWith("wall")) {
                form.setValue("tilt", 90);
                // Also reset orientation to defaults if needed, but keeping current is usually better unless invalid
            } else if (constr.type === "roof_exterior") {
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
                constructionId: selectedConstructionId || undefined,
            };

            if (isExterior || values.type === 'roof_exterior') {
                surfaceData.orientation = values.orientation as Orientation;
                surfaceData.tilt = values.tilt;
            }

            if (values.type === 'window' && values.shading?.hasDevice) {
                surfaceData.shading = {
                    hasDevice: true,
                    type: values.shading.type,
                    fcValue: values.shading.fcValue || 0.25,
                    operationMode: "manual" // Default for now
                };
            } else if (values.type === 'window') {
                surfaceData.shading = { hasDevice: false, fcValue: 1.0 };
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

                    {/* Row 2: Type and Assembly Preset */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>

                    {/* Row 3: Area and U-Value */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <FormField
                            control={form.control}
                            name="uValue"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-1">
                                        <FormLabel>열관류율 (W/m²K)</FormLabel>
                                        {selectedConstructionId && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>외피 유형에 의해 고정됨</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.20"
                                            {...field}
                                            readOnly={!!selectedConstructionId}
                                            className={selectedConstructionId ? "bg-muted" : ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                                                {currentCategory === "roof" ? (
                                                    /* Roof also uses standard directions now, but default is Horiz */
                                                    <>
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
                                                    </>
                                                ) : (
                                                    <>
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
                                                    </>
                                                )}
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

                    {/* Shading Section for Windows */}
                    {currentType === 'window' && (
                        <div className="space-y-4 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm">차양 장치 (Solar Protection)</h4>
                                <FormField
                                    control={form.control}
                                    name="shading.hasDevice"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                            <FormControl>
                                                {/* Using a native checkbox or Switch if available, sticking to native for simplicity or customized Switch */}
                                                <input
                                                    type="checkbox"
                                                    checked={field.value}
                                                    onChange={field.onChange}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                            </FormControl>
                                            <FormLabel className="text-sm font-normal cursor-pointer">
                                                차양 장치 설치
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {hasShading && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/40 rounded-md">
                                    <FormField
                                        control={form.control}
                                        name="shading.type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>설치 위치</FormLabel>
                                                <Select
                                                    onValueChange={(val) => {
                                                        field.onChange(val);
                                                        // Update default FC value based on type
                                                        if (val === 'external') form.setValue("shading.fcValue", 0.25);
                                                        if (val === 'internal') form.setValue("shading.fcValue", 0.50);
                                                        if (val === 'intermediate') form.setValue("shading.fcValue", 0.60);
                                                    }}
                                                    value={field.value || "external"}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="위치 선택" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="external">외부 (External)</SelectItem>
                                                        <SelectItem value="internal">내부 (Internal)</SelectItem>
                                                        <SelectItem value="intermediate">유리 사이 (Intermediate)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="shading.fcValue"
                                        render={({ field }) => (
                                            <FormItem>
                                                <div className="flex items-center gap-1">
                                                    <FormLabel>감소 계수 (Fc)</FormLabel>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>낮을수록 차단 효과 큼 (0.0~1.0)</p>
                                                                <p>외부 블라인드: ~0.25</p>
                                                                <p>내부 커튼: ~0.50</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="1"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
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
            </form>
        </Form>
    );
}
