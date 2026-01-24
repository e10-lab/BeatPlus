"use client";

import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";
import { Project } from "@/types/project";
import { getProject } from "@/services/project-service";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectGeometryView } from "@/features/input/components/project-geometry-view";
import { ResultsView } from "@/features/results/components/results-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, MapPin, CalendarDays, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProjectSettingsForm } from "@/features/input/components/project-settings-form";
import { CLIMATE_ZONE_LABELS } from "@/lib/constants";

export default function ProjectDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState("overview");

    const projectId = params.id as string;

    useEffect(() => {
        async function fetchProject() {
            if (!projectId) return;
            try {
                const data = await getProject(projectId);
                setProject(data);
            } catch (error) {
                console.error("Failed to fetch project:", error);
                // Optionally redirect to 404
            } finally {
                setLoading(false);
            }
        }

        if (user) {
            fetchProject();
        } else if (!authLoading) {
            router.push("/login");
        }
    }, [projectId, user, authLoading, router]);

    if (authLoading || loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!project) {
        return <div className="p-8 text-center">Project not found</div>;
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
            {/* Header Section (remains same) */}
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-start">
                {/* ... content omitted for brevity, keeping existing header ... */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => router.push("/projects")} className="-ml-3 text-muted-foreground">
                            <ArrowLeft className="mr-1 h-4 w-4" /> 목록으로
                        </Button>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Building2 className="h-8 w-8 text-primary" />
                        {project.name}
                    </h1>
                    {/* ... rest of header ... */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>
                                {project.location?.city}
                                {project.location?.climateZone ? ` (${CLIMATE_ZONE_LABELS[project.location.climateZone] || project.location.climateZone})` : ""}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <CalendarDays className="h-4 w-4" />
                            <span>수정일: {project.updatedAt?.toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="text-base py-1 px-3">
                        Status: Draft
                    </Badge>
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="overview">개요 (Overview)</TabsTrigger>
                    <TabsTrigger value="geometry">형상 (Geometry)</TabsTrigger>
                    <TabsTrigger value="results">결과 (Results)</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-4">
                    <ProjectSettingsForm project={project} onUpdate={setProject} />
                </TabsContent>

                <TabsContent value="geometry" className="mt-6">
                    <ProjectGeometryView projectId={params.id as string} />
                </TabsContent>

                <TabsContent value="results" className="mt-6">
                    <ResultsView projectId={params.id as string} isActive={activeTab === "results"} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
