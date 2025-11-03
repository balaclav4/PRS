import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// ============================================================================
// SESSIONS
// ============================================================================

/**
 * Add a new session for a user
 * @param {string} userId - The user's UID
 * @param {object} sessionData - The session data (name, date, rifle, targets, etc.)
 * @returns {Promise<string>} - The new session ID
 */
export const addSession = async (userId, sessionData) => {
  try {
    const sessionsRef = collection(db, 'users', userId, 'sessions');
    const docRef = await addDoc(sessionsRef, {
      ...sessionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding session:', error);
    throw error;
  }
};

/**
 * Get all sessions for a user
 * @param {string} userId - The user's UID
 * @returns {Promise<Array>} - Array of session objects with IDs
 */
export const getSessions = async (userId) => {
  try {
    const sessionsRef = collection(db, 'users', userId, 'sessions');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting sessions:', error);
    throw error;
  }
};

/**
 * Update a session
 * @param {string} userId - The user's UID
 * @param {string} sessionId - The session ID
 * @param {object} updates - The fields to update
 */
export const updateSession = async (userId, sessionId, updates) => {
  try {
    const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating session:', error);
    throw error;
  }
};

/**
 * Delete a session
 * @param {string} userId - The user's UID
 * @param {string} sessionId - The session ID
 */
export const deleteSession = async (userId, sessionId) => {
  try {
    const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
    await deleteDoc(sessionRef);
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
};

// ============================================================================
// RIFLES
// ============================================================================

/**
 * Add a new rifle for a user
 * @param {string} userId - The user's UID
 * @param {object} rifleData - The rifle data (name, caliber, barrel, etc.)
 * @returns {Promise<string>} - The new rifle ID
 */
export const addRifle = async (userId, rifleData) => {
  try {
    const riflesRef = collection(db, 'users', userId, 'rifles');
    const docRef = await addDoc(riflesRef, {
      ...rifleData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding rifle:', error);
    throw error;
  }
};

/**
 * Get all rifles for a user
 * @param {string} userId - The user's UID
 * @returns {Promise<Array>} - Array of rifle objects with IDs
 */
export const getRifles = async (userId) => {
  try {
    const riflesRef = collection(db, 'users', userId, 'rifles');
    const q = query(riflesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting rifles:', error);
    throw error;
  }
};

/**
 * Update a rifle
 * @param {string} userId - The user's UID
 * @param {string} rifleId - The rifle ID
 * @param {object} updates - The fields to update
 */
export const updateRifle = async (userId, rifleId, updates) => {
  try {
    const rifleRef = doc(db, 'users', userId, 'rifles', rifleId);
    await updateDoc(rifleRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating rifle:', error);
    throw error;
  }
};

/**
 * Delete a rifle
 * @param {string} userId - The user's UID
 * @param {string} rifleId - The rifle ID
 */
export const deleteRifle = async (userId, rifleId) => {
  try {
    const rifleRef = doc(db, 'users', userId, 'rifles', rifleId);
    await deleteDoc(rifleRef);
  } catch (error) {
    console.error('Error deleting rifle:', error);
    throw error;
  }
};

// ============================================================================
// LOADS
// ============================================================================

/**
 * Add a new load for a user
 * @param {string} userId - The user's UID
 * @param {object} loadData - The load data (name, caliber, bullet, powder, etc.)
 * @returns {Promise<string>} - The new load ID
 */
export const addLoad = async (userId, loadData) => {
  try {
    const loadsRef = collection(db, 'users', userId, 'loads');
    const docRef = await addDoc(loadsRef, {
      ...loadData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding load:', error);
    throw error;
  }
};

/**
 * Get all loads for a user
 * @param {string} userId - The user's UID
 * @returns {Promise<Array>} - Array of load objects with IDs
 */
export const getLoads = async (userId) => {
  try {
    const loadsRef = collection(db, 'users', userId, 'loads');
    const q = query(loadsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting loads:', error);
    throw error;
  }
};

/**
 * Update a load
 * @param {string} userId - The user's UID
 * @param {string} loadId - The load ID
 * @param {object} updates - The fields to update
 */
export const updateLoad = async (userId, loadId, updates) => {
  try {
    const loadRef = doc(db, 'users', userId, 'loads', loadId);
    await updateDoc(loadRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating load:', error);
    throw error;
  }
};

/**
 * Delete a load
 * @param {string} userId - The user's UID
 * @param {string} loadId - The load ID
 */
export const deleteLoad = async (userId, loadId) => {
  try {
    const loadRef = doc(db, 'users', userId, 'loads', loadId);
    await deleteDoc(loadRef);
  } catch (error) {
    console.error('Error deleting load:', error);
    throw error;
  }
};

// ============================================================================
// USER PROFILE
// ============================================================================

/**
 * Create or update user profile
 * @param {string} userId - The user's UID
 * @param {object} profileData - The profile data (email, displayName, etc.)
 */
export const setUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // Create new profile
      await addDoc(collection(db, 'users'), {
        uid: userId,
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // Update existing profile
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error setting user profile:', error);
    throw error;
  }
};

/**
 * Get user profile
 * @param {string} userId - The user's UID
 * @returns {Promise<object>} - The user profile data
 */
export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};
