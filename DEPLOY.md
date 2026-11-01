# Putting TMS online

Everything here uses free plans that don't need a credit card.

| Part | Where | What you get |
|---|---|---|
| Database | **Aiven** (free MySQL, 1 GB) | an online MySQL database |
| AI priority service | **Render** web service `tms-ai` | e.g. `https://tms-ai.onrender.com` |
| App + API | **Render** web service `tms` | e.g. `https://tms.onrender.com`. This is the link you share |
| Photos | **Cloudinary** (already set up) | |

Do the steps **in this order**. Each one needs a value from the one before.

> **Free plan behaviour:** Render puts free services to sleep after 15 minutes with no visitors. The first visit after that takes about a minute while it wakes up. Before a demo, open the app 2 to 3 minutes early. Aiven may also switch off a free database that has been unused for a long time. You'll get an email, and you can switch it back on in the Aiven console.

---

## 1. Database on Aiven

1. Log in at **console.aiven.io**.
2. Click **Create service**, then choose **MySQL**.
3. Pick the **Free** plan. Choose any cloud region (Europe is closest to Kenya, for example `google-europe-west1`).
4. Name it `tms-db` and click **Create service**. Wait until the status says **Running** (a few minutes).
5. On the service's **Overview** page, find **Service URI** and click the copy icon. It looks like:
   `mysql://avnadmin:LONG_PASSWORD@tms-db-yourname.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`
6. Keep it somewhere private, such as Notepad. **This is your `DATABASE_URL`.** Don't share it.

You don't need to create any tables. The server does that by itself the first time it starts, and adds the demo accounts.

## 2. AI service on Render

1. Log in at **dashboard.render.com** (with GitHub).
2. Click **+ New**, then **Web Service**.
3. Under **Git Provider**, choose **GitHub**. If `Tenant-Management-System` isn't listed, click **Configure account** / **Connect GitHub**, allow Render access to that repository, and come back.
4. Select **Tenant-Management-System** and fill in:

| Setting | Value |
|---|---|
| Name | `tms-ai` |
| Language | **Python 3** |
| Branch | `main` |
| Root Directory | `ai-service` |
| Build Command | `pip install -r requirements.txt && python train.py` |
| Start Command | `uvicorn app:app --host 0.0.0.0 --port $PORT` |
| Instance Type | **Free** |

5. Click **Deploy Web Service**. The first build takes 3 to 6 minutes (it installs packages and trains the model). Wait for **Live**.
6. Copy the service's address from the top of the page (e.g. `https://tms-ai.onrender.com` or with extra letters, like `https://tms-ai-ab12.onrender.com`). **This is your `AI_SERVICE_URL`.**
7. Check it: open that address with `/health` on the end. You should see `"status":"ok"`.

## 3. App and API on Render

1. Click **+ New**, then **Web Service**, and choose the same repository.
2. Fill in:

| Setting | Value |
|---|---|
| Name | `tms` |
| Language | **Node** |
| Branch | `main` |
| Root Directory | *(leave empty)* |
| Build Command | `cd client && npm ci --include=dev && npm run build && cd ../server && npm ci --include=dev` |
| Start Command | `cd server && npm run start:prod` |
| Instance Type | **Free** |

3. Scroll to **Environment Variables** and add these four (**+ Add Environment Variable** for each):

| Key | Value |
|---|---|
| `DATABASE_URL` | the Aiven Service URI from step 1 |
| `JWT_SECRET` | click **Generate** (or type any long random text) |
| `AI_SERVICE_URL` | the `tms-ai` address from step 2 |
| `CLOUDINARY_URL` | the same `cloudinary://...` line as in your local `server/.env` (just the part inside the quotes) |

4. Under **Advanced**, set **Health Check Path** to `/api/health`.
5. Click **Deploy Web Service** and wait for **Live** (3 to 5 minutes). In the **Logs** you should see:
   ```
   Creating database tables...
   Created 7 tables.
   No users yet, adding demo data...
   TMS API running on ...
   Photos are stored on Cloudinary
   Also serving the app from client/dist
   ```
6. Open the service's address (e.g. `https://tms.onrender.com`). That's your live app.

## 4. Try it

- Log in with the demo buttons. Report an issue as Brian. With the AI awake, it says **Recommended by AI**.
- **On your phone:** open the same address in Chrome. Tap the menu (⋮), then **Add to Home screen** / **Install app**. It now opens like a normal app and works offline.
- Check `https://your-app.onrender.com/api/health` shows `"database":"connected"`.

## Updating later

Every time new code is pushed to GitHub, Render rebuilds and redeploys both services by itself. Your data in Aiven stays.

## If something goes wrong

| What you see | What to check |
|---|---|
| Build fails | Open **Logs** on Render and look for the first red line. |
| `Database setup failed: ...` in the logs | `DATABASE_URL` is wrong or the Aiven service isn't **Running**. Copy the Service URI again. |
| `Access denied` | The password in `DATABASE_URL` is wrong. Copy the Service URI again, don't type it. |
| Requests always say "Set by keyword rules" | `AI_SERVICE_URL` is wrong, or `tms-ai` is asleep or failed. Open its `/health`. Right after waking, the first report or two may use the rules; that's the fallback working. |
| Photo upload fails | `CLOUDINARY_URL` on Render doesn't match your local one. |

### Note for the report

The online database tables are created from `server/prisma/init.sql`, which matches `server/prisma/schema.prisma`. If the schema changes, update that file too (locally, `npx prisma migrate dev` generates the SQL you can copy).
