// Import the functions you need from the SDKs you need
import { FirebaseApp, initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
// Only initialize if we have the required config
// Initialize Firebase
// Only initialize if we have the required config
let app: FirebaseApp | undefined;
try {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        throw new Error("Missing required Firebase configuration");
    }
    app = initializeApp(firebaseConfig);

    console.log("Firebase App Initialized:", {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        apiKeyPresent: !!firebaseConfig.apiKey
    });
} catch (error) {
    console.error("Firebase initialization error:", error);
    // 500 에러 방지를 위해 에러를 던지지 않고, 로그만 남깁니다.
    // app은 undefined 상태로 남게 되며, 이후 auth나 db 사용 시 조치가 필요합니다.
}


// Initialize services
// We need to check if window is defined because Next.js renders on the server
let analytics = null;
if (typeof window !== "undefined" && app) {
    try {
        analytics = getAnalytics(app);
    } catch (error) {
        console.warn("Analytics initialization failed (this is OK in development):", error);
    }
}

export { analytics };
// app이 초기화되지 않았을 경우, getFirestore/getAuth가 에러를 던질 수 있습니다.
// 이를 방지하기 위해 app이 있을 때만 가져오고, 없으면 any 타입으로 우회하거나 
// 클라이언트 측에서 사용 시점에 에러가 나도록 합니다.
// 하지만 다른 모듈에서 'import { db } from ...' 형태로 쓰고 있어서 export const를 바꿀 수 없습니다.
// 따라서 일단 try-catch로 감싸서 내보내거나, app이 undefined일 때 처리를 해야 합니다.
// initializeApp 실패 시 getFirestore(undefined)는 에러를 냅니다.

export const db = app ? getFirestore(app) : {} as any;
export const auth = app ? getAuth(app) : {} as any;

/**
 * Recursively removes 'undefined' values from an object, which Firestore doesn't support.
 * Also preserves common Firestore types like Date and Timestamp.
 */
export const sanitizeData = (data: any): any => {
    if (data === null || data === undefined) return null;
    if (Array.isArray(data)) return data.map(sanitizeData);
    if (data instanceof Date || data instanceof Timestamp) return data;
    if (typeof data === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                result[key] = sanitizeData(value);
            }
        }
        return result;
    }
    return data;
};

export default app;
