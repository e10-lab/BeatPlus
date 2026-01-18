import { ProjectForm } from "@/features/input/components/project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewProjectPage() {
    return (
        <div className="container mx-auto py-12 flex justify-center">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>새 프로젝트 생성</CardTitle>
                    <CardDescription>에너지 해석을 시작하기 위해 기본 건물 정보를 입력하세요.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ProjectForm />
                </CardContent>
            </Card>
        </div>
    );
}
