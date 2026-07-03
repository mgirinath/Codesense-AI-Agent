"""
Thin wrapper around the Groq API (OpenAI-compatible endpoint). Groq's free
tier requires no credit card — get a key at https://console.groq.com
"""
import os

import requests

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")


class GroqError(Exception):
    pass


def analyze_with_groq(system_prompt: str, user_prompt: str) -> str:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise GroqError("GROQ_API_KEY is not set. Get a free key at https://console.groq.com")

    response = requests.post(
        GROQ_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,  # low temperature: we want consistent, factual review, not creativity
            "max_tokens": 2000,
        },
        timeout=30,
    )

    if response.status_code != 200:
        raise GroqError(f"Groq API error {response.status_code}: {response.text[:300]}")

    data = response.json()
    return data["choices"][0]["message"]["content"]
