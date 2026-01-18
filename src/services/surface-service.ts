import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Surface } from "@/types/project";

const PROJECTS_COLLECTION = "projects";
const ZONES_COLLECTION = "zones";
const SURFACES_COLLECTION = "surfaces";

// Helper to get reference to surfaces collection: projects/{projectId}/zones/{zoneId}/surfaces
const getSurfacesCollectionRef = (projectId: string, zoneId: string) => {
    return collection(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId, SURFACES_COLLECTION);
};

export const createSurface = async (projectId: string, zoneId: string, surfaceData: Omit<Surface, "id" | "zoneId">) => {
    const surfacesRef = getSurfacesCollectionRef(projectId, zoneId);
    const docRef = await addDoc(surfacesRef, {
        ...surfaceData,
        zoneId,
    });
    return docRef.id;
};

export const getSurfaces = async (projectId: string, zoneId: string): Promise<Surface[]> => {
    const surfacesRef = getSurfacesCollectionRef(projectId, zoneId);
    const q = query(surfacesRef, orderBy("name"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Surface[];
};

export const updateSurface = async (projectId: string, zoneId: string, surfaceId: string, surfaceData: Partial<Surface>) => {
    const surfaceRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId, SURFACES_COLLECTION, surfaceId);
    await updateDoc(surfaceRef, surfaceData);
};

export const deleteSurface = async (projectId: string, zoneId: string, surfaceId: string) => {
    const surfaceRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId, SURFACES_COLLECTION, surfaceId);
    await deleteDoc(surfaceRef);
};
