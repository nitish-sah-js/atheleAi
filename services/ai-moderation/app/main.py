import json
import os
from enum import Enum
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field


class Severity(str, Enum):
    UNKNOWN = "UNKNOWN"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ModerateRequest(BaseModel):
    text: str = Field(min_length=20, max_length=20_000)


class ModerateResponse(BaseModel):
    severity: Severity
    toxicityScore: float = Field(ge=0, le=1)
    summary: str
    repeatedIncidentHints: list[str] = Field(default_factory=list)


app = FastAPI(title="AthleteShield AI Moderation Service", version="0.1.0")


def require_service_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("AI_SERVICE_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=500, detail="AI service token is not configured")

    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid service token")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "athleteshield-ai-moderation"}


@app.post("/moderate", response_model=ModerateResponse, dependencies=[Depends(require_service_token)])
async def moderate(payload: ModerateRequest) -> ModerateResponse:
    provider = os.getenv("AI_PROVIDER", "heuristic").lower()

    if provider == "openai" and os.getenv("OPENAI_API_KEY"):
        return await moderate_with_openai(payload.text)

    if provider == "gemini" and os.getenv("GEMINI_API_KEY"):
        return await moderate_with_gemini(payload.text)

    return heuristic_moderation(payload.text)


async def moderate_with_openai(text: str) -> ModerateResponse:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    prompt = moderation_prompt(text)
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODERATION_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": "Return only strict JSON for abuse-report triage."},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
    )
    content = response.choices[0].message.content or "{}"
    return parse_provider_response(content, text)


async def moderate_with_gemini(text: str) -> ModerateResponse:
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    prompt = moderation_prompt(text)

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            params={"key": api_key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        response.raise_for_status()
        data = response.json()

    content = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "{}")
    )
    return parse_provider_response(content, text)


def moderation_prompt(text: str) -> str:
    return json.dumps(
        {
            "task": "Classify an athlete abuse report. Do not investigate, do not identify people, and do not provide legal advice.",
            "allowed_output": {
                "severity": ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
                "toxicityScore": "number from 0 to 1",
                "summary": "one concise neutral sentence",
                "repeatedIncidentHints": "short phrases indicating repeated incident patterns",
            },
            "report": text,
        }
    )


def parse_provider_response(content: str, original_text: str) -> ModerateResponse:
    try:
        cleaned = content.strip().removeprefix("```json").removesuffix("```").strip()
        data: dict[str, Any] = json.loads(cleaned)
        return ModerateResponse(
            severity=Severity(data.get("severity", "UNKNOWN")),
            toxicityScore=float(data.get("toxicityScore", 0)),
            summary=str(data.get("summary", ""))[:500] or summarize(original_text),
            repeatedIncidentHints=list(data.get("repeatedIncidentHints", []))[:10],
        )
    except Exception:
        return heuristic_moderation(original_text)


def heuristic_moderation(text: str) -> ModerateResponse:
    lowered = text.lower()
    critical_terms = ["threat", "assault", "weapon", "blackmail", "self harm", "suicide"]
    high_terms = ["abuse", "harassment", "coercion", "retaliation", "stalking", "discrimination"]
    medium_terms = ["bullying", "intimidation", "unsafe", "humiliation", "verbal"]

    if any(term in lowered for term in critical_terms):
        severity = Severity.CRITICAL
        score = 0.95
    elif any(term in lowered for term in high_terms):
        severity = Severity.HIGH
        score = 0.8
    elif any(term in lowered for term in medium_terms):
        severity = Severity.MEDIUM
        score = 0.55
    else:
        severity = Severity.LOW
        score = 0.2

    hints = [term for term in high_terms + medium_terms if term in lowered][:5]

    return ModerateResponse(
        severity=severity,
        toxicityScore=score,
        summary=summarize(text),
        repeatedIncidentHints=hints,
    )


def summarize(text: str) -> str:
    compact = " ".join(text.split())
    return compact[:240] + ("..." if len(compact) > 240 else "")
