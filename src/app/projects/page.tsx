"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Folder } from "lucide-react";
import { getProjects } from "@/services/project-service";
import { useAuth } from "@/lib/auth-context";
import { Project } from "@/types/project";
import { format } from "date-fns"; // You might need to install date-fns

export default function ProjectsPage() {
    const { user, loading: authLoading } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProjects() {
            if (user) {
                try {
                    const data = await getProjects(user.uid);
                    setProjects(data);
                } catch (error) {
                    console.error("Failed to fetch projects:", error);
                } finally {
                    setLoading(false);
                }
            } else if (!authLoading) {
                setLoading(false);
            }
        }

        fetchProjects();
    }, [user, authLoading]);

    if (authLoading || loading) {
        return <div className="container mx-auto py-12">로딩 중...</div>;
    }

    return (
        <div className="container mx-auto py-12 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">프로젝트</h1>
                    <p className="text-muted-foreground">건물 에너지 해석 프로젝트를 관리하세요.</p>
                </div>
                <Button asChild>
                    <Link href="/projects/new">
                        <Plus className="mr-2 h-4 w-4" /> 새 프로젝트
                    </Link>
                </Button>
            </div>

            {projects.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-dashed">
                    <Folder className="h-12 w-12 mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold">프로젝트가 없습니다.</h3>
                    <p className="mb-4">첫 번째 프로젝트를 생성하여 분석을 시작하세요.</p>
                    <Button variant="outline" asChild>
                        <Link href="/projects/new">프로젝트 생성</Link>
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <Card key={project.id} className="hover:bg-muted/50 transition-colors">
                            <CardHeader>
                                <CardTitle>{project.name}</CardTitle>
                                <CardDescription>{project.location.city} • {project.location.climateZone}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                    {project.description || "설명이 없습니다."}
                                </p>
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>수정일 {project.updatedAt ? project.updatedAt.toLocaleDateString() : "N/A"}</span>
                                    <Button variant="secondary" size="sm" asChild>
                                        <Link href={`/projects/${project.id}`}>열기</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
