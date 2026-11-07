# LinkGenie — Subscribe to Unlock Web Application

A minimalist, high-security **"Subscribe to Unlock"** web application built with **Next.js (App Router)**, **Tailwind CSS**, **Lucide React**, and **Framer Motion**. Designed for deployment on **Vercel**.

---

## ✨ Features

- **No Hardcoded Links**: Both the **YouTube Channel URL** and the **Target Video URL** are entered directly via the Creator Panel UI.
- **Salted & Checksum-Protected Encryption**: Encodes `{ channelUrl, videoUrl }` with a salted XOR stream and 32-bit FNV-1a checksum into URL-safe Base64 (`?v=TOKEN`). Casual users cannot decode it with standard Base64 or tamper with the parameters.
- **Strict Security & XSS Defense**:
  - Validates URLs through strict native `URL` parsing.
  - Whitelists only `http:` and `https:`.
  - Rejects `javascript:`, `data:`, `vbscript:`, embedded credentials, and HTML injection characters (`< > ' " \``).
  - Enforces safe redirects and leaves zero room for `dangerouslySetInnerHTML`.
- **Automatic Channel Subscription Prompt**: Appends `?sub_confirmation=1` to the channel link when clicked so users are immediately presented with the YouTube subscription modal.
- **5-Second Countdown Gate**:
  - Step 1: User clicks **"Subscribe to Channel"** (opens channel in a new tab with `noopener, noreferrer`).
  - Step 2: An animated progress bar and countdown start (`Unlocking in 5s...`).
  - Step 3: Unlocks into a glowing emerald **"Watch Video"** button and automatically redirects to the video.
- **Polished Apple/Stripe-Inspired UI**:
  - Dark mode glassmorphism (`backdrop-blur-2xl`, subtle borders, soft shadows).
  - Floating toast notification system for errors, copies, and successes.
  - Micro-interactions, hover states, and smooth tab transitions powered by **Framer Motion**.
  - Mobile-first responsive layout.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack compatible)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Package Manager**: pnpm

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start the Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build
```bash
pnpm run build
pnpm start
```

---

## ⚙️ Environment Variables (Optional)

Create a `.env.local` file to override the default encryption salt:

```bash
NEXT_PUBLIC_LINK_SALT=YourSuperSecretCustomSalt2026
```

---

## 🌐 Deploy to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import the repository into **Vercel**.
3. Framework preset will automatically detect **Next.js**.
4. (Optional) Add `NEXT_PUBLIC_LINK_SALT` in **Project Settings > Environment Variables**.
5. Click **Deploy**.

