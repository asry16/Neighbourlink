# Supabase & Google Authentication Integration Guide 🚀

Neighbourlink is configured with a hybrid database and authentication architecture:
- **Client & Server SDKs:** [`@supabase/supabase-js`](https://supabase.com/docs) & [`@supabase/ssr`](https://supabase.com/docs) with Next.js 16 async cookie handling.
- **Google OAuth:** Handled natively by Supabase Auth with server-side profile and role synchronization.
- **Database:** Supabase PostgreSQL with pooled connection management for Prisma.

---

## 📋 Step-by-Step Setup

### Step 1: Create a Supabase Project
1. Log in to **[supabase.com](https://supabase.com/)** and click **New Project**.
2. Set your **Project Name** (e.g. `neighbourlink`), choose a strong database password, and select your preferred region (e.g., `Mumbai / ap-south-1` for India).
3. Wait ~1 minute for Supabase to provision your PostgreSQL database.

---

### Step 2: Configure Google OAuth in Supabase
1. In your Supabase Dashboard, go to **Authentication** -> **Providers** -> select **Google**.
2. Toggle Google **Enable**.
3. You will see the **Callback URL (for OAuth)**:
   ```text
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
4. In your [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services** -> **Credentials**:
   - Create an **OAuth 2.0 Client ID** (Web application).
   - Add this Authorized Redirect URI:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy your Google **Client ID** and **Client Secret**.
5. Paste the Google **Client ID** and **Client Secret** into the Supabase Google Provider settings and click **Save**.
6. Under **Authentication** -> **URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** Add `http://localhost:3000/**`

---

### Step 3: Add Credentials to `.env`
Open your local [`.env`](file:///Users/asmitas_mac/Developer/neighbourhood/.env) file and add the credentials:

```env
# 1. Supabase API Credentials (Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."

# 2. Supabase PostgreSQL Connection String (Project Settings -> Database -> Connection string)
# Use Transaction Mode (port 6543) for DATABASE_URL:
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Use Session/Direct Mode (port 5432) for DIRECT_URL:
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
```

---

### Step 4: Push the Database Schema to Supabase

You have two convenient options to create the tables in Supabase:

#### Option A: 1-Click SQL Editor (Recommended)
1. In your Supabase Dashboard, open **SQL Editor**.
2. Click **New Query**.
3. Copy and paste the contents of [`prisma/supabase_schema.sql`](file:///Users/asmitas_mac/Developer/neighbourhood/prisma/supabase_schema.sql).
4. Click **Run**.
*(This automatically creates all 13 tables, foreign keys, and adds an auto-sync trigger that mirrors Supabase Auth sign-ups into the application `User` table!)*

#### Option B: Prisma CLI
Once `DATABASE_URL` and `DIRECT_URL` are in `.env`, run:
```bash
npm run db:supabase:push
```

---

### Step 5: Test the Application
1. Run your dev server:
   ```bash
   npm run dev
   ```
2. Open **[http://localhost:3000](http://localhost:3000)**.
3. Click the **Sign In** button in the top navigation bar.
4. Click **Continue with Google**.
5. Supabase will authenticate you with Google and return you directly to Neighbourlink with your verified Google profile picture and name!
