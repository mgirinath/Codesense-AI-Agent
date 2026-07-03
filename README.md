# CodeSense — AI Code Review Agent

Paste in code, and it tells you what the code does, finds real bugs (via a
safe static checker + an LLM), gives suggestions, and offers a fix — all in
your browser. Now with a Claude-style sidebar history, accounts, and theme
customization.

- **LLM**: Groq (free, no credit card) — does the reasoning: purpose, bugs, suggestions
- **Backend**: Flask
- **"Testing"**: Python's `ast` + `pyflakes` — catches syntax errors and undefined
  names *without executing your code* (running arbitrary pasted code on a
  public server is a security risk, so we analyze its structure instead)
- **Database**: Neon (free hosted PostgreSQL) — stores accounts and each
  user's private review history; survives redeploys since it lives online,
  not on the server's local disk
- **Accounts**: sign up / log in (passwords hashed, never stored in plain
  text); history is private per account. You can also use it as a guest —
  analysis still works, it just won't be saved anywhere
- **Frontend**: plain HTML/CSS/JS, no build step needed — intro animation,
  color-coded review sections, collapsible history sidebar, and a settings
  panel with light/dark mode + 5 accent colors

## Part 1 — Run it on your own computer

### Step 1: Get a free Groq API key
1. Go to https://console.groq.com and sign up (email or Google — no card).
2. Click **API Keys** in the left sidebar → **Create API Key**.
3. Copy the key (starts with `gsk_...`) — you won't be able to see it again.

### Step 2: Get a free Neon database
1. Go to https://neon.tech and sign up (no card required).
2. Create a new project (any name, e.g. `code-review-agent`).
3. On the project dashboard, find **Connection Details** / **Connection
   String** — it looks like:
   ```
   postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
4. Copy that whole string — you'll need it in Step 3.

### Step 3: Set up the project
Open a terminal in this folder and run:

```bash
pip install -r requirements.txt
```

Then create a file named `.env` in this same folder with this exact content
(paste your real Groq key and Neon connection string in place of the
placeholders):

```
GROQ_API_KEY=gsk_your_real_key_here
DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
SECRET_KEY=any_long_random_string_you_make_up
```

`SECRET_KEY` is used to sign login sessions — make it something random and
private (e.g. mash your keyboard for 40 characters). It should never be
shared or uploaded to GitHub either.

This file holds your secrets — it should never be shared or uploaded to
GitHub. We'll make sure of that in Step 5.

### Step 4: Run it
```bash
python app.py
```
You should see something like `Running on http://127.0.0.1:5000`. Open that
address in your browser, paste in some code, and click **Analyze Code**.

If you see an error mentioning `GROQ_API_KEY` or `DATABASE_URL`, double
check the `.env` file is saved in the same folder as `app.py` and has no
typos.

### Step 5: Put it on GitHub (so Render can deploy it)
Create a file named `.gitignore` in this folder with this content, so your
secret keys never get uploaded:
```
.env
__pycache__/
*.pyc
```

Then, in the terminal:
```bash
git init
git add .
git commit -m "code review agent"
```
Go to https://github.com → **+** → **New repository** → name it (e.g.
`code-review-agent`) → **Create repository**. Copy the commands GitHub shows
you under "…or push an existing repository," they'll look like:
```bash
git remote add origin https://github.com/YOUR-USERNAME/code-review-agent.git
git branch -M main
git push -u origin main
```

## Part 2 — Deploy it for free on Render

1. Go to https://render.com and sign up with your GitHub account (no card
   needed).
2. Click **New +** → **Web Service**.
3. Connect the `code-review-agent` repo you just pushed.
4. Fill in these settings:
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: Free
5. Scroll to **Environment Variables** → **Add Environment Variable** (add
   all three of these, same values as your `.env` file):
   - Key: `GROQ_API_KEY`, Value: your real Groq key
   - Key: `DATABASE_URL`, Value: your real Neon connection string
   - Key: `SECRET_KEY`, Value: your random session-signing string
6. Click **Create Web Service**.

Render will build and deploy automatically — takes a couple of minutes the
first time. When it's done, you'll get a live URL like
`https://code-review-agent.onrender.com` that anyone can visit.

**Good to know**: Render's free tier sleeps after 15 minutes of no traffic,
so the first request after a while takes 30-60 seconds to wake back up —
that's normal, not a bug. Neon's free database also pauses after inactivity
and wakes up automatically on the next query, usually within a second.
Since your data now lives in Neon (not on Render's disk), your review
history survives redeploys.

## How the pieces fit together

```
Browser (index.html + script.js)
    │  POST /analyze, /signup, /login, /history...
    ▼
app.py (Flask)
    │
    ├─► auth.py         — signup/login/session logic, password hashing
    ├─► analyzer.py      — static check (ast + pyflakes), no code execution
    ├─► prompts.py        — builds the system + user prompt for the LLM
    ├─► groq_client.py    — sends prompt to Groq, gets back the review
    └─► db.py             — Neon (Postgres): users table + per-user reviews table
```

## Extending this later
- Swap `check_generic()` in `analyzer.py` for real linters per language
  (e.g. ESLint for JavaScript) if you want static checks beyond Python.
- Sync theme choice to the account (`db.update_theme`) instead of just
  browser `localStorage`, so your theme follows you across devices.
- Neon supports "branching" (a free instant copy of your database) if you
  ever want a separate space to test schema changes without touching real
  data.
