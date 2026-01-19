"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Trash2, Plus, Info } from "lucide-react";
import { Construction, Layer, SurfaceType } from "@/types/project";
import { DEFAULT_MATERIALS, SURFACE_HEAT_RESISTANCE, CATEGORY_LABELS, FRAME_TYPES } from "@/lib/materials";
import { calculateStandardUValue } from "@/lib/u-value-calculator";
import { useEffect } from "react";
import { LayerRow } from "./layer-row";

// Schema for Layer Form
const layerSchema = z.object({
    id: z.string(),
    materialId: z.string().min(1, "Material required"),
    thickness: z.coerce.number().min(0.001, "Min 1mm"),
    customName: z.string().optional(),
    customThermalConductivity: z.number().optional()
});

// Schema for Construction Form
const constructionSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string().min(1, "Name required"),
    type: z.enum([
        "wall_exterior", "wall_interior", "wall_ground",
        "roof", "roof_interior", "roof_ground",
        "floor_ground", "floor_interior", "floor_exterior",
        "window", "door"
    ] as const),
    layers: z.array(layerSchema),
    r_si: z.coerce.number().min(0),
    r_se: z.coerce.number().min(0),
    frameId: z.string().optional()
});

export type ConstructionFormValues = z.infer<typeof constructionSchema>;

interface ConstructionFormProps {
    projectId: string;
    initialData?: Construction;
    onSave: (construction: Construction) => void;
    onCancel: () => void;
}

// Helper definitions
type Category = "wall" | "roof" | "floor" | "window" | "door";
type Exposure = "direct" | "indirect" | "ground";

const getCategory = (type: SurfaceType): Category => {
    if (type.startsWith("wall")) return "wall";
    if (type.startsWith("floor")) return "floor";
    if (type.startsWith("roof")) return "roof";
    if (type === "window") return "window";
    if (type === "door") return "door";
    return "wall";
};

const getExposure = (type: SurfaceType): Exposure => {
    if (type === "wall_exterior" || type === "floor_exterior" || type === "roof" || type === "window" || type === "door") return "direct";
    if (type === "wall_interior" || type === "floor_interior" || type === "roof_interior") return "indirect";
    if (type === "wall_ground" || type === "floor_ground" || type === "roof_ground") return "ground";
    return "direct";
};

const getType = (category: Category, exposure: Exposure): SurfaceType => {
    switch (category) {
        case "wall":
            if (exposure === "ground") return "wall_ground";
            if (exposure === "indirect") return "wall_interior";
            return "wall_exterior";
        case "floor":
            if (exposure === "ground") return "floor_ground";
            if (exposure === "indirect") return "floor_interior";
            return "floor_exterior";
        case "roof":
            if (exposure === "ground") return "roof_ground";
            if (exposure === "indirect") return "roof_interior";
            return "roof";
        case "window":
            return "window";
        case "door":
            return "door";
    }
};

export function ConstructionForm({ projectId, initialData, onSave, onCancel }: ConstructionFormProps) {
    const form = useForm<ConstructionFormValues>({
        resolver: zodResolver(constructionSchema) as any,
        defaultValues: initialData || {
            id: uuidv4(),
            projectId,
            name: "",
            type: "wall_exterior",
            layers: [{ id: uuidv4(), materialId: "", thickness: 0.1 }],
            r_si: SURFACE_HEAT_RESISTANCE.R_SI.WALL,
            r_se: SURFACE_HEAT_RESISTANCE.R_SE.DIRECT,
            frameId: "",
        },
    });

    const { fields, append, remove, insert, move, replace } = useFieldArray({
        control: form.control,
        name: "layers",
    });

    const watchedLayers = form.watch("layers");
    const r_si = form.watch("r_si");
    const r_se = form.watch("r_se");
    const currentType = form.watch("type");

    // Derived state for UI
    const currentCategory = getCategory(currentType as SurfaceType);
    const currentExposure = getExposure(currentType as SurfaceType);

    const handleCategoryChange = (newCategory: Category) => {
        // Try to keep exposure if valid, otherwise default
        let newExposure = currentExposure;
        if (newCategory === "window" || newCategory === "door") {
            newExposure = "direct";
        }

        const newType = getType(newCategory, newExposure);
        form.setValue("type", newType);

        // Auto-set R_si
        if (newCategory === "window" || newCategory === "door") {
            form.setValue("r_si", 0);

            // Force reset to 1 glass layer when switching to window or door, regardless of previous state
            if (newCategory === "window" || newCategory === "door") {
                const glassMat = DEFAULT_MATERIALS.find(m => m.id === "mat_glass_std");
                form.setValue("layers", [{ id: uuidv4(), materialId: "mat_glass_std", thickness: glassMat?.defaultThickness || 0.006 }]);
            }
        } else {
            // Standard Categories (Wall, Roof, Floor)
            if (newCategory === "floor") {
                form.setValue("r_si", SURFACE_HEAT_RESISTANCE.R_SI.FLOOR);
            } else if (newCategory === "roof") {
                form.setValue("r_si", SURFACE_HEAT_RESISTANCE.R_SI.ROOF);
            } else {
                form.setValue("r_si", SURFACE_HEAT_RESISTANCE.R_SI.WALL);
            }

            // If coming from Window, or if layers empty, reset to 1 default layer
            if (currentCategory === "window" || form.getValues("layers").length === 0) {
                form.setValue("layers", [{ id: uuidv4(), materialId: "", thickness: 0.1 }]);
            }
        }

        // Auto-set R_se based on current exposure + new category
        updateRse(newCategory, newExposure);
    };

    const handleExposureChange = (newExposure: Exposure) => {
        const newType = getType(currentCategory, newExposure);
        form.setValue("type", newType);

        // Auto-set R_se
        updateRse(currentCategory, newExposure);
    };

    const updateRse = (category: Category, exposure: Exposure) => {
        if (category === "window" || category === "door") {
            form.setValue("r_se", 0);
            return;
        }

        if (exposure === "ground") {
            form.setValue("r_se", SURFACE_HEAT_RESISTANCE.R_SE.GROUND);
        } else if (exposure === "indirect") {
            if (category === "floor") form.setValue("r_se", SURFACE_HEAT_RESISTANCE.R_SE.INDIRECT.FLOOR);
            else if (category === "roof") form.setValue("r_se", SURFACE_HEAT_RESISTANCE.R_SE.INDIRECT.ROOF);
            else form.setValue("r_se", SURFACE_HEAT_RESISTANCE.R_SE.INDIRECT.WALL);
        } else {
            form.setValue("r_se", SURFACE_HEAT_RESISTANCE.R_SE.DIRECT);
        }
    };

    // Calculate U-value on fly
    const calculateUValue = () => {
        // Standard Lookup for Window/Door
        const frameId = form.getValues("frameId");
        if (currentCategory === "window" || currentCategory === "door") {
            const standardU = calculateStandardUValue(currentCategory, frameId, watchedLayers);
            if (standardU !== null) {
                // Calculate thickness for display
                const totalThickness = watchedLayers.reduce((sum, l) => sum + (l.thickness || 0), 0);
                return { uValue: standardU, totalThickness, totalR: standardU > 0 ? 1 / standardU : 0, isStandard: true };
            }
        }

        let totalR = r_si + r_se;
        let totalThickness = 0;

        watchedLayers.forEach(layer => {
            let k = 0;
            if (layer.materialId === "custom") {
                k = layer.customThermalConductivity || 0;
            } else {
                const material = DEFAULT_MATERIALS.find(m => m.id === layer.materialId);
                k = material?.thermalConductivity || 0;
            }

            if (k > 0 && layer.thickness > 0) {
                totalR += layer.thickness / k;
                totalThickness += layer.thickness;
            }
        });

        const uValue = totalR > 0 ? 1 / totalR : 0;
        return { uValue, totalThickness, totalR, isStandard: false };
    };

    const { uValue, totalThickness, totalR, isStandard } = calculateUValue();

    const onSubmit = (data: ConstructionFormValues) => {
        // Hydrate layers with material info for storage/display optimization if needed
        // but core data is just IDs.
        // We pass back the calculated U-value too
        const result: Construction = {
            ...data,
            type: data.type as SurfaceType,
            uValue: parseFloat(uValue.toFixed(3)),
            totalThickness: parseFloat(totalThickness.toFixed(3)),
            layers: data.layers.map(l => {
                const mat = DEFAULT_MATERIALS.find(m => m.id === l.materialId);
                return {
                    ...l,
                    name: l.materialId === "custom" ? l.customName : mat?.name,
                    thermalConductivity: l.materialId === "custom" ? l.customThermalConductivity : mat?.thermalConductivity
                };
            })
        };
        onSave(result);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">{initialData ? "구조체 수정 (Edit Construction)" : "새 구조체 (New Construction)"}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>이름 (Name)</FormLabel>
                                <FormControl>
                                    <Input placeholder="예: 외벽 타입 A (e.g. Exterior Wall Type A)" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Split Classification UI */}
                    <div className="flex gap-2">
                        <FormItem className="flex-1">
                            <FormLabel>부위 (Category)</FormLabel>
                            <Select value={currentCategory} onValueChange={(val) => handleCategoryChange(val as Category)}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="wall">벽체 (Wall)</SelectItem>
                                    <SelectItem value="roof">지붕 (Roof)</SelectItem>
                                    <SelectItem value="floor">바닥 (Floor)</SelectItem>
                                    <SelectItem value="window">창호 (Window)</SelectItem>
                                    <SelectItem value="door">문 (Door)</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>

                        {/* Frame Selection for Window/Door */}
                        {['window', 'door'].includes(currentCategory) && (
                            <FormItem className="flex-1">
                                <FormLabel>창틀/문틀 (Frame)</FormLabel>
                                <Select
                                    value={form.watch("frameId") || ""}
                                    onValueChange={(val) => form.setValue("frameId", val, { shouldDirty: true })}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="프레임 선택" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {FRAME_TYPES.map((frame) => (
                                            <SelectItem key={frame.id} value={frame.id}>{frame.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}

                        {/* Exposure - Only for non-Window/Door */}
                        {!['window', 'door'].includes(currentCategory) && (
                            <FormItem className="flex-1">
                                <FormLabel>외기 접촉 (Exposure)</FormLabel>
                                <Select
                                    value={currentExposure}
                                    onValueChange={(val) => handleExposureChange(val as Exposure)}
                                    disabled={currentCategory === "window" || currentCategory === "door"}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="direct">직접 (Direct)</SelectItem>
                                        <SelectItem value="indirect">간접 (Indirect)</SelectItem>
                                        <SelectItem value="ground">지면 (Ground)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    </div>
                </div>



                {/* Layer List */}
                <Card>
                    <CardHeader className="py-3 bg-muted/30">
                        <CardTitle className="text-sm font-medium flex justify-between items-center">
                            레이어 구성 (외부 → 내부) (Layers: Outside to Inside)

                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        {/* Headers for Large Screens */}

                        {/* Top Resistance Display - Based on Category */}
                        {fields.length > 0 && currentCategory !== "window" && currentCategory !== "door" && (
                            <div className="flex gap-2 items-center px-4 py-2 bg-slate-100 rounded text-xs text-muted-foreground border border-slate-200">
                                <div className="w-6"></div>
                                <div className="flex-1 font-medium">
                                    {currentCategory === "floor"
                                        ? "실내 표면 (Indoor Surface) - R_si"
                                        : "실외 표면 (Outdoor Surface) - R_se"}
                                </div>
                                <div className="w-24 text-right font-mono">
                                    {currentCategory === "floor" ? r_si : r_se} m²K/W
                                </div>
                                <div className="w-8"></div>
                            </div>
                        )}

                        {fields.map((field, index) => {
                            // Window/Door Specialized Rendering
                            if (currentCategory === "window" || currentCategory === "door") {
                                const isGlass = index % 2 === 0;
                                const isLastLayer = index === fields.length - 1;

                                return (
                                    <div key={field.id} className="grid grid-cols-[24px_1fr_100px_80px] gap-2 items-center">
                                        <span className="text-sm text-muted-foreground w-6 text-center">{index + 1}.</span>
                                        <FormField
                                            control={form.control}
                                            name={`layers.${index}.materialId`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel className="sr-only">Material</FormLabel>
                                                    {(() => {
                                                        // Check if First Layer is Double Sash
                                                        const firstLayerId = form.getValues("layers.0.materialId");
                                                        const isDoubleSashMode = (firstLayerId === "door_double_low_glass" || firstLayerId === "door_double_high_glass");

                                                        // Read-only label logic for Double Sash (Layers 2 & 3)
                                                        if (isDoubleSashMode && currentCategory === "door") {
                                                            if (index === 1) {
                                                                return (
                                                                    <div className="flex h-9 w-full items-center px-3 py-2 text-sm">
                                                                        공기 (Air)
                                                                    </div>
                                                                );
                                                            }
                                                            if (index === 2) {
                                                                const matName = DEFAULT_MATERIALS.find(m => m.id === firstLayerId)?.name;
                                                                return (
                                                                    <div className="flex h-9 w-full items-center px-3 py-2 text-sm">
                                                                        {matName}
                                                                    </div>
                                                                );
                                                            }
                                                        }

                                                        // Standard Select
                                                        return (
                                                            <Select onValueChange={(val) => {
                                                                const mat = DEFAULT_MATERIALS.find(m => m.id === val);

                                                                // Enforce Double Sash Structure (Door + Air + Door)
                                                                const isDoubleSash = currentCategory === "door" && index === 0 && (
                                                                    val === "door_double_low_glass" || val === "door_double_high_glass"
                                                                );

                                                                if (isDoubleSash) {
                                                                    const airMat = DEFAULT_MATERIALS.find(m => m.id === "mat_gas_air");
                                                                    replace([
                                                                        { id: uuidv4(), materialId: val, thickness: mat?.defaultThickness || 0.024 },
                                                                        { id: uuidv4(), materialId: "mat_gas_air", thickness: airMat?.defaultThickness || 0.012 },
                                                                        { id: uuidv4(), materialId: val, thickness: mat?.defaultThickness || 0.024 }
                                                                    ]);
                                                                    return;
                                                                }

                                                                // If switching AWAY from Double Sash (to General/Single Door) in Layer 1, reset to single layer
                                                                if (currentCategory === "door" && index === 0 && !isDoubleSash && fields.length > 1) {
                                                                    replace([
                                                                        { id: uuidv4(), materialId: val, thickness: mat?.defaultThickness || 0.04 }
                                                                    ]);
                                                                    return;
                                                                }

                                                                // Standard Update
                                                                field.onChange(val);
                                                                if (mat?.defaultThickness) {
                                                                    form.setValue(`layers.${index}.thickness`, mat.defaultThickness);
                                                                }
                                                            }} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={isGlass ? "유리 선택" : "기체 선택"} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {isGlass ? (
                                                                        // Glass Options
                                                                        // Glass Options (Plus Door options for 1st layer of Door)
                                                                        DEFAULT_MATERIALS.filter(m => {
                                                                            if (m.category === "glass") return true;
                                                                            if (currentCategory === "door" && index === 0 && m.category === "door") return true;
                                                                            return false;
                                                                        }).map(m => (
                                                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                                        ))
                                                                    ) : (
                                                                        // Gas Options
                                                                        DEFAULT_MATERIALS.filter(m => m.category === "gas").map(m => (
                                                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                                        ))
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        );
                                                    })()}
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`layers.${index}.thickness`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="sr-only">Thk</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                value={field.value ? Math.round(field.value * 1000) : ""}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    field.onChange(isNaN(val) ? 0 : val / 1000);
                                                                }}
                                                                className="pr-8"
                                                            />
                                                            <span className="absolute right-2 top-2 text-xs text-muted-foreground">mm</span>
                                                        </div>
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        {/* Actions Container */}
                                        <div className="flex gap-1 justify-end">
                                            {/* Add Button: Only on last layer if it's Glass and not maxed out */}
                                            {isGlass && isLastLayer && fields.length < 7 && (() => {
                                                // Check if first layer is a specific Door type (category='door')
                                                const firstLayerMatId = form.getValues(`layers.0.materialId`);
                                                const firstLayerMat = DEFAULT_MATERIALS.find(m => m.id === firstLayerMatId);
                                                const isDoorType = firstLayerMat?.category === "door";

                                                if (currentCategory === "door" && isDoorType) return null;

                                                return (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => {
                                                            // Add Gas + Glass
                                                            const airMat = DEFAULT_MATERIALS.find(m => m.id === "mat_gas_air");
                                                            const glassMat = DEFAULT_MATERIALS.find(m => m.id === "mat_glass_std");
                                                            append({ id: uuidv4(), materialId: "mat_gas_air", thickness: airMat?.defaultThickness || 0.012 });
                                                            append({ id: uuidv4(), materialId: "mat_glass_std", thickness: glassMat?.defaultThickness || 0.006 });
                                                        }}
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </Button>
                                                );
                                            })()}

                                            {/* Trash Button: Only on last layer if not the only layer */}
                                            {index > 0 && isLastLayer && (
                                                <Button type="button" variant="ghost" size="icon" onClick={() => {
                                                    // Remove current Glass and previous Gas
                                                    remove(index);
                                                    remove(index - 1);
                                                }}>
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            // Standard Rendering (Wall/Roof/Floor/Door)
                            return (
                                <LayerRow
                                    key={field.id}
                                    form={form}
                                    index={index}
                                    insert={insert}
                                    remove={remove}
                                    isLastLayer={fields.length === 1}
                                    length={fields.length}
                                    move={move}
                                    catType="std"
                                />
                            );
                        })}

                        {/* Bottom Resistance Display - Based on Category */}
                        {fields.length > 0 && currentCategory !== "window" && currentCategory !== "door" && (
                            <div className="flex gap-2 items-center px-4 py-2 bg-slate-100 rounded text-xs text-muted-foreground border border-slate-200">
                                <div className="w-6"></div>
                                <div className="flex-1 font-medium">
                                    {currentCategory === "floor"
                                        ? "실외 표면 (Outdoor Surface) - R_se"
                                        : "실내 표면 (Indoor Surface) - R_si"}
                                </div>
                                <div className="w-24 text-right font-mono">
                                    {currentCategory === "floor" ? r_se : r_si} m²K/W
                                </div>
                                <div className="w-8"></div>
                            </div>
                        )}

                        {fields.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">정의된 레이어가 없습니다. (No layers defined.)</div>}
                    </CardContent>
                </Card>

                {/* Results Preview */}
                <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="pt-6 grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-sm text-muted-foreground">총 열저항 (Rt)</div>
                            <div className="text-xl font-mono">{totalR.toFixed(3)} m²K/W</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">총 두께 (Total Thickness)</div>
                            <div className="text-xl font-mono">{(totalThickness * 1000).toFixed(0)} mm</div>
                        </div>
                        <div className="font-bold text-primary">
                            <div className="text-sm text-muted-foreground">열관류율 (U-Value)</div>
                            <div className="text-2xl font-mono flex items-center justify-center gap-2">
                                {uValue.toFixed(3)} W/m²K
                                {isStandard && <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">표준값</span>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>취소 (Cancel)</Button>
                    <Button type="submit">구조체 저장 (Save Construction)</Button>
                </div>
            </form>
        </Form >
    );
}
