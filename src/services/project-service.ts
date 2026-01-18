import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project } from "@/types/project";

const PROJECTS_COLLECTION = "projects";

export const createProject = async (projectData: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
        ...projectData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
};

export const getProjects = async (userId: string): Promise<Project[]> => {
    const q = query(
        collection(db, PROJECTS_COLLECTION),
        where("userId", "==", userId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
    } as Project));
};

export const getProject = async (id: string): Promise<Project | null> => {
    const docRef = doc(db, PROJECTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return {
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate(),
            updatedAt: docSnap.data().updatedAt?.toDate(),
        } as Project;
    } else {
        return null;
    }
};

export const updateProject = async (id: string, updates: Partial<Project>) => {
    const docRef = doc(db, PROJECTS_COLLECTION, id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
    });
};

export const deleteProject = async (id: string) => {
    const docRef = doc(db, PROJECTS_COLLECTION, id);
    await deleteDoc(docRef);
};
