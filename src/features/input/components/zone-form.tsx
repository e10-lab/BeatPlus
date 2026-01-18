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
import { Zone, ZoneUsageType } from "@/types/project";
import { createZone, updateZone } from "@/services/zone-service";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
    name: z.string().min(1, { message: "존 이름을 입력해주세요." }),
    usageType: z.enum([
        "residential",
        "office",
        "meeting",
        "classroom",
        "warehouse",
        "production"
    ] as [string, ...string[]], {
        required_error: "용도를 선택해주세요.",
    }),
    area: z.coerce.number().min(0.1, { message: "면적은 0보다 커야 합니다." }),
    height: z.coerce.number().min(0.1, { message: "층고는 0보다 커야 합니다." }),
    heatingTemp: z.coerce.number().default(20),
    coolingTemp: z.coerce.number().default(26),
});

interface ZoneFormProps {
    projectId: string;
    zone?: Zone; // If provided, we are in edit mode
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function ZoneForm({ projectId, zone, onSuccess, onCancel }: ZoneFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: zone?.name || "",
            usageType: zone?.usageType || "office",
            area: zone?.area || 0,
            height: zone?.height || 3.0,
            heatingTemp: zone?.temperatureSetpoints?.heating || 20,
            coolingTemp: zone?.temperatureSetpoints?.cooling || 26,
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true);
        setError("");
        try {
            const zoneData = {
                name: values.name,
                usageType: values.usageType as ZoneUsageType,
                area: values.area,
                height: values.height,
                volume: values.area * values.height, // Auto-calculate volume
                temperatureSetpoints: {
                    heating: values.heatingTemp,
                    cooling: values.coolingTemp,
                },
            };

            if (zone && zone.id) {
                await updateZone(projectId, zone.id, zoneData);
            } else {
                await createZone(projectId, zoneData);
            }

            form.reset();
            if (onSuccess) onSuccess();
        } catch (e: any) {
            console.error("Zone save error:", e);
            setError(e.message || "Failed to save zone");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded-lg bg-card text-card-foreground shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>존 이름 (Zone Name)</FormLabel>
                                <FormControl>
                                    <Input placeholder="예: 1층 사무실" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="usageType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>용도 프로필</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="용도 선택" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="office">사무실 (Office)</SelectItem>
                                        <SelectItem value="residential">주거 (Residential)</SelectItem>
                                        <SelectItem value="meeting">회의실 (Meeting)</SelectItem>
                                        <SelectItem value="classroom">강의실 (Classroom)</SelectItem>
                                        <SelectItem value="warehouse">창고 (Warehouse)</SelectItem>
                                        <SelectItem value="production">공장/생산 (Production)</SelectItem>
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
                                <FormLabel>바닥 면적 (m²)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="height"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>층고 (m)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.1" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="heatingTemp"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>난방 설정온도 (°C)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.5" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="coolingTemp"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>냉방 설정온도 (°C)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.5" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                    {onCancel && (
                        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
                            취소
                        </Button>
                    )}
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {zone ? "수정 저장" : "존 추가"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
