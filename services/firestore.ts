import { db } from "./firebase";
import { collection, addDoc, query, orderBy, getDocs, Timestamp, doc, getDoc, setDoc, updateDoc, increment, limit, startAfter, QueryDocumentSnapshot, DocumentData, onSnapshot } from "firebase/firestore";
import { AnalysisResult, AuditRecord, UserProfile } from "../types";

// ==========================================
// AUDITS (SUB-COLLECTION)
// Path: users/{userId}/audits/{auditId}
// ==========================================

export const saveAudit = async (userId: string, fileName: string, fileType: string, result: AnalysisResult) => {
  try {
    const userAuditsRef = collection(db, "users", userId, "audits");
    
    await addDoc(userAuditsRef, {
      fileName,
      fileType,
      result,
      score: result.resumo_executivo.score,
      verdict: result.resumo_executivo.classificacao,
      timestamp: Timestamp.now()
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
    const userAuditsRef = collection(db, "users", userId, "audits");
    
    let q;

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
    const newProfile: UserProfile = {
      uid,
      credits: 1, 
      plan: 'free',
      subscriptionStatus: 'active'
    };
    await setDoc(userRef, {
      ...newProfile,
      email: email, 
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

    if (amount >= 999) {
        updateData.plan = 'pro';
    }

    await updateDoc(userRef, updateData);
};

// ==========================================
// STRIPE CHECKOUT (EXTENSION)
// ==========================================

export const createCheckoutSession = async (uid: string, priceId: string, mode: 'subscription' | 'payment' = 'subscription') => {
  // A coleção deve ser exata: customers/{uid}/checkout_sessions
  const collectionRef = collection(db, "customers", uid, "checkout_sessions");
  
  // Cria o documento que aciona a Cloud Function da extensão do Stripe
  const docRef = await addDoc(collectionRef, {
    price: priceId,
    success_url: `${window.location.origin}/?success=true`, // Adiciona flag para toast de sucesso
    cancel_url: window.location.origin, 
    mode: mode, // 'subscription' para recorrente, 'payment' para único
  });

  return new Promise<string>((resolve, reject) => {
    const unsubscribe = onSnapshot(docRef, (snap) => {
      const data = snap.data();
      if (data) {
        const { error, url } = data;
        if (error) {
          unsubscribe();
          reject(new Error(error.message));
        }
        if (url) {
          unsubscribe();
          resolve(url);
        }
      }
    });
  });
};