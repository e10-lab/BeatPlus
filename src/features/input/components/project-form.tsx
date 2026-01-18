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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProject } from "@/services/project-service";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState } from "react";

const formSchema = z.object({
    name: z.string().min(2, {
        message: "프로젝트 이름은 최소 2글자 이상이어야 합니다.",
    }),
    description: z.string().optional(),
    city: z.string().min(1, { message: "도시를 입력해주세요." }),
    climateZone: z.string().min(1, { message: "기후 구역을 선택해주세요." }),
});

export function ProjectForm() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
            city: "",
            climateZone: "",
        },
    });

    const [error, setError] = useState("");

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user) return;
        setLoading(true);
        setError(""); // Reset error
        try {
            await createProject({
                userId: user.uid,
                name: values.name,
                description: values.description,
                location: {
                    city: values.city,
                    climateZone: values.climateZone,
                },
            });
            router.push("/projects");
        } catch (error: any) {
            console.error("Failed to create project:", error);
            setError(`프로젝트 생성 실패: ${error.message} (코드: ${error.code || 'unknown'})`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>프로젝트 이름</FormLabel>
                            <FormControl>
                                <Input placeholder="나의 에너지 해석 프로젝트" {...field} />
                            </FormControl>
                            <FormDescription>
                                건물 프로젝트의 고유한 이름을 입력하세요.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>설명</FormLabel>
                            <FormControl>
                                <Textarea placeholder="프로젝트 상세 설명..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>도시</FormLabel>
                                <FormControl>
                                    <Input placeholder="서울" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="climateZone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>기후 구역 (DIN 18599)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="기후 구역 선택" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="TRY 01">TRY 01 (Bremerhaven)</SelectItem>
                                        <SelectItem value="TRY 02">TRY 02 (Rostock)</SelectItem>
                                        <SelectItem value="TRY 03">TRY 03 (Hamburg)</SelectItem>
                                        <SelectItem value="TRY 04">TRY 04 (Potsdam)</SelectItem>
                                        <SelectItem value="TRY 05">TRY 05 (Essen)</SelectItem>
                                        <SelectItem value="TRY 06">TRY 06 (Bad Marienberg)</SelectItem>
                                        <SelectItem value="TRY 07">TRY 07 (Kassel)</SelectItem>
                                        <SelectItem value="TRY 08">TRY 08 (Braunlage)</SelectItem>
                                        <SelectItem value="TRY 09">TRY 09 (Chemnitz)</SelectItem>
                                        <SelectItem value="TRY 10">TRY 10 (Hof)</SelectItem>
                                        <SelectItem value="TRY 11">TRY 11 (Fichtelberg)</SelectItem>
                                        <SelectItem value="TRY 12">TRY 12 (Mannheim)</SelectItem>
                                        <SelectItem value="TRY 13">TRY 13 (Mühldorf)</SelectItem>
                                        <SelectItem value="TRY 14">TRY 14 (Stötten)</SelectItem>
                                        <SelectItem value="TRY 15">TRY 15 (Garmisch)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    표준 기상 데이터(TRY) 구역을 선택하세요.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                {error && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm mb-4">
                        {error}
                        <p className="text-xs mt-1 text-red-500 font-mono">
                            콘솔 로그를 확인하세요. Firestore 데이터베이스가 생성되었는지 확인해주세요.
                        </p>
                    </div>
                )}
                <Button type="submit" disabled={loading}>
                    {loading ? "생성 중..." : "프로젝트 생성"}
                </Button>
            </form>
        </Form>
    );
}
