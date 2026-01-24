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
    setDoc,
    writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Construction } from "@/types/project";
import { getZones } from "./zone-service";
import { getSurfaces, updateSurface, deleteSurface } from "./surface-service";

const PROJECTS_COLLECTION = "projects";
const CONSTRUCTIONS_COLLECTION = "constructions";

const cleanUndefined = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj));
};

export const createConstruction = async (projectId: string, constructionData: Omit<Construction, "id" | "projectId"> & { id?: string }) => {
    const constructionsRef = collection(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION);

    // Removing 'id' from data payload if it exists
    const { id, ...data } = constructionData as any;
    const cleanedData = cleanUndefined(data);

    const docRef = await addDoc(constructionsRef, {
        ...cleanedData,
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

    const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Construction[];

    // Client-side sort: orderIndex asc, then name asc
    return data.sort((a, b) => {
        const orderA = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
};

export const updateConstruction = async (projectId: string, constructionId: string, constructionData: Partial<Construction>) => {
    const constructionRef = doc(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION, constructionId);
    // Remove id from update payload
    const { id, ...data } = constructionData as any;
    const cleanedData = cleanUndefined(data);

    await updateDoc(constructionRef, {
        ...cleanedData,
        updatedAt: new Date()
    });

    // Cascade update: If U-value changed, update linked surfaces
    if (constructionData.uValue !== undefined) {
        const zones = await getZones(projectId);
        for (const zone of zones) {
            if (!zone.id) continue;
            const surfaces = await getSurfaces(projectId, zone.id);
            const linkedSurfaces = surfaces.filter(s => s.constructionId === constructionId);

            await Promise.all(linkedSurfaces.map(surface =>
                updateSurface(projectId, zone.id!, surface.id!, { uValue: constructionData.uValue })
            ));
        }
    }
};

export const deleteConstruction = async (projectId: string, constructionId: string) => {
    const constructionRef = doc(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION, constructionId);
    await deleteDoc(constructionRef);

    // Cascade delete: Remove reference from surfaces
    const zones = await getZones(projectId);
    for (const zone of zones) {
        if (!zone.id) continue;
        const surfaces = await getSurfaces(projectId, zone.id);
        const linkedSurfaces = surfaces.filter(s => s.constructionId === constructionId);

        await Promise.all(linkedSurfaces.map(surface =>
            deleteSurface(projectId, zone.id!, surface.id!)
        ));
    }
};

export const reorderConstructions = async (projectId: string, orderedIds: string[]) => {
    const batch = writeBatch(db);

    orderedIds.forEach((id, index) => {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION, id);
        batch.update(docRef, {
            orderIndex: index,
            updatedAt: new Date()
        });
    });

    await batch.commit();
};
