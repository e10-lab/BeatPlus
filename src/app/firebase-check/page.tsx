"use client";

import { useEffect, useState } from "react";
import app, { auth } from "@/lib/firebase";
import { getApp, getApps } from "firebase/app";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

export default function FirebaseCheckPage() {
    const [status, setStatus] = useState<any>({});
    const [envVars, setEnvVars] = useState<any>({});
    const [authState, setAuthState] = useState<string>("Initializing...");
    const [error, setError] = useState<string>("");

    useEffect(() => {
        // Check Env Vars (only public ones are visible here)
        setEnvVars({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Loaded (Starts with " + process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 4) + ")" : "MISSING",
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "MISSING",
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "MISSING",
        });

        // Check Firebase App
        try {
            const apps = getApps();
            setStatus((prev: any) => ({ ...prev, appsCount: apps.length, appName: app.name }));
        } catch (e: any) {
            setError(e.message);
        }

        // Check Auth
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthState(user ? `User Logged In: ${user.uid}` : "User Logged Out");
        });

        return () => unsubscribe();
    }, []);

    const handleTestLogin = async () => {
        try {
            setError("");
            await signInAnonymously(auth);
            // If success, auth state listener will update
        } catch (e: any) {
            console.error(e);
            setError(`Login Failed: ${e.message} (Code: ${e.code})`);
            if (e.code === 'auth/operation-not-allowed') {
                setError("오류: Firebase Console에서 'Anonymous(익명)' 로그인 공급자가 활성화되어 있지 않을 수 있습니다. 또는 API Key가 유효하지 않습니다.");
            }
        }
    };

    return (
        <div className="p-8 font-mono space-y-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold">Firebase Connection Debugger</h1>

            <section className="p-4 border rounded bg-slate-50">
                <h2 className="font-bold mb-2">1. Environment Variables</h2>
                <pre className="text-sm bg-white p-2 rounded border">
                    {JSON.stringify(envVars, null, 2)}
                </pre>
                {Object.values(envVars).some(v => v === "MISSING") && (
                    <div className="mt-2 text-red-600 font-bold">
                        ⚠️ Some environment variables are missing! Restart the dev server.
                    </div>
                )}
            </section>

            <section className="p-4 border rounded bg-slate-50">
                <h2 className="font-bold mb-2">2. Firebase SDK Status</h2>
                <div className="text-sm">
                    Apps Initialized: {status.appsCount}<br />
                    Current App Name: {status.appName}
                </div>
            </section>

            <section className="p-4 border rounded bg-slate-50">
                <h2 className="font-bold mb-2">3. Authentication State</h2>
                <div className="text-lg font-semibold text-blue-600">
                    {authState}
                </div>
                {error && (
                    <div className="mt-2 p-3 bg-red-100 text-red-700 rounded border border-red-300 break-all">
                        {error}
                    </div>
                )}
                <div className="mt-4">
                    {/* Only show test login if we suspect connection is working but user is not logged in */}
                    <button
                        onClick={handleTestLogin}
                        className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700"
                    >
                        Test Anonymous Login (Connection Check)
                    </button>
                    <p className="text-xs text-muted-foreground mt-2">
                        * Note: Requires 'Anonymous' auth provider enabled in Firebase Console to succeed fully, but 'configuration-not-found' error will prove connection issues.
                    </p>
                </div>
            </section>

            <div className="text-xs text-gray-500 mt-8">
                Path: src/app/firebase-check/page.tsx
            </div>
        </div>
    );
}
