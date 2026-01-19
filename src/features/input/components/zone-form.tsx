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
import { Loader2, Info, Clock, Lightbulb, Thermometer, Wind, Fan, Zap } from "lucide-react";
import { DIN_18599_PROFILES, PROFILE_OPTIONS } from "@/lib/din-18599-profiles";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formSchema = z.object({
    name: z.string().min(1, { message: "존 이름을 입력해주세요." }),
    usageType: z.enum([
        "1_single_office", "2_group_office", "3_open_plan_office", "4_meeting", "5_counter",
        "6_retail", "7_retail_refrig", "8_classroom", "9_lecture_hall",
        "10_bed_room", "11_hotel_room", "12_canteen", "13_restaurant",
        "14_kitchen", "15_kitchen_prep", "16_wc", "17_common_area",
        "18_support_store", "19_corridor_care", "20_storage_uncond", "21_datacenter",
        "22_1_workshop_light", "22_2_workshop_medium", "22_3_workshop_heavy",
        "23_theater_audience", "24_cloakroom", "25_theater_foh", "26_stage", "27_exhibition",
        "28_fair",
        "29_library_public", "30_library_stack", "31_gym",
        "32_parking_office", "33_parking_public",
        "34_sauna", "35_fitness", "36_lab", "37_exam_room", "38_icu", "39_corridor_icu",
        "40_medical_practice", "41_logistics", "42_server_room",
        "residential_single", "residential_multi", "residential_general"
    ]),
    area: z.coerce.number().min(0.1, { message: "면적은 0보다 커야 합니다." }),
    height: z.coerce.number().min(0.1, { message: "천정고는 0보다 커야 합니다." }),
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
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: zone?.name || "",
            usageType: zone?.usageType || "1_single_office",
            area: zone?.area || 0,
            height: zone?.height || 3.0,
            heatingTemp: zone?.temperatureSetpoints?.heating || 20,
            coolingTemp: zone?.temperatureSetpoints?.cooling || 26,
        },
    });

    // Watch usageType to show details and auto-update
    const selectedUsage = form.watch("usageType");
    const selectedProfile = DIN_18599_PROFILES[selectedUsage as string];

    // Effect to update temperature setpoints when usage type changes
    // Only update if the user hasn't manually changed them?
    // For now, we always update on profile switch for convenience.
    // We wrapped this in a useEffect to avoid render loop, but need to be careful.
    // Actually, onValueChange in the Select is safer than useEffect for this.
    // But since multiple fields need update, we can use the onChange handler in the render.

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
                                <FormLabel>존 이름</FormLabel>
                                <FormControl>
                                    <Input placeholder="예: 1층 사무실" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="space-y-2">
                        <FormField
                            control={form.control}
                            name="usageType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        용도 프로필 (DIN V 18599-10)
                                        {selectedProfile && (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                                                        <Info className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2 text-xl">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                                            프로필 상세 정보: {selectedProfile.name}
                                                        </DialogTitle>
                                                        <DialogDescription>
                                                            DIN V 18599-10 표준에 따른 해당 용도의 표준 설정값입니다.
                                                        </DialogDescription>
                                                    </DialogHeader>

                                                    <div className="grid grid-cols-1 gap-6 mt-4">
                                                        {/* 1. 이용 및 운영 시간 */}
                                                        <Card>
                                                            <CardHeader className="pb-2 bg-muted/40">
                                                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                                    <Clock className="h-4 w-4" /> 1. 이용 및 운영 시간
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="text-sm pt-4 space-y-2">
                                                                <div className="flex justify-between"><span>일일 이용 시간</span> <span className="font-mono">{selectedProfile.dailyUsageHours} h</span></div>
                                                                <div className="flex justify-between"><span>연간 이용 일수</span> <span className="font-mono">{selectedProfile.annualUsageDays} d</span></div>
                                                                <div className="border-t my-2" />
                                                                <div className="flex justify-between text-muted-foreground mr-1"><span>주간 연간 이용시간 (07-18)</span> <span className="font-mono">{selectedProfile.usageHoursDay} h</span></div>
                                                                <div className="flex justify-between text-muted-foreground mr-1"><span>야간 연간 이용시간 (18-07)</span> <span className="font-mono">{selectedProfile.usageHoursNight} h</span></div>
                                                                <div className="flex justify-between text-muted-foreground"><span>시간대</span> <span className="font-mono">{selectedProfile.usageHoursStart}:00 - {selectedProfile.usageHoursEnd}:00</span></div>
                                                                <div className="border-t my-2" />
                                                                <div className="flex justify-between"><span>공조 일일 운전</span> <span className="font-mono">{selectedProfile.hvacDailyOperationHours} h</span></div>
                                                                <div className="flex justify-between"><span>공조 연간 운전</span> <span className="font-mono">{selectedProfile.hvacAnnualOperationDays} d</span></div>
                                                            </CardContent>
                                                        </Card>

                                                        {/* 2. 조명 */}
                                                        <Card>
                                                            <CardHeader className="pb-2 bg-muted/40">
                                                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                                    <Lightbulb className="h-4 w-4" /> 2. 조명
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="text-sm pt-4 space-y-2">
                                                                <div className="flex justify-between"><span>조도 유지값 (Em)</span> <span className="font-mono">{selectedProfile.illuminance} lx</span></div>
                                                                <div className="flex justify-between"><span>작업면 높이</span> <span className="font-mono">{selectedProfile.workplaneHeight} m</span></div>
                                                                <div className="flex justify-between"><span>조도 감소 계수 (kL)</span> <span className="font-mono">{selectedProfile.illuminanceDepreciationFactor}</span></div>
                                                                <div className="flex justify-between"><span>상대적 부재율 (FA)</span> <span className="font-mono">{selectedProfile.lightingAbsenceFactor}</span></div>
                                                                <div className="flex justify-between"><span>부분 가동 계수 (FTe)</span> <span className="font-mono">{selectedProfile.partialOperationFactorLighting}</span></div>
                                                            </CardContent>
                                                        </Card>

                                                        {/* 3. 실내 온도 */}
                                                        <Card>
                                                            <CardHeader className="pb-2 bg-muted/40">
                                                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                                    <Thermometer className="h-4 w-4" /> 3. 실내 온도
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="text-sm pt-4 space-y-2">
                                                                <div className="flex justify-between font-medium"><span>난방 설정온도</span> <span className="font-mono text-red-500">{selectedProfile.heatingSetpoint} °C</span></div>
                                                                <div className="flex justify-between font-medium"><span>냉방 설정온도</span> <span className="font-mono text-blue-500">{selectedProfile.coolingSetpoint} °C</span></div>
                                                                <div className="border-t my-2" />
                                                                <div className="flex justify-between"><span>절감운전 (난방)</span> <span className="font-mono">{selectedProfile.heatingSetbackTemp} °C</span></div>
                                                                <div className="flex justify-between"><span>설계 최소 (난방)</span> <span className="font-mono">{selectedProfile.heatingDesignMinTemp} °C</span></div>
                                                                <div className="flex justify-between"><span>설계 최대 (냉방)</span> <span className="font-mono">{selectedProfile.coolingDesignMaxTemp} °C</span></div>
                                                            </CardContent>
                                                        </Card>

                                                        {/* 4. 실내 기후 */}
                                                        <Card>
                                                            <CardHeader className="pb-2 bg-muted/40">
                                                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                                    <Wind className="h-4 w-4" /> 4. 실내 기후
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="text-sm pt-4 space-y-2">
                                                                <div className="flex justify-between"><span>습도 요구사항</span> <span className="font-mono">{selectedProfile.humidityRequirement}</span></div>
                                                                <div className="flex justify-between"><span>최소 외기 도입량</span> <span className="font-mono">{selectedProfile.minOutdoorAir} m³/(h·m²)</span></div>
                                                                <div className="flex justify-between"><span>최소 외기 체적 유량</span> <span className="font-mono">{selectedProfile.minOutdoorAirFlow} m³/(h·m²)</span></div>
                                                            </CardContent>
                                                        </Card>

                                                        {/* 5. 공조 시스템 */}
                                                        <Card>
                                                            <CardHeader className="pb-2 bg-muted/40">
                                                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                                    <Fan className="h-4 w-4" /> 5. 공조 시스템
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="text-sm pt-4 space-y-2">
                                                                <div className="flex justify-between"><span>상대적 부재율 (FA,RLT)</span> <span className="font-mono">{selectedProfile.hvacAbsenceFactor}</span></div>
                                                                <div className="flex justify-between"><span>부분 가동 계수 (FTe,RLT)</span> <span className="font-mono">{selectedProfile.hvacPartialOperationFactor}</span></div>
                                                            </CardContent>
                                                        </Card>

                                                        {/* 6. 내부 열획득 */}
                                                        <Card>
                                                            <CardHeader className="pb-2 bg-muted/40">
                                                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                                    <Zap className="h-4 w-4" /> 6. 내부 열획득
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="text-sm pt-4 space-y-2">
                                                                <div className="flex justify-between"><span>인체 발열 (Qp)</span> <span className="font-mono">{selectedProfile.metabolicHeat} Wh/(m²·d)</span></div>
                                                                <div className="flex justify-between"><span>기기 발열 (Qg)</span> <span className="font-mono">{selectedProfile.equipmentHeat} Wh/(m²·d)</span></div>
                                                            </CardContent>
                                                        </Card>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </FormLabel>
                                    <Select
                                        onValueChange={(val) => {
                                            field.onChange(val);
                                            // Auto-update values
                                            const p = DIN_18599_PROFILES[val];
                                            if (p) {
                                                form.setValue("heatingTemp", p.heatingSetpoint);
                                                form.setValue("coolingTemp", p.coolingSetpoint);
                                            }
                                        }}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="용도 선택" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="max-h-[300px]">
                                            {PROFILE_OPTIONS.map((profile) => (
                                                <SelectItem key={profile.id} value={profile.id}>
                                                    {profile.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
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
                                <FormLabel>천정고 (m)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.1" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>



                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex justify-end gap-3 pt-4">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                            취소
                        </Button>
                    )}
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {zone ? "수정 저장" : "존 생성"}
                    </Button>
                </div>
            </form >
        </Form >
    );
}
