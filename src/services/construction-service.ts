import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    setDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Construction } from "@/types/project";

const PROJECTS_COLLECTION = "projects";
const CONSTRUCTIONS_COLLECTION = "constructions";

export const createConstruction = async (projectId: string, constructionData: Omit<Construction, "id" | "projectId"> & { id?: string }) => {
    const constructionsRef = collection(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION);

    // If ID is provided (e.g. uuid from frontend), use it. Otherwise auto-gen.
    // However, addDoc auto-gens. If we want specific ID, use setDoc with doc().
    // For consistency with typical Firestore usage, if we have an ID from frontend, we might want to keep it.
    // Let's check zone-service: it uses addDoc.
    // But our ConstructionForm generates a uuid.
    // Let's prefer using the frontend generated ID if available, or just omit "id" field and let Firestore generate,
    // then return it.
    // Actually ConstructionForm uses uuidv4() for keying.
    // Let's use addDoc for simplicity and let Firestore assign the doc ID.
    // We will overwrite the "id" field in the data with the doc ID on retrieval.

    // Removing 'id' from data payload if it exists to avoid duplication inside the doc
    const { id, ...data } = constructionData as any;

    const docRef = await addDoc(constructionsRef, {
        ...data,
        projectId,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    return docRef.id;
};

// Overload for manual ID sets usually not needed unless syncing.

export const getConstructions = async (projectId: string): Promise<Construction[]> => {
    const constructionsRef = collection(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION);
    const q = query(constructionsRef, orderBy("name"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Construction[];
};

export const updateConstruction = async (projectId: string, constructionId: string, constructionData: Partial<Construction>) => {
    const constructionRef = doc(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION, constructionId);
    // Remove id from update payload
    const { id, ...data } = constructionData as any;
    await updateDoc(constructionRef, {
        ...data,
        updatedAt: new Date()
    });
};

export const deleteConstruction = async (projectId: string, constructionId: string) => {
    const constructionRef = doc(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION, constructionId);
    await deleteDoc(constructionRef);
};
