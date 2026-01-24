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
import { calculateSHGC } from "@/lib/shgc-calculator";
import { useEffect } from "react";
import { LayerRow } from "./layer-row";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
        "roof_exterior", "roof_interior", "roof_ground",
        "floor_ground", "floor_interior", "floor_exterior",
        "window", "door"
    ] as const),
    layers: z.array(layerSchema),
    r_si: z.coerce.number().min(0),
    r_se: z.coerce.number().min(0),
    frameId: z.string().optional(),
    absorptionCoefficient: z.coerce.number().min(0).max(1).optional(),
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
    if (type === "wall_exterior" || type === "floor_exterior" || type === "roof_exterior" || type === "window" || type === "door") return "direct";
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
            return "roof_exterior";
        case "window":
            return "window";
        case "door":
            return "door";
    }
};

interface SortableLayerRowProps {
    id: string;
    form: any;
    index: number;
    remove: (index: number) => void;
    insert: (index: number, value: any) => void;
    length: number;
    isLastLayer: boolean;
    catType: "window" | "std";
    parentCategory: string;
}

function SortableLayerRow({ id, ...props }: SortableLayerRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        opacity: isDragging ? 0.5 : 1,
        position: "relative" as const,
    };

    return (
        <div ref={setNodeRef} style={style}>
            {/* Pass drag listeners to LayerRow */}
            <LayerRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
        </div>
    );
}

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
            absorptionCoefficient: initialData?.absorptionCoefficient ?? 0.5,
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

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = fields.findIndex((item) => item.id === active.id);
            const newIndex = fields.findIndex((item) => item.id === over.id);
            move(oldIndex, newIndex);
        }
    };

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

            // If coming from Window or Door, or if layers empty, reset to 1 default layer
            if (currentCategory === "window" || currentCategory === "door" || form.getValues("layers").length === 0) {
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
        const hydratedLayers = data.layers.map(l => {
            const mat = DEFAULT_MATERIALS.find(m => m.id === l.materialId);
            return {
                ...l,
                name: l.materialId === "custom" ? l.customName : mat?.name,
                thermalConductivity: l.materialId === "custom" ? l.customThermalConductivity : mat?.thermalConductivity
            };
        });

        const isWindowOrDoor = data.type === "window" || data.type === "door";

        const result: Construction = {
            ...data,
            type: data.type as SurfaceType,
            uValue: parseFloat(uValue.toFixed(3)),
            totalThickness: parseFloat(totalThickness.toFixed(3)),
            shgc: isWindowOrDoor ? calculateSHGC(hydratedLayers as Layer[]) : undefined,
            absorptionCoefficient: !isWindowOrDoor ? data.absorptionCoefficient : undefined,
            layers: hydratedLayers
        };
        onSave(result);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">{initialData ? "외피 유형 수정 (Edit Assembly)" : "새 외피 유형 (New Assembly)"}</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-0.5">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="lg:col-span-1 min-w-0">
                                <FormLabel>이름 (Name)</FormLabel>
                                <FormControl>
                                    <Input placeholder="예: 외벽 타입 A (e.g. Exterior Wall Type A)" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Category */}
                    <FormItem className="min-w-0">
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

                    {/* Exposure */}
                    <FormItem className="min-w-0">
                        <FormLabel>외기 접촉 (Exposure)</FormLabel>
                        <Select
                            value={currentExposure}
                            onValueChange={(val) => handleExposureChange(val as Exposure)}
                        >
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="direct">직접 (Direct) (Fx=1.0)</SelectItem>
                                <SelectItem value="indirect">간접 (Indirect) (Fx=0.5)</SelectItem>
                                {!['window', 'door'].includes(currentCategory) && (
                                    <SelectItem value="ground">지면 (Ground) (Fx=0.6)</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </FormItem>

                    {/* Frame Selection */}
                    {['window', 'door'].includes(currentCategory) && (
                        <FormItem className="min-w-0">
                            <FormLabel>창틀/문틀 (Frame)</FormLabel>
                            <Select
                                value={form.watch("frameId") || ""}
                                onValueChange={(val) => form.setValue("frameId", val, { shouldDirty: true })}
                            >
                                <FormControl>
                                    <SelectTrigger className="truncate">
                                        <SelectValue className="truncate" placeholder="프레임 선택" />
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
                            <div className="space-y-2">
                                {/* Absorption Coefficient (Only for Exterior Opaque) */
                                    (currentType === "wall_exterior" || currentType === "roof_exterior") && (
                                        <div className="px-4 py-3 bg-slate-100 rounded border border-slate-200">
                                            <div className="flex flex-col gap-2">
                                                <FormLabel className="text-xs text-muted-foreground block">
                                                    태양 복사 흡수율 (Solar Absorption Coefficient) - α
                                                </FormLabel>
                                                <div className="flex flex-wrap gap-2">
                                                    {currentType.startsWith("wall") ? (
                                                        // Wall Options
                                                        [
                                                            { label: "밝은색 (0.4)", value: 0.4 },
                                                            { label: "중간색 (0.6)", value: 0.6 },
                                                            { label: "어두운색 (0.8)", value: 0.8 }
                                                        ].map((opt) => (
                                                            <Button
                                                                key={opt.label}
                                                                type="button"
                                                                variant={form.watch("absorptionCoefficient") === opt.value ? "default" : "outline"}
                                                                size="sm"
                                                                className="h-7 text-xs flex-1 min-w-[80px]"
                                                                onClick={() => form.setValue("absorptionCoefficient", opt.value, { shouldDirty: true })}
                                                            >
                                                                {opt.label}
                                                            </Button>
                                                        ))
                                                    ) : (
                                                        // Roof Options
                                                        [
                                                            { label: "금속 (0.2)", value: 0.2 },
                                                            { label: "적색기와 (0.6)", value: 0.6 },
                                                            { label: "슁글 (0.6)", value: 0.6 },
                                                            { label: "어두운색 (0.8)", value: 0.8 }
                                                        ].map((opt) => (
                                                            <Button
                                                                key={opt.label}
                                                                type="button"
                                                                variant={form.watch("absorptionCoefficient") === opt.value ? "default" : "outline"}
                                                                size="sm"
                                                                className="h-7 text-xs flex-1 min-w-[70px]"
                                                                onClick={() => form.setValue("absorptionCoefficient", opt.value, { shouldDirty: true })}
                                                            >
                                                                {opt.label}
                                                            </Button>
                                                        ))
                                                    )}
                                                    <div className="relative w-20 min-w-[80px]">
                                                        <Input
                                                            type="number"
                                                            step="0.05"
                                                            min="0"
                                                            max="1"
                                                            className="h-7 text-xs pr-1"
                                                            placeholder="Custom"
                                                            value={form.watch("absorptionCoefficient") ?? 0.5}
                                                            onChange={(e) => form.setValue("absorptionCoefficient", parseFloat(e.target.value))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                {/* Surface Resistance Display */
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
                                    </div>}
                            </div>
                        )}

                        {/* Drag and Drop Layer List */}
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={fields.map(f => f.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {fields.map((field, index) => {
                                    // Window/Door Specialized Rendering (Logic skipped for brevity - assume same logic needs to be inside map)
                                    // Actually I must include the logic here.

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
                                        <SortableLayerRow
                                            key={field.id}
                                            id={field.id}
                                            form={form}
                                            index={index}
                                            insert={insert}
                                            remove={remove}
                                            isLastLayer={fields.length === 1}
                                            length={fields.length}
                                            catType="std"
                                            parentCategory={currentCategory} // Pass current category
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>

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
                        {/* Slot 1: SHGC (Window/Door) OR Total R (Others) */}
                        {(currentCategory === "window" || currentCategory === "door") ? (
                            <div>
                                <div className="text-sm text-muted-foreground">일사취득 (SHGC)</div>
                                <div className="text-xl font-mono text-blue-600">
                                    {calculateSHGC(watchedLayers.map(l => ({ ...l, materialId: l.materialId || "" } as Layer))).toFixed(3)}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="text-sm text-muted-foreground">총 열저항 (Rt)</div>
                                <div className="text-xl font-mono">{totalR.toFixed(3)} m²K/W</div>
                            </div>
                        )}

                        {/* Slot 2: Thickness */}
                        <div>
                            <div className="text-sm text-muted-foreground">총 두께 (Total Thickness)</div>
                            <div className="text-xl font-mono">{(totalThickness * 1000).toFixed(0)} mm</div>
                        </div>

                        {/* Slot 3: U-Value */}
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
                    <Button type="submit">외피 유형 저장 (Save Assembly)</Button>
                </div>
            </form>
        </Form >
    );
}
