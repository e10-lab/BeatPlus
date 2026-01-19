"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Building2, LogOut, User } from "lucide-react";

export function Header() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                        <Building2 className="h-6 w-6" />
                        <span>BEAT 2027</span>
                    </Link>
                    <nav className="flex items-center gap-4 text-sm font-medium">
                        <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
                            홈
                        </Link>
                        <Link href="/projects" className="transition-colors hover:text-foreground/80 text-foreground/60">
                            프로젝트
                        </Link>
                        <Link href="/docs" className="transition-colors hover:text-foreground/80 text-foreground/60">
                            도움말
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    {!loading && (
                        <>
                            {user ? (
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User className="h-4 w-4" />
                                        <span className="hidden sm:inline-block">{user.email}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                                        <LogOut className="h-4 w-4 mr-2" />
                                        로그아웃
                                    </Button>
                                </div>
                            ) : (
                                <Link href="/login">
                                    <Button size="sm">로그인</Button>
                                </Link>
                            )}
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
