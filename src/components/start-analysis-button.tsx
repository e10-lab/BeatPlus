"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProjects } from "@/services/project-service";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";

export function StartAnalysisButton() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        if (authLoading) return;

        setIsLoading(true);
        try {
            if (!user) {
                // If not logged in, go to new project (likely will redirect to login)
                router.push("/projects/new");
                return;
            }

            // Check if user has any projects
            const projects = await getProjects(user.uid);

            if (projects.length > 0) {
                router.push("/projects");
            } else {
                router.push("/projects/new");
            }
        } catch (error) {
            console.error("Navigation error:", error);
            // Fallback
            router.push("/projects/new");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button size="lg" className="h-12 px-8 text-lg" onClick={handleClick} disabled={authLoading || isLoading}>
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    확인 중...
                </>
            ) : (
                <>
                    분석 시작하기 <ArrowRight className="ml-2 h-5 w-5" />
                </>
            )}
        </Button>
    );
}
