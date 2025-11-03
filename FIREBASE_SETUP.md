# Firebase Setup Guide for PRS Precision App

This guide will help you set up Firebase Authentication and Firestore Database for multi-user support with data isolation.

## Prerequisites
- A Google account
- Node.js and npm installed

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Enter a project name (e.g., "PRS-Precision-App")
4. (Optional) Enable Google Analytics
5. Click "Create project"

## Step 2: Enable Authentication

1. In the Firebase Console, select your project
2. Click "Authentication" in the left sidebar
3. Click "Get started"
4. Click on the "Sign-in method" tab
5. Enable "Email/Password" provider:
   - Click on "Email/Password"
   - Toggle "Enable" to ON
   - Click "Save"

## Step 3: Create Firestore Database

1. In the Firebase Console, select your project
2. Click "Firestore Database" in the left sidebar
3. Click "Create database"
4. Choose "Start in production mode" (we'll set up security rules next)
5. Select a location closest to your users
6. Click "Enable"

## Step 4: Set Up Security Rules

1. In Firestore Database, click on the "Rules" tab
2. Replace the default rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User must be authenticated for all operations
    match /{document=**} {
      allow read, write: if false;
    }

    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Sessions belong to users
    match /users/{userId}/sessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Equipment (rifles, loads) belong to users
    match /users/{userId}/rifles/{rifleId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/loads/{loadId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click "Publish"

## Step 4a: Enable Firebase Storage

**IMPORTANT**: Storage is required for saving target images (Firestore has a 1MB limit).

1. In the Firebase Console, select your project
2. Click "Storage" in the left sidebar
3. Click "Get started"
4. Click "Next" (use default production mode rules)
5. Select a location (same as Firestore is recommended)
6. Click "Done"

### Storage Security Rules

1. In Storage, click on the "Rules" tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only access their own images
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click "Publish"

## Step 5: Get Your Firebase Configuration

1. In the Firebase Console, click the gear icon (⚙️) next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the Web icon (`</>`) to add a web app
5. Register your app:
   - App nickname: "PRS Web App"
   - (Optional) Check "Also set up Firebase Hosting"
   - Click "Register app"
6. Copy the `firebaseConfig` object values

## Step 6: Configure Your Local Environment

1. In your project root, copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and fill in your Firebase configuration values:
   ```
   REACT_APP_FIREBASE_API_KEY=your_actual_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   ```

3. **Important:** Never commit `.env.local` to git! It's already in `.gitignore`.

## Step 7: Install Dependencies

```bash
npm install
```

## Step 8: Start Your App

```bash
npm start
```

## Data Structure

The app will store data in Firestore with the following structure:

```
/users/{userId}
  - email: string
  - createdAt: timestamp

  /sessions/{sessionId}
    - name: string
    - date: string
    - rifle: string
    - load: string
    - distance: number
    - temperature: number
    - humidity: number
    - windSpeed: number
    - windDirection: string
    - pressure: number
    - targets: array
    - chronoData: object
    - createdAt: timestamp

  /rifles/{rifleId}
    - name: string
    - caliber: string
    - barrel: string
    - twist: string
    - scope: string
    - createdAt: timestamp

  /loads/{loadId}
    - name: string
    - caliber: string
    - bullet: string
    - bulletWeight: string
    - powder: string
    - charge: string
    - primer: string
    - brass: string
    - oal: string
    - cbto: string
    - createdAt: timestamp
```

## User Isolation

Each user's data is completely isolated:
- Users can only see their own sessions, rifles, and loads
- Firestore security rules enforce this at the database level
- No user can access another user's data, even through the API

## Testing

1. Create a test account: Sign up with a test email
2. Add some sessions and equipment
3. Sign out and create another test account
4. Verify you don't see the first user's data

## Troubleshooting

### "Firebase: Error (auth/operation-not-allowed)"
- Make sure you enabled Email/Password authentication in Step 2

### "Missing or insufficient permissions"
- Check your Firestore security rules in Step 4
- Make sure you're signed in

### Configuration errors
- Verify all environment variables in `.env.local` are correct
- Restart your development server after changing `.env.local`

## Next Steps

- Consider enabling Firebase Hosting for deployment
- Set up Firebase Functions for backend logic if needed
- Add password reset functionality
- Implement email verification
