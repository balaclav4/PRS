/**
 * Migration Script: Fix Mean Radius Calculation
 *
 * This script updates the mean radius calculation for all existing sessions.
 * Previously, mean radius was calculated from the target center.
 * The correct calculation is from the group center (centroid of all shots).
 *
 * Usage:
 *   1. Set up Firebase Admin SDK credentials (see below)
 *   2. Run: node scripts/migrate-mean-radius.js
 *
 * Prerequisites:
 *   - Firebase Admin SDK: npm install firebase-admin
 *   - Download your service account key from Firebase Console:
 *     Project Settings > Service Accounts > Generate New Private Key
 *   - Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the path of the key file
 *     OR modify the initialization below to use the key directly
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Option 1: Use GOOGLE_APPLICATION_CREDENTIALS environment variable
// Option 2: Provide service account key directly (uncomment and modify below)
// const serviceAccount = require('./path-to-your-service-account-key.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// Using default credentials (from GOOGLE_APPLICATION_CREDENTIALS env var)
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

/**
 * Calculate group statistics with corrected mean radius
 * Mean radius is calculated from the GROUP CENTER (centroid of shots), not the target center
 */
function calculateGroupStats(shots, centerX, centerY, pixelsPerInch) {
  if (!shots || shots.length === 0) {
    return {
      size: 0,
      sizeInches: 0,
      meanRadius: 0,
      meanRadiusInches: 0,
      standardDev: 0,
      standardDevInches: 0,
      groupCenterX: centerX,
      groupCenterY: centerY,
      groupCenterXInches: 0,
      groupCenterYInches: 0,
      shotsRelativeToCenter: []
    };
  }

  // First, calculate the group center (centroid of all shots)
  const groupCenterX = shots.reduce((sum, shot) => sum + shot.x, 0) / shots.length;
  const groupCenterY = shots.reduce((sum, shot) => sum + shot.y, 0) / shots.length;

  // Shots relative to TARGET center (for POI calculations)
  const shotsRelativeToCenter = shots.map(shot => ({
    x: shot.x - centerX,
    y: shot.y - centerY,
    xInches: (shot.x - centerX) / pixelsPerInch,
    yInches: (shot.y - centerY) / pixelsPerInch,
    radius: Math.sqrt(Math.pow(shot.x - centerX, 2) + Math.pow(shot.y - centerY, 2)),
    radiusInches: Math.sqrt(Math.pow(shot.x - centerX, 2) + Math.pow(shot.y - centerY, 2)) / pixelsPerInch
  }));

  // Calculate distances from GROUP CENTER (for mean radius - proper statistical measure)
  const distancesFromGroupCenter = shots.map(shot =>
    Math.sqrt(Math.pow(shot.x - groupCenterX, 2) + Math.pow(shot.y - groupCenterY, 2))
  );

  // Mean radius from group center (correct calculation)
  const meanRadius = distancesFromGroupCenter.reduce((sum, d) => sum + d, 0) / shots.length;
  const meanRadiusInches = meanRadius / pixelsPerInch;

  // Standard deviation of radii from mean radius
  const variance = distancesFromGroupCenter.reduce((sum, d) =>
    sum + Math.pow(d - meanRadius, 2), 0) / shots.length;
  const standardDev = Math.sqrt(variance);
  const standardDevInches = standardDev / pixelsPerInch;

  // Group size (extreme spread - max distance between any two shots)
  let maxDistance = 0;
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const dx = shots[i].x - shots[j].x;
      const dy = shots[i].y - shots[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      maxDistance = Math.max(maxDistance, distance);
    }
  }

  return {
    size: maxDistance,
    sizeInches: maxDistance / pixelsPerInch,
    meanRadius: meanRadius,
    meanRadiusInches: meanRadiusInches,
    standardDev: standardDev,
    standardDevInches: standardDevInches,
    groupCenterX: groupCenterX,
    groupCenterY: groupCenterY,
    groupCenterXInches: (groupCenterX - centerX) / pixelsPerInch,
    groupCenterYInches: (groupCenterY - centerY) / pixelsPerInch,
    shotsRelativeToCenter: shotsRelativeToCenter
  };
}

async function migrateAllSessions() {
  console.log('Starting mean radius migration...\n');

  let totalUsers = 0;
  let totalSessions = 0;
  let totalTargets = 0;
  let updatedSessions = 0;
  let skippedSessions = 0;
  let errors = 0;

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').listDocuments();

    for (const userDocRef of usersSnapshot) {
      totalUsers++;
      const userId = userDocRef.id;
      console.log(`Processing user: ${userId}`);

      // Get all sessions for this user
      const sessionsSnapshot = await db.collection('users').doc(userId).collection('sessions').get();

      for (const sessionDoc of sessionsSnapshot.docs) {
        totalSessions++;
        const sessionData = sessionDoc.data();
        const sessionId = sessionDoc.id;

        if (!sessionData.targets || sessionData.targets.length === 0) {
          console.log(`  Session ${sessionId}: No targets, skipping`);
          skippedSessions++;
          continue;
        }

        let sessionNeedsUpdate = false;
        const updatedTargets = sessionData.targets.map(target => {
          totalTargets++;

          // Check if target has shots data to recalculate
          if (!target.shots || target.shots.length === 0) {
            console.log(`    Target: No shots data, keeping existing stats`);
            return target;
          }

          // Check if we have the required data for recalculation
          if (!target.pixelsPerInch || target.pixelsPerInch <= 0) {
            console.log(`    Target: Missing pixelsPerInch, keeping existing stats`);
            return target;
          }

          // Recalculate stats with corrected mean radius
          const centerX = target.adjustedX ?? target.x;
          const centerY = target.adjustedY ?? target.y;
          const newStats = calculateGroupStats(target.shots, centerX, centerY, target.pixelsPerInch);

          // Compare old and new mean radius
          const oldMeanRadius = target.stats?.meanRadiusInches || 0;
          const newMeanRadius = newStats.meanRadiusInches;

          if (Math.abs(oldMeanRadius - newMeanRadius) > 0.001) {
            console.log(`    Target: Mean radius updated from ${oldMeanRadius.toFixed(4)}" to ${newMeanRadius.toFixed(4)}"`);
            sessionNeedsUpdate = true;
          }

          return {
            ...target,
            stats: newStats
          };
        });

        if (sessionNeedsUpdate) {
          // Update the session in Firestore
          await db.collection('users').doc(userId).collection('sessions').doc(sessionId).update({
            targets: updatedTargets,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          updatedSessions++;
          console.log(`  Session ${sessionId}: Updated`);
        } else {
          console.log(`  Session ${sessionId}: No changes needed`);
          skippedSessions++;
        }
      }
    }

    console.log('\n========================================');
    console.log('Migration Complete!');
    console.log('========================================');
    console.log(`Total users processed: ${totalUsers}`);
    console.log(`Total sessions processed: ${totalSessions}`);
    console.log(`Total targets processed: ${totalTargets}`);
    console.log(`Sessions updated: ${updatedSessions}`);
    console.log(`Sessions skipped (no changes): ${skippedSessions}`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error('Migration error:', error);
    errors++;
  }

  process.exit(errors > 0 ? 1 : 0);
}

// Run the migration
migrateAllSessions();
