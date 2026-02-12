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

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const formSchema = z.object({
    name: z.string().min(2, {
        message: "프로젝트 이름은 최소 2글자 이상이어야 합니다.",
    }),
    description: z.string().optional(),
});

export function ProjectForm() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showLoginWarning, setShowLoginWarning] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
        },
    });

    const [error, setError] = useState("");

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user) {
            setShowLoginWarning(true);
            return;
        }
        setLoading(true);
        setError(""); // Reset error
        try {
            await createProject({
                userId: user.uid,
                name: values.name,
                description: values.description,
                location: {}, // Empty location initially
            });
            router.push("/projects");
        } catch (error: any) {
            console.error("Failed to create project:", error);
            setError(`프로젝트 생성 실패: ${error.message} (코드: ${error.code || 'unknown'})`);
        } finally {
            setLoading(false);
        }
    }

    const { loading: authLoading } = useAuth();
    const isSubmitting = loading || authLoading;

    return (
        <>
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
                    <div className="hidden">
                        {/* Location fields removed from creation step */}
                    </div>
                    {error && (
                        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm mb-4">
                            {error}
                            <p className="text-xs mt-1 text-red-500 font-mono">
                                콘솔 로그를 확인하세요. Firestore 데이터베이스가 생성되었는지 확인해주세요.
                            </p>
                        </div>
                    )}
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "처리 중..." : "프로젝트 생성"}
                    </Button>
                </form>
            </Form>

            <Dialog open={showLoginWarning} onOpenChange={setShowLoginWarning}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>로그인 필요</DialogTitle>
                        <DialogDescription>
                            프로젝트를 생성하려면 로그인이 필요합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setShowLoginWarning(false)}>
                            확인
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
