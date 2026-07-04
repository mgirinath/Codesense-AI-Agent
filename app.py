import os

from dotenv import load_dotenv

load_dotenv()

from flask import Flask, jsonify, render_template, request, session

import auth
import db
import prompts
from analyzer import run_checks
from groq_client import GroqError, analyze_with_groq

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-insecure-key-change-me")
db.init_db()


@app.route("/")
def home():
    return render_template("index.html")


# --- Auth ---------------------------------------------------------------

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    user, error = auth.signup(data.get("username"), data.get("email"), data.get("password"))
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"user": user})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    user, error = auth.login(data.get("identifier"), data.get("password"))
    if error:
        return jsonify({"error": error}), 401
    return jsonify({"user": user})


@app.route("/logout", methods=["POST"])
def logout():
    auth.logout()
    return jsonify({"ok": True})


@app.route("/me", methods=["GET"])
def me():
    user = auth.current_user()
    return jsonify({"user": user})


# --- Code review ----------------------------------------------------------

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    language = (data.get("language") or "python").strip().lower()

    if not code:
        return jsonify({"error": "Please paste some code to analyze."}), 400
    if len(code) > 20000:
        return jsonify({"error": "That's a lot of code — please paste under 20,000 characters."}), 400

    static_issues = run_checks(code, language)
    user_prompt = prompts.build_user_prompt(code, language, static_issues)

    try:
        review = analyze_with_groq(prompts.SYSTEM_PROMPT, user_prompt)
    except GroqError as e:
        return jsonify({"error": str(e)}), 502

    user = auth.current_user()
    review_id = None
    if user:
        review_id = db.save_review(user["id"], language, code, static_issues, review)

    return jsonify({
        "id": review_id,
        "static_issues": static_issues,
        "review": review,
        "saved": user is not None,
    })


# --- Code generation --------------------------------------------------

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or {}
    description = (data.get("prompt") or "").strip()
    target_language = (data.get("target_language") or "python").strip().lower()

    if not description:
        return jsonify({"error": "Please describe the program you want."}), 400
    if len(description) > 4000:
        return jsonify({"error": "That description is too long — please shorten it."}), 400

    user_prompt = prompts.build_generator_user_prompt(description, target_language)

    try:
        result = analyze_with_groq(prompts.GENERATOR_SYSTEM_PROMPT, user_prompt)
    except GroqError as e:
        return jsonify({"error": str(e)}), 502

    user = auth.current_user()
    review_id = None
    if user:
        review_id = db.save_review(user["id"], target_language, description, [], result, mode="generate")

    return jsonify({
        "id": review_id,
        "result": result,
        "saved": user is not None,
    })


@app.route("/history", methods=["GET"])
@auth.login_required
def history():
    user = auth.current_user()
    return jsonify(db.get_history(user["id"]))


@app.route("/history/<int:review_id>", methods=["GET"])
@auth.login_required
def history_item(review_id):
    user = auth.current_user()
    review = db.get_review_by_id(user["id"], review_id)
    if not review:
        return jsonify({"error": "Not found"}), 404
    return jsonify(review)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
