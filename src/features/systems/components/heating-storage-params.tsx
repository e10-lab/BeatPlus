"use client";

import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function HeatingStorageParams({ form }: { form: any }) {
    return (
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="storage.volume"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>축열조 용량 (L)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormDescription>축열조가 없을 경우 0 입력</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
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
                control={form.control}
                name="storage.location"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>설치 위치</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "unconditioned"}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="conditioned">공조 구역 내 (Conditioned)</SelectItem>
                                <SelectItem value="unconditioned">비공조 구역 (Unconditioned)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
