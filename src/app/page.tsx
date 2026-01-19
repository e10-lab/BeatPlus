import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BarChart3, Building2, Calculator } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">


      <main className="flex-1">
        <section className="py-24 px-4 text-center space-y-8 bg-gradient-to-b from-background to-muted/20">
          <div className="mx-auto max-w-3xl space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground">
              건축물 에너지 효율 등급 <br className="hidden sm:inline" />
              <span className="text-primary">DIN V 18599 해석 툴</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              DIN V 18599 표준에 따른 난방, 냉방 및 환기 에너지 소요량을 웹에서 간편하게 계산하세요.
            </p>
          </div>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="h-12 px-8 text-lg" asChild>
              <Link href="/projects/new">
                분석 시작하기 <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-lg" asChild>
              <Link href="/docs">사용 가이드</Link>
            </Button>
          </div>
        </section>

        <section className="py-20 container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Building2 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>건물 형상 입력</CardTitle>
                <CardDescription>존(Zone), 표면(Surface) 및 외피 정보를 효율적으로 관리합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                직관적인 입력 폼을 통해 건물의 기하학적 정보와 열관류율(U-Value)을 손쉽게 설정할 수 있습니다.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Calculator className="h-10 w-10 text-primary mb-2" />
                <CardTitle>표준 계산 엔진</CardTitle>
                <CardDescription>DIN V 18599 Part 2 및 관련 표준을 준수합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                최신 규정에 기반하여 난방 및 냉방 순 에너지 소요량을 정확하게 계산합니다.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>결과 시각화</CardTitle>
                <CardDescription>에너지 흐름과 효율 지표를 한눈에 파악하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                종합적인 차트와 테이블을 통해 건물의 성능을 분석하고 에너지 절감 요소를 도출할 수 있습니다.
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2026 DIN 18599 Web Tool. All rights reserved.</p>
      </footer>
    </div>
  );
}
