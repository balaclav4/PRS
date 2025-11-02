# PRS Precision - Deployment Guide

Complete guide for deploying the PRS Precision Rifle Shooting app to various platforms.

## Table of Contents
1. [Quick Start - Recommended Platforms](#quick-start)
2. [Web Hosting Options](#web-hosting)
3. [Progressive Web App (PWA) Installation](#pwa)
4. [Authentication & Backend](#authentication)
5. [Mobile Native App (Future)](#mobile-native)
6. [Environment Configuration](#environment)

---

## Quick Start

### Recommended: Vercel (Free, Zero Config)

**Best for:** Production deployments, automatic GitHub integration

```bash
# One-time setup
npm install -g vercel

# Deploy
cd /home/user/PRS
vercel

# Follow prompts:
# - Link to existing project or create new
# - Select default settings (auto-detected)
# - Deploy!

# Get URL: https://prs-precision.vercel.app
```

**GitHub Auto-Deploy:**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import `balaclav4/PRS` repository
4. Click "Deploy"
5. Every push to `main` auto-deploys ✨

---

## Web Hosting Options

### 1. Vercel ⭐ Recommended

**Pricing:** Free tier includes:
- Unlimited deployments
- 100GB bandwidth/month
- Automatic HTTPS
- Custom domains

**Setup:**
```bash
vercel login
cd /home/user/PRS
vercel --prod
```

**Custom Domain:**
```bash
vercel domains add yourdomain.com
# Follow DNS instructions
```

---

### 2. Netlify

**Pricing:** Free tier includes:
- 100GB bandwidth/month
- 300 build minutes/month
- Automatic HTTPS

**Method A: CLI Deploy**
```bash
npm install -g netlify-cli
netlify login

# Deploy
npm run build
netlify deploy --prod --dir=build
```

**Method B: Drag & Drop**
1. Build locally: `npm run build`
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
3. Drag `build/` folder
4. Done! Get instant URL

**Method C: GitHub Integration**
1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import from Git"
3. Select `balaclav4/PRS`
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
5. Deploy!

---

### 3. Firebase Hosting

**Best for:** Apps that will need authentication/database later

**Pricing:** Free tier includes:
- 10GB storage
- 360MB/day bandwidth
- Built-in Auth & Database

**Setup:**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Select:
# - Public directory: build
# - Single-page app: Yes
# - Overwrite index.html: No

# Deploy
npm run build
firebase deploy

# Get URL: https://your-project.firebaseapp.com
```

**Custom Domain:**
```bash
firebase hosting:channel:deploy production --expires 30d
# Add domain in Firebase Console
```

---

### 4. GitHub Pages

**Pricing:** Free for public repositories

**Setup:**
```bash
# Add homepage to package.json
# Edit package.json and add:
# "homepage": "https://balaclav4.github.io/PRS"

# Install gh-pages
npm install --save-dev gh-pages

# Add to package.json scripts:
# "predeploy": "npm run build",
# "deploy": "gh-pages -d build"

# Deploy
npm run deploy

# Access at: https://balaclav4.github.io/PRS
```

---

### 5. AWS S3 + CloudFront

**Best for:** Enterprise deployments, high traffic

**Pricing:** Pay-as-you-go (typically $0.50-5/month for low traffic)

**Setup:**
```bash
# Install AWS CLI
# Follow: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

aws configure

# Build
npm run build

# Create S3 bucket
aws s3 mb s3://prs-precision

# Upload
aws s3 sync build/ s3://prs-precision --acl public-read

# Enable static website hosting
aws s3 website s3://prs-precision --index-document index.html --error-document index.html

# Access at: http://prs-precision.s3-website-us-east-1.amazonaws.com
```

---

## Progressive Web App (PWA)

Your app now has **PWA support** built-in! This means users can install it on their phone like a native app.

### Features:
- ✅ Install to home screen
- ✅ Offline functionality
- ✅ Full-screen mode
- ✅ Fast loading (cached assets)
- ✅ Works on iOS and Android

### How Users Install (iPhone):

1. Open Safari → Navigate to your deployed URL
2. Tap **Share** button (box with arrow)
3. Scroll down → Tap **"Add to Home Screen"**
4. Tap **"Add"**
5. App appears on home screen with icon! 🎯

### How Users Install (Android):

1. Open Chrome → Navigate to your deployed URL
2. Tap **Menu** (⋮) → **"Add to Home Screen"**
3. Or look for **"Install app"** banner at bottom
4. Tap **"Install"**
5. App appears in app drawer!

### Testing PWA Locally:

```bash
# Build production version
npm run build

# Serve with HTTPS (required for PWA)
npx serve -s build -l 3000

# Open in browser: http://localhost:3000
# Check DevTools → Application → Service Workers
# Should show "activated and running"
```

### PWA Manifest Customization:

Edit `/public/manifest.json` to customize:
- App name and icons
- Theme colors
- Orientation (portrait/landscape)
- Display mode

---

## Authentication & Backend

Your app currently runs **client-side only** (no backend). To add user accounts and data persistence, here are the best options:

### Option 1: Firebase (Easiest) ⭐

**Features:**
- Authentication (email, Google, phone, etc.)
- Real-time Database or Firestore
- File storage
- Free tier: 50k reads/day, 20k writes/day

**Setup:**
```bash
npm install firebase

# Create src/firebase.js
```

```javascript
// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "prs-precision.firebaseapp.com",
  projectId: "prs-precision",
  storageBucket: "prs-precision.appspot.com",
  messagingSenderId: "123456789",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
```

**Authentication Example:**
```javascript
import { auth, googleProvider } from './firebase';
import { signInWithPopup } from 'firebase/auth';

// Google Sign-In
const handleGoogleSignIn = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('User:', result.user);
  } catch (error) {
    console.error('Auth error:', error);
  }
};
```

**Save Session Data:**
```javascript
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

const saveSession = async (sessionData) => {
  await addDoc(collection(db, 'sessions'), {
    ...sessionData,
    userId: auth.currentUser.uid,
    timestamp: new Date()
  });
};
```

---

### Option 2: Supabase (Firebase Alternative)

**Features:**
- PostgreSQL database (more powerful than Firebase)
- Authentication
- File storage
- Free tier: 500MB database, 1GB storage

**Setup:**
```bash
npm install @supabase/supabase-js

# Create src/supabase.js
```

```javascript
// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
```

**Authentication:**
```javascript
import { supabase } from './supabase';

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@email.com',
  password: 'password123'
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@email.com',
  password: 'password123'
});
```

---

### Option 3: Clerk (Premium Auth)

**Best for:** Professional auth with built-in UI components

**Pricing:** Free tier: 5,000 monthly active users

**Setup:**
```bash
npm install @clerk/clerk-react
```

```javascript
import { ClerkProvider, SignIn, SignUp, UserButton } from '@clerk/clerk-react';

function App() {
  return (
    <ClerkProvider publishableKey="pk_test_...">
      <UserButton />
      {/* Your app */}
    </ClerkProvider>
  );
}
```

---

### Option 4: Auth0

**Best for:** Enterprise-grade authentication

**Pricing:** Free tier: 7,000 active users

**Setup:**
```bash
npm install @auth0/auth0-react
```

---

## Mobile Native App (Future Option)

To create a **real native app** for iOS/Android app stores, you'd need to convert to React Native.

### Effort Estimate: 3-4 weeks

**Why it's complex:**
- React (web) ≠ React Native (mobile)
- Different component library (View, Text, Image instead of div, span, img)
- Canvas API → React Native image processing libraries
- Different navigation, storage, camera APIs

### If You Need Native App:

**Option A: Expo (Recommended for React Native)**

```bash
# Create new Expo project
npx create-expo-app prs-mobile

# Install dependencies
cd prs-mobile
npm install expo-camera expo-image-picker expo-file-system

# Rewrite components for React Native
# ... (significant development effort)

# Test on phone
npm start
# Scan QR code with Expo Go app

# Build for stores
eas build --platform ios
eas build --platform android
```

**Option B: Use PWA (90% as good, 0 effort)**

The PWA you already have works amazingly well on phones:
- ✅ Installable to home screen
- ✅ Full-screen experience
- ✅ Offline support
- ✅ Camera access (through browser)
- ✅ No app store approval needed
- ✅ Updates instantly (no app store review)

**Limitations of PWA vs Native:**
- ⚠️ Limited push notifications on iOS
- ⚠️ No access to some native APIs
- ⚠️ Must use browser camera (not as seamless as native)

**Recommendation:** Start with PWA. Only build native if you hit specific limitations.

---

## Environment Configuration

### Production Environment Variables

Create `.env.production`:

```bash
# .env.production
REACT_APP_API_URL=https://api.yourbackend.com
REACT_APP_FIREBASE_API_KEY=your_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain_here
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
```

Access in code:
```javascript
const apiUrl = process.env.REACT_APP_API_URL;
```

### Vercel Environment Variables

```bash
# Set via CLI
vercel env add REACT_APP_API_URL production

# Or in Vercel dashboard:
# Settings → Environment Variables
```

### Netlify Environment Variables

```bash
# netlify.toml
[build.environment]
  REACT_APP_API_URL = "https://api.yourbackend.com"

# Or in Netlify dashboard:
# Site settings → Build & deploy → Environment
```

---

## Recommended Deployment Strategy

### For Your PRS App:

1. **Phase 1 - Web App (Now)** ⬅️ YOU ARE HERE
   - Deploy to Vercel (free, instant)
   - Users access via browser
   - PWA installable to home screen

2. **Phase 2 - Add Authentication (Week 2)**
   - Add Firebase Authentication
   - Save sessions to Firestore
   - User accounts and data persistence

3. **Phase 3 - Enhanced Features (Month 2)**
   - Real-time sync across devices
   - Social features (share groups, compare with friends)
   - Advanced analytics dashboard

4. **Phase 4 - Native App (If Needed)**
   - Only if you hit PWA limitations
   - Build with React Native + Expo
   - Submit to App Store / Play Store

---

## Quick Deploy Commands Cheat Sheet

```bash
# Vercel (recommended)
vercel --prod

# Netlify
netlify deploy --prod --dir=build

# Firebase
firebase deploy

# GitHub Pages
npm run deploy

# Test locally
npm start                    # Development
npm run build && npx serve -s build  # Production
```

---

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **Netlify Docs:** https://docs.netlify.com
- **Firebase Docs:** https://firebase.google.com/docs
- **PWA Guide:** https://web.dev/progressive-web-apps/
- **React Deployment:** https://create-react-app.dev/docs/deployment/

---

## Need Help?

Common issues:

**Q: Blank page after deployment?**
A: Check browser console. Usually missing `homepage` in package.json or incorrect build path.

**Q: PWA not installing on iPhone?**
A: Must use Safari (not Chrome). Requires HTTPS. Check manifest.json exists.

**Q: Firebase quota exceeded?**
A: Free tier limits hit. Upgrade to Blaze plan (pay-as-you-go).

**Q: How to add custom domain?**
A: All platforms support custom domains. Add in platform dashboard, update DNS records.

---

**Recommended First Deploy: Vercel**

Deploy right now in 2 minutes:
```bash
npx vercel --prod
```

Your app will be live at `https://prs-precision.vercel.app` (or similar).

Share the URL with your phone → Add to home screen → Boom! Mobile app! 🎯
