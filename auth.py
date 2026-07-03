"""
Simple session-based authentication. Passwords are hashed with werkzeug's
generate_password_hash (never stored in plain text). Sessions use Flask's
signed cookies — that's why SECRET_KEY must be set to something private.
"""
import re
from functools import wraps

from flask import jsonify, session

import db

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,20}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def signup(username: str, email: str, password: str) -> tuple[dict | None, str | None]:
    """Returns (user_dict, None) on success, or (None, error_message) on failure."""
    if not USERNAME_RE.match(username or ""):
        return None, "Username must be 3-20 characters: letters, numbers, underscores only."
    if not EMAIL_RE.match(email or ""):
        return None, "Please enter a valid email address."
    if not password or len(password) < 6:
        return None, "Password must be at least 6 characters."

    if db.get_user_by_username_or_email(username) or db.get_user_by_username_or_email(email):
        return None, "That username or email is already registered."

    user_id = db.create_user(username, email, password)
    session["user_id"] = user_id
    return {"id": user_id, "username": username, "email": email}, None


def login(identifier: str, password: str) -> tuple[dict | None, str | None]:
    user = db.get_user_by_username_or_email(identifier or "")
    if not user or not db.verify_password(user, password or ""):
        return None, "Incorrect username/email or password."
    session["user_id"] = user["id"]
    return {"id": user["id"], "username": user["username"], "email": user["email"]}, None


def logout():
    session.pop("user_id", None)


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.get_user_by_id(user_id)


def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Please log in first."}), 401
        return view_func(*args, **kwargs)
    return wrapped
