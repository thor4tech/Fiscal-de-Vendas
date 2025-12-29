import { db } from "./firebase";
import { collection, addDoc, query, orderBy, getDocs, Timestamp, doc, getDoc, setDoc, updateDoc, increment, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { AnalysisResult, AuditRecord, UserProfile } from "../types";

// ==========================================
// AUDITS (SUB-COLLECTION)
// Path: users/{userId}/audits/{auditId}
// ==========================================

export const saveAudit = async (userId: string, fileName: string, fileType: string, result: AnalysisResult) => {
  try {
    // CHANGE: Reference the sub-collection 'audits' INSIDE the specific 'user' document
    const userAuditsRef = collection(db, "users", userId, "audits");
    
    await addDoc(userAuditsRef, {
      fileName,
      fileType,
      result,
      score: result.resumo_executivo.score,
      verdict: result.resumo_executivo.classificacao,
      timestamp: Timestamp.now()
      // Note: We don't strictly need to save 'userId' inside the doc anymore 
      // because the path itself identifies the user, but it's fine to keep or remove.
    });
  } catch (error) {
    console.error("Error saving audit:", error);
    throw error;
  }
};

export const getUserAudits = async (
  userId: string, 
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null, 
  pageSize: number = 10
): Promise<{ audits: AuditRecord[], lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => {
  try {
    // CHANGE: Query the sub-collection inside the user
    const userAuditsRef = collection(db, "users", userId, "audits");
    
    let q;

    // Note: We REMOVED 'where("userId", "==", userId)' because we are already 
    // pointing directly to that user's specific collection.
    if (lastDoc) {
      q = query(
        userAuditsRef,
        orderBy("timestamp", "desc"),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        userAuditsRef,
        orderBy("timestamp", "desc"),
        limit(pageSize)
      );
    }

    const querySnapshot = await getDocs(q);
    const audits = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        fileName: data.fileName,
        fileType: data.fileType,
        timestamp: data.timestamp.toMillis(),
        result: data.result,
        score: data.score
      } as AuditRecord;
    });

    const lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    return { audits, lastVisible };
  } catch (error: any) {
    console.error("Error fetching audits:", error);
    return { audits: [], lastVisible: null };
  }
};

// ==========================================
// USER PROFILE & CREDITS (ROOT COLLECTION)
// Path: users/{userId}
// ==========================================

export const getOrCreateUserProfile = async (uid: string, email: string | null): Promise<UserProfile> => {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  } else {
    // Create new user profile with 1 free credit
    const newProfile: UserProfile = {
      uid,
      credits: 1, // 1 Free Credit for new users
      plan: 'free',
      subscriptionStatus: 'active'
    };
    await setDoc(userRef, {
      ...newProfile,
      email: email, // Store email for admin reference
      createdAt: Timestamp.now()
    });
    return newProfile;
  }
};

export const deductCredit = async (uid: string) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    credits: increment(-1)
  });
};

export const addCredits = async (uid: string, amount: number) => {
    const userRef = doc(db, "users", uid);
    
    const updateData: any = {
        credits: increment(amount)
    };

    // If buying the unlimited pack (999), upgrade plan to pro
    if (amount >= 999) {
        updateData.plan = 'pro';
    }

    await updateDoc(userRef, updateData);
};