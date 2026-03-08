import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    DocumentData,
    WithFieldValue
} from "firebase/firestore";

/**
 * 객체 내의 undefined 값을 제거하여 Firestore 저장 시 에러를 방지합니다.
 */
export function sanitizeData(data: any): any {
    const sanitized = { ...data };
    Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === undefined) {
            delete sanitized[key];
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
            sanitized[key] = sanitizeData(sanitized[key]);
        }
    });
    return sanitized;
}

/**
 * Firestore CRUD 작업을 위한 공통 함수들을 제공합니다.
 */
export class BaseFirebaseService {
    /**
     * 컬렉션 내의 모든 문서를 가져옵니다.
     */
    static async getAll<T>(path: string, orderField?: string): Promise<T[]> {
        const colRef = collection(db, path);
        const q = orderField ? query(colRef, orderBy(orderField)) : colRef;
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    }

    /**
     * 특정 문서를 가져옵니다.
     */
    static async getOne<T>(path: string, id: string): Promise<T | null> {
        const docRef = doc(db, path, id);
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
    }

    /**
     * 새로운 문서를 추가합니다.
     */
    static async create(path: string, data: any): Promise<string> {
        const colRef = collection(db, path);
        const sanitized = sanitizeData(data);
        const docRef = await addDoc(colRef, sanitized);
        return docRef.id;
    }

    /**
     * 기존 문서를 업데이트합니다.
     */
    static async update(path: string, id: string, data: any): Promise<void> {
        const docRef = doc(db, path, id);
        const sanitized = sanitizeData(data);
        await updateDoc(docRef, sanitized);
    }

    /**
     * 문서를 삭제합니다.
     */
    static async delete(path: string, id: string): Promise<void> {
        const docRef = doc(db, path, id);
        await deleteDoc(docRef);
    }
}
