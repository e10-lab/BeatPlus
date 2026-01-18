"use client";

import { useForm } from "react-hook-form";
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
import { Surface, SurfaceType, Orientation } from "@/types/project";
import { createSurface, updateSurface } from "@/services/surface-service";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
    name: z.string().min(1, "표면 이름을 입력해주세요."),
    type: z.enum([
        "wall_exterior",
        "wall_interior",
        "roof",
        "floor_ground",
        "floor_interior",
        "window",
        "door"
    ]),
    area: z.coerce.number().min(0.01, "면적은 0보다 커야 합니다."),
    uValue: z.coerce.number().min(0.01, "열관류율은 0보다 커야 합니다."),
    orientation: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW", "Horiz"]).optional(),
    tilt: z.coerce.number().min(0).max(180).optional(),
});

type SurfaceFormValues = z.infer<typeof formSchema>;

interface SurfaceFormProps {
    projectId: string;
    zoneId: string;
    surface?: Surface;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function SurfaceForm({ projectId, zoneId, surface, onSuccess, onCancel }: SurfaceFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const form = useForm<SurfaceFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: surface?.name || "",
            type: (surface?.type as any) || "wall_exterior",
            area: surface?.area || 0,
            uValue: surface?.uValue || 0.2,
            orientation: surface?.orientation || "S",
            tilt: surface?.tilt !== undefined ? surface.tilt : 90,
        },
    });

    // Watch type to conditionally show fields
    const surfaceType = form.watch("type");
    const isExterior = ["wall_exterior", "roof", "window", "door"].includes(surfaceType);
    const isHorizontal = ["roof", "floor_ground", "floor_interior"].includes(surfaceType);

    const onSubmit = async (values: SurfaceFormValues) => {
        setLoading(true);
        setError("");
        try {
            const surfaceData: any = {
                name: values.name,
                type: values.type as SurfaceType,
                area: values.area,
                uValue: values.uValue,
            };

            if (isExterior) {
                surfaceData.orientation = values.orientation as Orientation;
                surfaceData.tilt = values.tilt;
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

                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>유형</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="유형 선택" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="wall_exterior">외벽 (Exterior Wall)</SelectItem>
                                        <SelectItem value="wall_interior">내벽 (Interior Wall)</SelectItem>
                                        <SelectItem value="roof">지붕 (Roof)</SelectItem>
                                        <SelectItem value="floor_ground">바닥 (Ground Floor)</SelectItem>
                                        <SelectItem value="floor_interior">층간 바닥 (Interior Floor)</SelectItem>
                                        <SelectItem value="window">창호 (Window)</SelectItem>
                                        <SelectItem value="door">문 (Door)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

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
                                <FormLabel>열관류율 (W/m²K)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.20"
                                        {...field}
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
                                    <Select onValueChange={field.onChange} defaultValue={field.value || "S"}>
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
                                    <FormLabel>경사각 (°)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="1"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        수직=90, 수평=0
                                    </FormDescription>
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
            </form>
        </Form>
    );
}
