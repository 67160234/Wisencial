"""FastAPI Standalone Microservice for Gemini News Classifier (V.4).

Deploy directly to Google Cloud Run, AWS App Runner, ECS, or Docker.
"""

from __future__ import annotations

import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from gemini_news_classifier import GeminiNewsClassifier

app = FastAPI(
    title="Gemini News Classifier Microservice (V.4)",
    description="Automated financial news sentiment & importance classification using Gemini few-shot learning.",
    version="4.0.0",
)

# CORS configuration
allowed_origins_raw = os.environ.get("CORS_ORIGINS", "*")
allowed_origins = [orig.strip() for orig in allowed_origins_raw.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier: Optional[GeminiNewsClassifier] = None


@app.on_event("startup")
def startup_event() -> None:
    global classifier
    try:
        classifier = GeminiNewsClassifier.from_environment()
    except Exception as exc:
        print(f"Warning on startup: {exc}. Requests requiring classifier will return 503 until GEMINI_API_KEY is supplied.")


class ClassifyArticleRequest(BaseModel):
    article_id: Optional[str] = Field(None, description="Optional custom unique identifier")
    title: str = Field(..., max_length=1200, description="Headline or title")
    description: Optional[str] = Field("", max_length=2000, description="Summary or body snippet")


class BatchClassifyRequest(BaseModel):
    articles: List[ClassifyArticleRequest] = Field(..., min_length=1, max_length=50)


class ClassifyResponse(BaseModel):
    article_id: str
    sentiment: str
    importance: str
    confidence: float
    review_required: bool
    model: str
    prompt_version: str
    cached: Optional[bool] = False


class BatchClassifyResponse(BaseModel):
    results: List[ClassifyResponse]
    total: int
    review_count: int
    duration_ms: float


@app.get("/", include_in_schema=False)
def root():
    return {"message": "Gemini News Classifier Microservice V.4", "docs": "/docs"}


@app.get("/ai/news/health", tags=["Health"])
def health_check():
    if not classifier or not classifier.api_key:
        return {
            "status": "missing_api_key",
            "version": "V.4",
            "model": os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest"),
            "ready": False,
        }
    return {**classifier.health_check(), "ready": True}


@app.post("/ai/news/classify", response_model=ClassifyResponse, tags=["Classification"])
def classify_article(request: ClassifyArticleRequest):
    if not classifier or not classifier.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY is not configured on the server",
        )
    try:
        result = classifier.classify(
            title=request.title,
            description=request.description or "",
            article_id=request.article_id,
        )
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Inference error: {exc}")


@app.post("/ai/news/classify-batch", response_model=BatchClassifyResponse, tags=["Classification"])
def classify_batch(request: BatchClassifyRequest):
    if not classifier or not classifier.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY is not configured on the server",
        )
    try:
        articles_data = [art.model_dump() for art in request.articles]
        return classifier.classify_batch(articles_data)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Batch error: {exc}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
