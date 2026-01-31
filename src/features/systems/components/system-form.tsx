"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { BuildingSystem } from "@/types/system";
import { Zone } from "@/types/project";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Droplets, Snowflake, Sun, Wind, RefreshCw, Lightbulb } from "lucide-react";
import { useState, useEffect } from "react";
import { GeneratorSelection } from "./generator-selection";

// Types for form
const systemBaseSchema = z.object({
    name: z.string().min(1, "시스템 이름을 입력하세요"),
    isShared: z.boolean().default(true),
    linkedZoneIds: z.array(z.string()).default([]),
});

// DHW Schema
const dhwSchema = systemBaseSchema.extend({
    type: z.literal("DHW"),
    generator: z.object({
        type: z.enum(["boiler", "heat_pump", "electric_heater", "district", "solar"]),
        fuel: z.enum(["electricity", "natural_gas", "oil", "lpg", "district_heating", "wood_pellet", "solar_thermal", "heat_pump_air", "heat_pump_geo"]),
        efficiency: z.coerce.number().min(0.1).max(10), // COP can be > 1
        capacity: z.coerce.number().optional(),
    }),
    storage: z.object({
        volume: z.coerce.number().min(0),
        temperature: z.coerce.number().min(30).max(90).default(60),
        location: z.enum(["conditioned", "unconditioned"]).default("conditioned"),
    }).optional(),
    distribution: z.object({
        hasCirculation: z.boolean(),
        pipeInsulation: z.enum(["none", "basic", "good", "reinforced"]),
        pipeLength: z.coerce.number().optional(),
    }),
});

// Heating Schema
const heatingSchema = systemBaseSchema.extend({
    type: z.literal("HEATING"),
    generator: z.object({
        type: z.enum(["condensing_boiler", "std_boiler", "heat_pump", "ehp", "split", "electric", "district"]),
        fuel: z.enum(["electricity", "natural_gas", "oil", "lpg", "district_heating", "wood_pellet", "solar_thermal", "heat_pump_air", "heat_pump_geo"]),
        efficiency: z.coerce.number().min(0.1).max(10),
        partLoadValue: z.coerce.number().optional(),
    }),
    distribution: z.object({
        temperatureRegime: z.enum(["90/70", "70/50", "55/45", "35/28"]),
        pumpControl: z.enum(["const_pressure", "prop_pressure", "uncontrolled"]),
    }),
    emission: z.object({
        type: z.enum(["radiator", "floor_heating", "fan_coil", "air_heating"]),
    }),
});

// Cooling Schema
const coolingSchema = systemBaseSchema.extend({
    type: z.literal("COOLING"),
    generator: z.object({
        type: z.enum(["compression_chiller", "absorption_chiller", "heat_pump", "ehp", "split"]),
        fuel: z.enum(["electricity", "natural_gas", "oil", "lpg", "district_heating", "wood_pellet", "solar_thermal", "heat_pump_air", "heat_pump_geo"]),
        efficiency: z.coerce.number().min(0.1).max(10),
        condenserType: z.enum(["air_cooled", "water_cooled"]).optional(),
    }),
    distribution: z.object({
        type: z.enum(["air", "water", "refrigerant"]),
    }),
    emission: z.object({
        type: z.enum(["surface", "fan_coil", "air"]),
    }),
});

// PV Schema
const pvSchema = systemBaseSchema.extend({
    type: z.literal("PV"),
    arrays: z.array(z.object({
        name: z.string().min(1),
        capacity: z.coerce.number().min(0), // kWp
        moduleType: z.enum(["crystalline", "thin_film"]),
        orientation: z.enum(["S", "SE", "SW", "E", "W", "N", "NE", "NW", "Horiz", "NoExposure"]), // Matches Orientation type
        tilt: z.coerce.number().min(0).max(90),
        performanceRatio: z.coerce.number().min(0.1).max(1.0).default(0.75),
    })).min(1),
});

// AHU Schema
const ahuSchema = systemBaseSchema.extend({
    type: z.literal("AHU"),
    airflow: z.coerce.number().min(0), // m3/h
    heatRecovery: z.object({
        heatingEfficiency: z.coerce.number().min(0).max(1),
        coolingEfficiency: z.coerce.number().min(0).max(1),
        type: z.enum(["plate", "rotary", "run_around"]),
    }).optional(),
    fanPower: z.coerce.number().min(0), // SFP
    heatingCoil: z.object({
        generatorType: z.enum(["boiler", "heat_pump", "district", "electric"]),
        fuel: z.enum(["electricity", "natural_gas", "oil", "lpg", "district_heating", "wood_pellet", "heat_pump_air", "heat_pump_geo"]),
        efficiency: z.coerce.number().min(0.1),
    }).optional(),
    coolingCoil: z.object({
        generatorType: z.enum(["chiller", "heat_pump", "district"]),
        fuel: z.enum(["electricity", "natural_gas", "district_heating", "heat_pump_air", "heat_pump_geo"]),
        efficiency: z.coerce.number().min(0.1),
    }).optional(),
});

// Lighting Schema
const lightingSchema = systemBaseSchema.extend({
    type: z.literal("LIGHTING"),
    lightingEfficacy: z.coerce.number().min(1),
    controlType: z.enum(["manual", "occupancy", "daylight", "dual", "constant"]),
    hasConstantIlluminanceControl: z.boolean(),
    parasiticPowerDensity: z.coerce.number().optional(),
});

const systemSchema = z.discriminatedUnion("type", [dhwSchema, heatingSchema, coolingSchema, pvSchema, ahuSchema, lightingSchema]);
type FormValues = z.infer<typeof systemSchema>;

interface SystemFormProps {
    projectId: string;
    system?: BuildingSystem;
    zones: Zone[];
    onSave: (system: BuildingSystem) => void;
    onCancel: () => void;
}

export function SystemForm({ projectId, system, zones, onSave, onCancel }: SystemFormProps) {
    const defaultType = system?.type || "DHW";
    const [activeType, setActiveType] = useState<"DHW" | "HEATING" | "COOLING" | "PV" | "AHU" | "LIGHTING">(defaultType as any);

    // Creates default values based on the initial type or system prop
    const createDefaultValues = (type: "DHW" | "HEATING" | "COOLING" | "PV" | "AHU" | "LIGHTING"): Partial<FormValues> => {
        // If editing an existing system of the same type, use it
        if (system && system.type === type) {
            return {
                ...system,
                linkedZoneIds: system.linkedZoneIds || [],
            } as FormValues;
        }

        const base = {
            name: "",
            isShared: true,
            linkedZoneIds: [],
        };

        if (type === "DHW") {
            return {
                ...base,
                type: "DHW",
                generator: {
                    type: "boiler",
                    fuel: "natural_gas",
                    efficiency: 0.9,
                },
                storage: {
                    volume: 200,
                    temperature: 60,
                    location: "conditioned",
                },
                distribution: {
                    hasCirculation: false,
                    pipeInsulation: "basic",
                },
            };
        } else if (type === "HEATING") {
            return {
                ...base,
                type: "HEATING",
                generator: {
                    type: "condensing_boiler",
                    fuel: "natural_gas",
                    efficiency: 0.9,
                },
                distribution: {
                    temperatureRegime: "70/50",
                    pumpControl: "prop_pressure",
                },
                emission: {
                    type: "radiator",
                },
            };
        } else if (type === "COOLING") {
            return {
                ...base,
                type: "COOLING",
                generator: {
                    type: "compression_chiller",
                    fuel: "electricity",
                    efficiency: 3.5,
                },
                distribution: {
                    type: "water",
                },
                emission: {
                    type: "fan_coil",
                },
            };
        } else if (type === "PV") {
            return {
                ...base,
                type: "PV",
                name: "태양광 시스템",
                arrays: [
                    {
                        name: "Array 1",
                        capacity: 3.0,
                        moduleType: "crystalline",
                        orientation: "S",
                        tilt: 30,
                        performanceRatio: 0.8
                    }
                ]
            };
        } else if (type === "AHU") {
            // AHU
            return {
                ...base,
                type: "AHU",
                name: "공조기 / 환기설비 (AHU/ERV/Fans)",
                airflow: 1000,
                fanPower: 1.5,
                heatRecovery: {
                    heatingEfficiency: 0.7,
                    coolingEfficiency: 0.7,
                    type: "plate"
                },
                heatingCoil: {
                    generatorType: "boiler",
                    fuel: "natural_gas",
                    efficiency: 0.9
                },
                coolingCoil: {
                    generatorType: "chiller",
                    fuel: "electricity",
                    efficiency: 3.5
                }
            };
        } else if (type === "LIGHTING" as any) {
            return {
                ...base,
                type: "LIGHTING",
                name: "조명 시스템",
                lightingEfficacy: 100,
                controlType: "manual",
                hasConstantIlluminanceControl: false,
                parasiticPowerDensity: 0.1,
            };
        }
        return base as any;
    };

    const form = useForm<FormValues>({
        resolver: zodResolver(systemSchema) as any,
        defaultValues: createDefaultValues(defaultType),
    });

    const handleTabChange = (value: string) => {
        const newType = value as "DHW" | "HEATING" | "COOLING" | "PV" | "AHU" | "LIGHTING";
        setActiveType(newType);

        // Resetting the form ensures the structure matches the new type
        // This clears errors and sets correct defaults
        const newDefaults = createDefaultValues(newType);
        form.reset(newDefaults);
    };

    function onSubmit(data: FormValues) {
        const newSystem = {
            id: system?.id || crypto.randomUUID(),
            projectId,
            ...data,
        };
        onSave(newSystem as BuildingSystem);
    }

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {activeType === "DHW" && <Droplets className="h-5 w-5 text-blue-500" />}
                    {activeType === "HEATING" && <Flame className="h-5 w-5 text-red-500" />}
                    {activeType === "COOLING" && <Snowflake className="h-5 w-5 text-sky-500" />}
                    {activeType === "AHU" && <Wind className="h-5 w-5 text-purple-500" />}
                    {activeType === "PV" && <Sun className="h-5 w-5 text-yellow-500" />}
                    {activeType === "LIGHTING" && <Lightbulb className="h-5 w-5 text-orange-500" />}
                    시스템 설정
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeType} onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-6 mb-6">
                        <TabsTrigger value="DHW" className="flex items-center gap-2">
                            <Droplets className="h-4 w-4" /> 급탕
                        </TabsTrigger>
                        <TabsTrigger value="HEATING" className="flex items-center gap-2">
                            <Flame className="h-4 w-4" /> 난방
                        </TabsTrigger>
                        <TabsTrigger value="COOLING" className="flex items-center gap-2">
                            <Snowflake className="h-4 w-4" /> 냉방
                        </TabsTrigger>
                        <TabsTrigger value="AHU" className="flex items-center gap-2">
                            <Wind className="h-4 w-4" /> 공조
                        </TabsTrigger>
                        <TabsTrigger value="PV" className="flex items-center gap-2">
                            <Sun className="h-4 w-4" /> 태양광
                        </TabsTrigger>
                        <TabsTrigger value="LIGHTING" className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" /> 조명
                        </TabsTrigger>
                    </TabsList>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
                            {/* Shared Fundamental Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control as any}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>시스템 이름</FormLabel>
                                            <FormControl>
                                                <Input placeholder="시스템 이름을 입력하세요" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control as any}
                                    name="isShared"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col justify-end pb-2">
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                    전체 존 공용 (Shared)
                                                </FormLabel>
                                            </div>
                                            <FormDescription className="text-xs mt-1">
                                                체크 해제 시 특정 존에만 연결됩니다.
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />

                                {/* Zone Selection (conditionally rendered) */}
                                {!form.watch("isShared") && (
                                    <div className="col-span-2 border p-4 rounded-md bg-muted/20">
                                        <FormLabel className="mb-2 block">연결된 존 (Zones)</FormLabel>
                                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                            <FormField
                                                control={form.control as any}
                                                name="linkedZoneIds"
                                                render={() => (
                                                    <FormItem className="col-span-2 space-y-2">
                                                        {zones.map((zone) => (
                                                            <FormField
                                                                key={zone.id}
                                                                control={form.control as any}
                                                                name="linkedZoneIds"
                                                                render={({ field }) => {
                                                                    return (
                                                                        <FormItem
                                                                            key={zone.id}
                                                                            className="flex flex-row items-start space-x-3 space-y-0"
                                                                        >
                                                                            <FormControl>
                                                                                <Checkbox
                                                                                    checked={field.value?.includes(zone.id || "")}
                                                                                    onCheckedChange={(checked) => {
                                                                                        return checked
                                                                                            ? field.onChange([...(field.value || []), zone.id])
                                                                                            : field.onChange(
                                                                                                field.value?.filter(
                                                                                                    (value: string) => value !== zone.id
                                                                                                )
                                                                                            );
                                                                                    }}
                                                                                />
                                                                            </FormControl>
                                                                            <FormLabel className="font-normal">
                                                                                {zone.name}
                                                                            </FormLabel>
                                                                        </FormItem>
                                                                    );
                                                                }}
                                                            />
                                                        ))}
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* DHW Specific Fields */}
                            {activeType === "DHW" && (
                                <>
                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                            <Flame className="h-4 w-4" /> 열원 (Generator)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control as any}
                                                name="generator.type"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>유형</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                            <FormControl>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="boiler">일반 보일러</SelectItem>
                                                                <SelectItem value="heat_pump">히트펌프</SelectItem>
                                                                <SelectItem value="electric_heater">전기 히터</SelectItem>
                                                                <SelectItem value="district">지역 난방</SelectItem>
                                                                <SelectItem value="solar">태양열</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control as any}
                                                name="generator.fuel"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>연료/에너지원</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="natural_gas">천연가스 (LNG)</SelectItem>
                                                                <SelectItem value="electricity">전기</SelectItem>
                                                                <SelectItem value="oil">등유/경유</SelectItem>
                                                                <SelectItem value="lpg">LPG</SelectItem>
                                                                <SelectItem value="district_heating">지역난방열</SelectItem>
                                                                <SelectItem value="heat_pump_air">공기열 (HP)</SelectItem>
                                                                <SelectItem value="heat_pump_geo">지열 (HP)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control as any}
                                                name="generator.efficiency"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>효율 (COP)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" step="0.01" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                            <Droplets className="h-4 w-4" /> 저장 탱크 (Storage)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control as any}
                                                name="storage.volume"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>탱크 용량 (L)</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control as any}
                                                name="storage.temperature"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>저장 온도 (°C)</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control as any}
                                                name="storage.location"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>설치 위치</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="conditioned">공조 구역 내</SelectItem>
                                                                <SelectItem value="unconditioned">비공조 구역</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h3 className="font-semibold text-sm">배관 (Distribution)</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control as any}
                                                name="distribution.hasCirculation"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col justify-end pb-2">
                                                        <div className="flex items-center gap-2">
                                                            <FormControl>
                                                                <Switch checked={field.value as boolean} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">급탕 순환 배관 있음</FormLabel>
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control as any}
                                                name="distribution.pipeInsulation"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>배관 단열 수준</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="none">없음</SelectItem>
                                                                <SelectItem value="basic">기본</SelectItem>
                                                                <SelectItem value="good">우수</SelectItem>
                                                                <SelectItem value="reinforced">강화</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Heating Specific Fields */}
                            {activeType === "HEATING" && (
                                <>
                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                            <Flame className="h-4 w-4" /> 열원 (Generator)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <GeneratorSelection
                                                    form={form}
                                                    mode="HEATING"
                                                />
                                            </div>
                                            <FormField
                                                control={form.control as any}
                                                name="generator.efficiency"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>효율 (Nominal / COP)</FormLabel>
                                                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h3 className="font-semibold text-sm">분배 및 방열</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control as any}
                                                name="distribution.temperatureRegime"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>온도 조건</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="90/70">90/70 °C</SelectItem>
                                                                <SelectItem value="70/50">70/50 °C</SelectItem>
                                                                <SelectItem value="55/45">55/45 °C</SelectItem>
                                                                <SelectItem value="35/28">35/28 °C</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control as any}
                                                name="emission.type"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>방열 방식</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="radiator">라디에이터</SelectItem>
                                                                <SelectItem value="floor_heating">바닥 난방</SelectItem>
                                                                <SelectItem value="fan_coil">팬코일 유닛</SelectItem>
                                                                <SelectItem value="air_heating">공기 난방</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Cooling Specific Fields */}
                            {activeType === "COOLING" && (
                                <>
                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                            <Snowflake className="h-4 w-4" /> 열원 (Generator)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <GeneratorSelection
                                                    form={form}
                                                    mode="COOLING"
                                                />
                                            </div>
                                            <FormField
                                                control={form.control as any}
                                                name="generator.efficiency"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>효율 (EER)</FormLabel>
                                                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4 border p-4 rounded-md">
                                        <h3 className="font-semibold text-sm">분배 및 방열</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control as any}
                                                name="distribution.type"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>분배 방식</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="refrigerant">냉매 배관</SelectItem>
                                                                <SelectItem value="water">냉수 배관</SelectItem>
                                                                <SelectItem value="air">덕트</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control as any}
                                                name="emission.type"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>방열 방식</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="fan_coil">팬코일 유닛</SelectItem>
                                                                <SelectItem value="surface">복사 냉방</SelectItem>
                                                                <SelectItem value="air">공기 분배</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* PV Specific Fields */}
                            {activeType === "PV" && (
                                <div className="space-y-4 border p-4 rounded-md">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <Sun className="h-4 w-4" /> 태양광 어레이
                                    </h3>

                                    {/* Ideally we use useFieldArray, but simplified single array support for now or manual mapping */}
                                    {/* For MVP, let's just expose the first array item or map basic fields if only 1 allowed in form simplified */}
                                    {/* Wait, the schema allows multiple. Let's assume we edit the first one for now or loop? */}
                                    {/* Let's iterate using direct index 0 for MVP to avoid complex UI for multi-array in this step unless requested */}

                                    <FormField
                                        control={form.control as any}
                                        name="arrays.0.name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>어레이 이름</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control as any}
                                            name="arrays.0.capacity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>설치 용량 (kWp)</FormLabel>
                                                    <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control as any}
                                            name="arrays.0.moduleType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>모듈 타입</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="crystalline">결정질 (Crystalline)</SelectItem>
                                                            <SelectItem value="thin_film">박막형 (Thin Film)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control as any}
                                            name="arrays.0.orientation"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>향 (Orientation)</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="S">남 (South)</SelectItem>
                                                            <SelectItem value="SE">남동 (SE)</SelectItem>
                                                            <SelectItem value="SW">남서 (SW)</SelectItem>
                                                            <SelectItem value="E">동 (East)</SelectItem>
                                                            <SelectItem value="W">서 (West)</SelectItem>
                                                            <SelectItem value="Horiz">수평 (Horizontal)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control as any}
                                            name="arrays.0.tilt"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>경사각 (°)</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control as any}
                                            name="arrays.0.performanceRatio"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>효율 계수 (PR)</FormLabel>
                                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                    <FormDescription>기본값: 0.75 ~ 0.85</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* AHU Specific Fields */}
                            {activeType === "AHU" && (
                                <div className="space-y-6">
                                    <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                                        <div className="space-y-1">
                                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                                <Wind className="h-4 w-4 text-purple-500" />
                                                <span>환기 및 공조 (Ventilation / AHU)</span>
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                공조기뿐만 아니라 전열교환기(ERV) 및 단순 급/배기팬도 여기서 설정합니다.
                                                난방/냉방 코일이 없는 경우 해당 옵션을 비활성화하세요.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control as any}
                                                name="airflow"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>설계 풍량 (CMH)</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control as any}
                                                name="fanPower"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>송풍기 동력 (SFP, W/(m³/h))</FormLabel>
                                                        <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                                        <h3 className="font-semibold text-sm flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <RefreshCw className="h-4 w-4 text-green-500" />
                                                <span>열회수 (Heat Recovery)</span>
                                            </div>
                                            <Switch
                                                checked={!!form.watch("heatRecovery")}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        form.setValue("heatRecovery", { type: "plate", heatingEfficiency: 0.7, coolingEfficiency: 0.7 } as any);
                                                    } else {
                                                        form.setValue("heatRecovery", undefined);
                                                    }
                                                }}
                                            />
                                        </h3>
                                        {form.watch("heatRecovery") && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control as any}
                                                    name="heatRecovery.type"
                                                    render={({ field }) => (
                                                        <FormItem className="col-span-2">
                                                            <FormLabel>교환기 유형</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="plate">판형 (Plate)</SelectItem>
                                                                    <SelectItem value="rotary">로터리형 (Rotary)</SelectItem>
                                                                    <SelectItem value="run_around">런어라운드</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control as any}
                                                    name="heatRecovery.heatingEfficiency"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>난방 효율 (Heating, 0-1)</FormLabel>
                                                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control as any}
                                                    name="heatRecovery.coolingEfficiency"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>냉방 효율 (Cooling, 0-1)</FormLabel>
                                                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                                        <h3 className="font-semibold text-sm flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Flame className="h-4 w-4 text-red-500" />
                                                <span>난방 코일 (Heating Coil)</span>
                                            </div>
                                            <Switch
                                                checked={!!form.watch("heatingCoil")}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        form.setValue("heatingCoil", { generatorType: "boiler", fuel: "natural_gas", efficiency: 0.9 });
                                                    } else {
                                                        form.setValue("heatingCoil", undefined);
                                                    }
                                                }}
                                            />
                                        </h3>
                                        {form.watch("heatingCoil") && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control as any}
                                                    name="heatingCoil.generatorType"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>열원 유형</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="boiler">보일러</SelectItem>
                                                                    <SelectItem value="heat_pump">히트펌프</SelectItem>
                                                                    <SelectItem value="district">지역난방</SelectItem>
                                                                    <SelectItem value="electric">전기히터</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control as any}
                                                    name="heatingCoil.fuel"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>연료 Source</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="natural_gas">LNG</SelectItem>
                                                                    <SelectItem value="electricity">전기</SelectItem>
                                                                    <SelectItem value="district_heating">지역난방</SelectItem>
                                                                    <SelectItem value="oil">등유</SelectItem>
                                                                    <SelectItem value="lpg">LPG</SelectItem>
                                                                    <SelectItem value="heat_pump_air">공기열 HP</SelectItem>
                                                                    <SelectItem value="heat_pump_geo">지열 HP</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control as any}
                                                    name="heatingCoil.efficiency"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>효율 (COP)</FormLabel>
                                                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                                        <h3 className="font-semibold text-sm flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Snowflake className="h-4 w-4 text-sky-500" />
                                                <span>냉방 코일 (Cooling Coil)</span>
                                            </div>
                                            <Switch
                                                checked={!!form.watch("coolingCoil")}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        form.setValue("coolingCoil", { generatorType: "chiller", fuel: "electricity", efficiency: 3.5 });
                                                    } else {
                                                        form.setValue("coolingCoil", undefined);
                                                    }
                                                }}
                                            />
                                        </h3>
                                        {form.watch("coolingCoil") && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control as any}
                                                    name="coolingCoil.generatorType"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>열원 유형</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="chiller">냉동기(Chiller)</SelectItem>
                                                                    <SelectItem value="heat_pump">히트펌프</SelectItem>
                                                                    <SelectItem value="district">지역냉방</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control as any}
                                                    name="coolingCoil.fuel"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>에너지원</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="electricity">전기</SelectItem>
                                                                    <SelectItem value="natural_gas">가스(GHP)</SelectItem>
                                                                    <SelectItem value="district_heating">지역냉방</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control as any}
                                                    name="coolingCoil.efficiency"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>효율 (COP/EER)</FormLabel>
                                                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Lighting Specific Fields */}
                            {activeType === "LIGHTING" && (
                                <div className="space-y-4 border p-4 rounded-md">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4" /> 조명 사양 및 제어
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control as any}
                                            name="lightingEfficacy"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>광효율 (lm/W)</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                    <FormDescription>LED: 100-130, 형광등: 60</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control as any}
                                            name="parasiticPowerDensity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>대기 전력 밀도 (W/m²)</FormLabel>
                                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                    <FormDescription>비사용 시 전력 소모 (보통 0.1)</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control as any}
                                            name="controlType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>제어 방식</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="manual">수동 제어</SelectItem>
                                                            <SelectItem value="occupancy">재실 감지 제어</SelectItem>
                                                            <SelectItem value="daylight">주광 연동 제어</SelectItem>
                                                            <SelectItem value="dual">재실 + 주광 연동</SelectItem>
                                                            <SelectItem value="constant">정조도 제어 (Constant)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control as any}
                                            name="hasConstantIlluminanceControl"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col justify-center">
                                                    <div className="flex items-center gap-2 pt-6">
                                                        <FormControl>
                                                            <Switch checked={field.value as boolean} onCheckedChange={field.onChange} />
                                                        </FormControl>
                                                        <FormLabel className="font-normal cursor-pointer">정조도 유지 제어 적용</FormLabel>
                                                    </div>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 justify-end">
                                <Button type="button" variant="outline" onClick={onCancel}>
                                    취소
                                </Button>
                                <Button type="submit">저장</Button>
                            </div>
                        </form>
                    </Form>
                </Tabs>
            </CardContent>
        </Card>
    );
}

