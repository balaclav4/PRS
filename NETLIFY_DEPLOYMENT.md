# Netlify Deployment Guide for PRS Precision App

This guide will help you deploy the PRS Precision app to Netlify.

## Prerequisites

- Netlify account (free tier works great)
- Firebase project configured (you already have this)
- Git repository pushed to GitHub/GitLab/Bitbucket

## Important: Environment Variables

**CRITICAL**: Before deploying, you MUST add your Firebase credentials as environment variables in Netlify.

### Step 1: Add Environment Variables to Netlify

1. Log in to [Netlify](https://app.netlify.com/)
2. Select your site (or create a new one)
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable** and add each of these:

```
REACT_APP_FIREBASE_API_KEY=AIzaSyDqaduh-6LPqoaBrOOoN-FygDtKgsS6tF4
REACT_APP_FIREBASE_AUTH_DOMAIN=prs-precision.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=prs-precision
REACT_APP_FIREBASE_STORAGE_BUCKET=prs-precision.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=53838980851
REACT_APP_FIREBASE_APP_ID=1:53838980851:web:35aad520bc6863f4507986
REACT_APP_FIREBASE_MEASUREMENT_ID=G-MXG228YXGG
```

⚠️ **Important**: Copy these values from your `.env.local` file. These are already your actual Firebase credentials.

## Deployment Methods

### Method 1: Connect Git Repository (Recommended)

This enables automatic deployments on every git push.

1. Log in to [Netlify](https://app.netlify.com/)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose your git provider (GitHub/GitLab/Bitbucket)
4. Select your PRS repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `build`
   - **Branch to deploy**: `claude/fix-target-scaling-recognition-011CUiGYcsEcXohh8icGLjDm` (or merge to main first)
6. Click **"Deploy site"**

Netlify will automatically:
- Install dependencies
- Run build command
- Deploy to a unique URL (e.g., `your-site-name.netlify.app`)

### Method 2: Netlify CLI (Manual Deployment)

If you prefer manual deployments or want to test before connecting git:

1. Install Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Initialize the site (first time only):
   ```bash
   netlify init
   ```

4. Deploy:
   ```bash
   netlify deploy --prod
   ```

### Method 3: Drag & Drop

Quick and simple, but no automatic deployments:

1. Log in to [Netlify](https://app.netlify.com/)
2. Scroll down to **"Want to deploy a new site without connecting to Git?"**
3. Drag and drop your `build` folder
4. Done! But remember to add environment variables afterward.

## After Deployment

### 1. Configure Custom Domain (Optional)

1. In Netlify, go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Follow instructions to update DNS records

### 2. Verify Firebase Configuration

1. Visit your deployed site URL
2. Try to sign up/login
3. Check browser console for any Firebase errors
4. If you see errors, double-check environment variables in Netlify

### 3. Update Firebase Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **prs-precision**
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Add your Netlify domain (e.g., `your-site-name.netlify.app`)
5. Click **"Add domain"**

This is required for Firebase Authentication to work on your deployed site.

## Configuration Files

The repository includes:

- **`netlify.toml`**: Build and redirect configuration
- **`public/_redirects`**: SPA routing (all routes → index.html)

These ensure React Router works correctly on Netlify.

## Troubleshooting

### Build Fails

**Error**: `Command failed with exit code 1`
- Check that all environment variables are set in Netlify
- Verify Node version is 18 or higher
- Check build logs for specific errors

### Firebase Authentication Not Working

**Error**: `auth/unauthorized-domain`
- Add your Netlify domain to Firebase Authorized Domains (see Step 3 above)

### Routes Return 404

- Verify `netlify.toml` and `public/_redirects` are in the repository
- Redeploy the site

### Environment Variables Not Working

- Variable names MUST start with `REACT_APP_`
- After adding variables, trigger a new deploy (even without code changes)
- Clear Netlify cache and redeploy

## Build Information

- **Framework**: React 18.2.0
- **Build Tool**: Create React App
- **Bundle Size**: 169 KB (gzipped)
- **Node Version**: 18+

## Support

For issues:
1. Check Netlify deploy logs
2. Check browser console
3. Verify Firebase configuration
4. Check GitHub issues: https://github.com/your-username/PRS/issues

## Next Steps After Deployment

1. Test all features on the deployed site
2. Invite beta users
3. Monitor Firebase usage in Firebase Console
4. Monitor Netlify analytics
5. Consider setting up custom domain
6. Set up monitoring/error tracking (optional)

---

**Your app is now live!** 🚀

Share the URL with your beta testers. Each user will have their own isolated data stored in Firebase.
