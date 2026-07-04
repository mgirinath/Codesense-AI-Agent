"""
Storage layer — Neon (free hosted PostgreSQL, https://neon.tech).

Two tables:
- users:   account (username, email, hashed password) + saved theme prefs
- reviews: one row per code analysis, linked to the user who ran it

Reads the connection string from the DATABASE_URL environment variable.
Get yours from the Neon dashboard: Project -> Connection Details.
"""
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from werkzeug.security import check_password_hash, generate_password_hash

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_connection():
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. Create a free Postgres database at "
            "https://neon.tech, copy its connection string, and put it in "
            "your .env file (locally) or Render's environment variables."
        )
    return psycopg2.connect(DATABASE_URL)


def init_db():
    conn = get_connection()
    with conn, conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                theme_mode TEXT NOT NULL DEFAULT 'dark',
                theme_accent TEXT NOT NULL DEFAULT 'teal',
                created_at TIMESTAMPTZ NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mode TEXT NOT NULL DEFAULT 'debug',
                language TEXT NOT NULL,
                code TEXT NOT NULL,
                static_issues TEXT,
                review TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL
            )
        """)
        # Safe to run every startup: adds the column only if it isn't there
        # yet, so this doesn't break a database that already has the table
        # from before the Generator feature existed.
        cur.execute("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'debug'")
    conn.close()


# --- Users -------------------------------------------------------------

def get_user_by_username_or_email(identifier: str) -> dict | None:
    """Looks up a user by username OR email — used for both login (either
    field works) and signup's duplicate check."""
    if not identifier:
        return None
    conn = get_connection()
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, username, email, password_hash, theme_mode, theme_accent "
            "FROM users WHERE username = %s OR email = %s",
            (identifier, identifier),
        )
        row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(username: str, email: str, password: str) -> int:
    conn = get_connection()
    with conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users (username, email, password_hash, created_at) "
            "VALUES (%s, %s, %s, %s) RETURNING id",
            (username, email, generate_password_hash(password), datetime.now(timezone.utc)),
        )
        user_id = cur.fetchone()[0]
    conn.close()
    return user_id


def verify_password(user: dict, password: str) -> bool:
    return check_password_hash(user["password_hash"], password)


def get_user_by_id(user_id: int) -> dict | None:
    conn = get_connection()
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, username, email, theme_mode, theme_accent FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def update_theme(user_id: int, mode: str, accent: str) -> None:
    conn = get_connection()
    with conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET theme_mode = %s, theme_accent = %s WHERE id = %s",
            (mode, accent, user_id),
        )
    conn.close()


# --- Reviews & Generations (both live in the `reviews` table, distinguished
# by `mode`: 'debug' for the reviewer, 'generate' for the code generator) --

def save_review(user_id: int, language: str, code: str, static_issues: list[str],
                 review: str, mode: str = "debug") -> int:
    conn = get_connection()
    with conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO reviews (user_id, mode, language, code, static_issues, review, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (user_id, mode, language, code, "\n".join(static_issues), review, datetime.now(timezone.utc)),
        )
        review_id = cur.fetchone()[0]
    conn.close()
    return review_id


def get_history(user_id: int, limit: int = 30) -> list[dict]:
    conn = get_connection()
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, mode, language, code, created_at FROM reviews "
            "WHERE user_id = %s ORDER BY id DESC LIMIT %s",
            (user_id, limit),
        )
        rows = cur.fetchall()
    conn.close()
    return [{**row, "created_at": row["created_at"].isoformat()} for row in rows]


def get_review_by_id(user_id: int, review_id: int) -> dict | None:
    conn = get_connection()
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, mode, language, code, static_issues, review, created_at FROM reviews "
            "WHERE user_id = %s AND id = %s",
            (user_id, review_id),
        )
        row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {**row, "created_at": row["created_at"].isoformat()}
