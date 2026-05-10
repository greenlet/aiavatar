"""FastAPI app: LLM streaming + Azure Speech token mint."""
from __future__ import annotations

import json
import logging
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import AsyncAzureOpenAI
from pydantic import BaseModel, Field

from .config import get_settings
from .prompts import SYSTEM_PROMPT

logger = logging.getLogger("aiavatar.backend")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AI Avatar Backend")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    deployment: str | None = None  # optional override of the model deployment


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "openai_configured": settings.is_openai_configured,
        "speech_configured": settings.is_speech_configured,
        "deployment": settings.azure_openai_deployment,
    }


@app.post("/api/speech-token")
async def speech_token() -> dict:
    """Mint a short-lived (≈10 min) Azure Speech auth token for the browser SDK."""
    if not settings.is_speech_configured:
        raise HTTPException(500, "Azure Speech not configured")
    url = (
        f"https://{settings.azure_speech_region}.api.cognitive.microsoft.com"
        "/sts/v1.0/issueToken"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            url,
            headers={
                "Ocp-Apim-Subscription-Key": settings.azure_speech_key,
                "Content-Length": "0",
            },
        )
    if resp.status_code != 200:
        logger.error("Speech token mint failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(502, "Failed to mint speech token")
    return {"token": resp.text, "region": settings.azure_speech_region}


def _openai_client() -> AsyncAzureOpenAI:
    if not settings.is_openai_configured:
        raise HTTPException(500, "Azure OpenAI not configured")
    return AsyncAzureOpenAI(
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
    )


async def _stream_chat(req: ChatRequest) -> AsyncIterator[str]:
    client = _openai_client()
    deployment = req.deployment or settings.azure_openai_deployment
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(m.model_dump() for m in req.messages)
    try:
        stream = await client.chat.completions.create(
            model=deployment,
            messages=messages,
            stream=True,
            temperature=0.7,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            text = getattr(delta, "content", None)
            if text:
                yield f"data: {json.dumps({'delta': text})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    except Exception as exc:  # noqa: BLE001 — surface to client as SSE error
        logger.exception("Chat stream failed")
        yield f"data: {json.dumps({'error': str(exc)})}\n\n"


@app.post("/api/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream_chat(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
