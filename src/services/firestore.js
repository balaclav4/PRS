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
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

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

// ============================================================================
// TRAINING DATA (Shared across all users for ML improvements)
// ============================================================================

/**
 * Upload training image and metadata
 * This is anonymous and shared across all users to improve OpenCV detection
 * @param {Blob} imageBlob - The cropped target image blob
 * @param {object} metadata - Training metadata (shots, diameter, etc.)
 * @returns {Promise<string>} - The training data ID
 */
export const addTrainingImage = async (imageBlob, metadata) => {
  try {
    // Generate unique ID for this training sample
    const trainingId = `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Upload image to Firebase Storage
    const storageRef = ref(storage, `training-images/${trainingId}.jpg`);
    await uploadBytes(storageRef, imageBlob);
    const imageUrl = await getDownloadURL(storageRef);

    // Save metadata to Firestore (shared collection, not user-specific)
    const trainingRef = collection(db, 'training-data');
    const docRef = await addDoc(trainingRef, {
      imageUrl,
      storagePath: `training-images/${trainingId}.jpg`,
      shots: metadata.shots || 0,
      targetDiameter: metadata.diameter || 0,
      timestamp: serverTimestamp(),
      version: 1 // For future schema changes
    });

    return docRef.id;
  } catch (error) {
    console.error('Error adding training image:', error);
    // Don't throw - training data is optional, shouldn't break user flow
    return null;
  }
};

/**
 * Get training data for model training
 * @param {number} maxCount - Maximum number of training samples to retrieve
 * @returns {Promise<Array>} - Array of training data objects
 */
export const getTrainingData = async (maxCount = 100) => {
  try {
    const trainingRef = collection(db, 'training-data');
    const q = query(trainingRef, orderBy('timestamp', 'desc'), limit(maxCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting training data:', error);
    throw error;
  }
};

/**
 * Get count of training images available
 * @returns {Promise<number>} - Count of training samples
 */
export const getTrainingDataCount = async () => {
  try {
    const trainingRef = collection(db, 'training-data');
    const snapshot = await getDocs(trainingRef);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting training data count:', error);
    return 0;
  }
};
