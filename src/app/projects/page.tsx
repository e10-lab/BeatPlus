"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Folder, Trash2 } from "lucide-react";
import { getProjects, deleteProject } from "@/services/project-service";
import { useAuth } from "@/lib/auth-context";
import { Project } from "@/types/project";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function ProjectsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);

    const handleDeleteClick = (e: React.MouseEvent, projectId: string, projectName: string) => {
        e.preventDefault();
        e.stopPropagation();
        setProjectToDelete({ id: projectId, name: projectName });
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;

        try {
            await deleteProject(projectToDelete.id);
            setProjects(projects.filter(p => p.id !== projectToDelete.id));
            setDeleteConfirmOpen(false);
            setProjectToDelete(null);
        } catch (error) {
            console.error("Failed to delete project:", error);
            alert("프로젝트 삭제에 실패했습니다.");
        }
    };

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
                        <div
                            key={project.id}
                            className="group relative"
                        >
                            <Card
                                className="h-full hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => router.push(`/projects/${project.id}`)}
                            >
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{project.name}</CardTitle>
                                            <CardDescription className="mt-1">
                                                {project.location?.city ? (
                                                    <span>{project.location.city} • {project.location.climateZone}</span>
                                                ) : (
                                                    <span>위치 정보 없음</span>
                                                )}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                                        {project.description || "설명이 없습니다."}
                                    </p>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-auto">
                                        <span>수정일 {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : "N/A"}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => project.id && handleDeleteClick(e, project.id, project.name || "프로젝트")}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>프로젝트 삭제 확인</DialogTitle>
                        <DialogDescription>
                            정말로 &apos;{projectToDelete?.name}&apos; 프로젝트를 삭제하시겠습니까?
                            이 작업은 되돌릴 수 없으며 모든 관련 데이터가 영구적으로 삭제됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                            취소
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            삭제
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
