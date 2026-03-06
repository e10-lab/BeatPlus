"use client";

import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function HeatingDistributionParams({ form }: { form: any }) {
    return (
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="distribution.temperatureRegime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>온도 조건 (Temperature Regime)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="90/70">90/70 °C</SelectItem>
                                <SelectItem value="70/50">70/50 °C</SelectItem>
                                <SelectItem value="55/45">55/45 °C</SelectItem>
                                <SelectItem value="35/28">35/28 °C</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="distribution.pumpControl"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>펌프 제어</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "prop_pressure"}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="const_pressure">정압 제어 (Constant Pressure)</SelectItem>
                                <SelectItem value="prop_pressure">비례압 제어 (Proportional Pressure)</SelectItem>
                                <SelectItem value="uncontrolled">비제어</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="distribution.pipeInsulation"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>배관 보온</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "basic"}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="none">보온 없음</SelectItem>
                                <SelectItem value="basic">기본 보온</SelectItem>
                                <SelectItem value="good">우수 보온</SelectItem>
                                <SelectItem value="reinforced">강화 보온</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
