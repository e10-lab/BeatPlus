import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_MATERIALS, CATEGORY_LABELS } from "@/lib/materials";
import { useState, useEffect } from "react";

interface LayerRowProps {
    form: UseFormReturn<any>; // Using any to avoid complex circular type deps
    index: number;
    remove: (index: number) => void;
    insert: (index: number, value: any) => void;
    length: number;
    isLastLayer: boolean;
    catType: "window" | "std";
    parentCategory: string; // Passed from parent to control filtering
    dragHandleProps?: any; // DndKit listeners
}

export const LayerRow = ({ form, index, remove, insert, length, isLastLayer, catType, parentCategory, dragHandleProps }: LayerRowProps) => {
    // Watch the material ID to derive/sync category
    const materialId = form.watch(`layers.${index}.materialId`);

    // Derived state for category
    const initialMat = DEFAULT_MATERIALS.find(m => m.id === materialId);

    // Determine initial category state
    const getInitialCategory = () => {
        if (materialId === "custom") return "custom";
        return initialMat?.category || "construction";
    };

    const [category, setCategory] = useState<string>(getInitialCategory());

    // Sync local category state when materialId changes externally
    useEffect(() => {
        if (materialId === "custom") {
            setCategory("custom");
        } else {
            const mat = DEFAULT_MATERIALS.find(m => m.id === materialId);
            if (mat) {
                setCategory(mat.category);
            }
        }
    }, [materialId]);

    // Derived lists
    // Filter out window-related categories for standard layers and add 'custom'
    const availableCategories: string[] = Array.from(new Set(DEFAULT_MATERIALS.map(m => m.category)))
        .filter(c => !['glass', 'gas', 'air'].includes(c))
        .filter(c => c !== 'door' || parentCategory === 'door'); // Hide door materials unless parent is door
    availableCategories.push('custom');

    const filteredMaterials = DEFAULT_MATERIALS.filter(m => m.category === category);

    const getCategoryLabel = (cat: string) => {
        if (cat === 'custom') return "직접 입력 (Direct Input)";
        return CATEGORY_LABELS[cat] || cat;
    };

    // --- Window Logic (Glass/Gas) ---
    if (catType === "window") {
        return null;
    }

    // --- Standard Logic (Wall/Roof/Floor) ---
    return (
        <div className="flex flex-col">
            {/* Desktop Grid Layout */}
            <div className="hidden md:grid grid-cols-[30px_220px_1fr_100px_120px_90px] gap-4 items-center mb-2">
                {/* 0. Index & Drag Handle */}
                <div className="flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" {...dragHandleProps}>
                    <GripVertical className="w-4 h-4" />
                    <span className="text-xs font-mono">{index + 1}</span>
                </div>

                {/* 1. Category */}
                <div>
                    <FormItem className="space-y-0">
                        <Select
                            value={category}
                            onValueChange={(newCat) => {
                                setCategory(newCat);
                                if (newCat === "custom") {
                                    form.setValue(`layers.${index}.materialId`, "custom", { shouldDirty: true });
                                    form.setValue(`layers.${index}.customName`, "");
                                    form.setValue(`layers.${index}.customThermalConductivity`, 0);
                                    form.setValue(`layers.${index}.thickness`, 0.1);
                                } else {
                                    const firstMat = DEFAULT_MATERIALS.find(m => m.category === newCat);
                                    if (firstMat) {
                                        form.setValue(`layers.${index}.materialId`, firstMat.id, { shouldDirty: true });
                                        form.setValue(`layers.${index}.thickness`, firstMat.defaultThickness || 0.1);
                                        // Clear custom fields
                                        form.setValue(`layers.${index}.customName`, undefined);
                                        form.setValue(`layers.${index}.customThermalConductivity`, undefined);
                                    }
                                }
                            }}
                        >
                            <FormControl>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="분류" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {availableCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>
                                        {getCategoryLabel(cat)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                </div>

                {/* 2. Material Name OR Custom Name Input */}
                <div>
                    {category === "custom" ? (
                        <FormField
                            control={form.control}
                            name={`layers.${index}.customName`}
                            render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="자재명 입력"
                                            className="h-9"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    ) : (
                        <FormField
                            control={form.control}
                            name={`layers.${index}.materialId`}
                            render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <Select
                                        onValueChange={(val) => {
                                            field.onChange(val);
                                            const mat = DEFAULT_MATERIALS.find(m => m.id === val);
                                            if (mat?.defaultThickness) {
                                                form.setValue(`layers.${index}.thickness`, mat.defaultThickness);
                                            }
                                        }}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="자재 선택" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {filteredMaterials.map(m => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    )}
                </div>

                {/* 3. Thermal Conductivity (Read Only or Editable) */}
                <div className="text-right">
                    {category === "custom" ? (
                        <FormField
                            control={form.control}
                            name={`layers.${index}.customThermalConductivity`}
                            render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            {...field}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                            className="h-9 text-right"
                                            placeholder="0.000"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    ) : (
                        <div className="h-9 px-2 py-2 border rounded-md bg-muted text-sm flex items-center justify-end whitespace-nowrap overflow-hidden text-ellipsis">
                            {initialMat?.thermalConductivity || "-"}
                        </div>
                    )}
                </div>

                {/* 4. Thickness Input */}
                <div>
                    <FormField
                        control={form.control}
                        name={`layers.${index}.thickness`}
                        render={({ field }) => (
                            <FormItem className="space-y-0">
                                <FormControl>
                                    <div className="relative">
                                        <Input
                                            {...field}
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={Math.round((field.value || 0) * 1000)}
                                            onChange={(e) => {
                                                const mm = parseFloat(e.target.value);
                                                field.onChange(isNaN(mm) ? 0 : mm / 1000);
                                            }}
                                            className="h-9 pr-6 text-right"
                                        />
                                        <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">mm</span>
                                    </div>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                {/* 5. Actions */}
                <div className="flex gap-1 justify-center">
                    {/* Inline Add Button */}
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => {
                        insert(index + 1, { id: uuidv4(), materialId: "", thickness: 0.1 });
                    }}>
                        <Plus className="w-4 h-4" />
                    </Button>

                    {/* Trash Button */}
                    {(isLastLayer && index === 0) ? (
                        <div className="w-9"></div>
                    ) : (
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 hover:text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Mobile View / Fallback (Visible only on small screens) */}
            <div className="flex md:hidden flex-col gap-2 p-2 border rounded-lg mb-2">
                <div className="text-xs text-muted-foreground">Mobile view not optimized. Please use desktop.</div>
            </div>
        </div>
    );
};
