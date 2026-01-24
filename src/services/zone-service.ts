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
    writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Zone } from "@/types/project";

const PROJECTS_COLLECTION = "projects";
const ZONES_COLLECTION = "zones";

export const createZone = async (projectId: string, zoneData: Omit<Zone, "id" | "projectId">) => {
    const zonesRef = collection(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION);
    const docRef = await addDoc(zonesRef, {
        ...zoneData,
        projectId,
    });
    return docRef.id;
};

export const getZones = async (projectId: string): Promise<Zone[]> => {
    const zonesRef = collection(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION);
    const q = query(zonesRef, orderBy("name")); // Sort by name by default from DB
    const querySnapshot = await getDocs(q);

    const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Zone[];

    // Client-side sort: orderIndex asc, then name asc
    return data.sort((a, b) => {
        const orderA = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
};

export const updateZone = async (projectId: string, zoneId: string, zoneData: Partial<Zone>) => {
    const zoneRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId);
    await updateDoc(zoneRef, zoneData);
};

export const deleteZone = async (projectId: string, zoneId: string) => {
    const zoneRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId);
    await deleteDoc(zoneRef);
};

export const reorderZones = async (projectId: string, orderedIds: string[]) => {
    const batch = writeBatch(db);

    orderedIds.forEach((id, index) => {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, id);
        batch.update(docRef, {
            orderIndex: index,
            // updatedAt: new Date() // logic if needed
        });
    });

    await batch.commit();
};
