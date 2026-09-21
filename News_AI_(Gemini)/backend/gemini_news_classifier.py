"""Server-side Gemini few-shot classifier for Model Store V.4.

Features:
- Balanced 3x3 few-shot prompt coverage (BULLISH/BEARISH/NEUTRAL x HIGH/MEDIUM/LOW).
- Strict JSON schema enforcement using Gemini responseJsonSchema.
- In-memory SHA-256 caching for deduplication & API cost reduction.
- Automatic retry with exponential backoff for 429 and 5xx errors.
- Confidence thresholding (review_required=True when confidence < 0.80).
- Pure standard library implementation (no mandatory third-party dependencies).
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, TypedDict, Union
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

MODEL = "gemini-flash-lite-latest"
PROMPT_VERSION = "financial-news-fewshot-v4-sim"
SENTIMENTS = ("BULLISH", "BEARISH", "NEUTRAL")
IMPORTANCE = ("HIGH", "MEDIUM", "LOW")
DEFAULT_CONFIDENCE_THRESHOLD = 0.80
DEFAULT_CACHE_TTL_SECONDS = 86400  # 24 hours
EXAMPLES_PATH = Path(__file__).with_name("fewshot_examples.json")


class ClassificationResult(TypedDict):
    article_id: str
    sentiment: str
    importance: str
    confidence: float
    review_required: bool
    model: str
    prompt_version: str
    cached: Optional[bool]


class GeminiNewsClassifier:
    """Production-ready classifier leveraging Google Gemini V.4 few-shot learning."""

    def __init__(
        self,
        api_key: str,
        model: str = MODEL,
        examples_path: Path = EXAMPLES_PATH,
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
        cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS,
        max_retries: int = 3,
        timeout_seconds: int = 30,
    ) -> None:
        key = api_key.strip()
        if not key:
            raise ValueError("GEMINI_API_KEY is required")
        self.api_key = key
        self.model = model.strip() or MODEL
        self.confidence_threshold = confidence_threshold
        self.cache_ttl_seconds = cache_ttl_seconds
        self.max_retries = max_retries
        self.timeout_seconds = timeout_seconds

        # In-memory deduplication cache: hash -> (result_dict, expires_at_timestamp)
        self._cache: Dict[str, Tuple[Dict[str, Any], float]] = {}

        if not examples_path.is_file():
            raise FileNotFoundError(f"Examples file not found at: {examples_path}")
        self.examples: List[Dict[str, Any]] = json.loads(examples_path.read_text(encoding="utf-8"))

    @classmethod
    def from_environment(cls) -> "GeminiNewsClassifier":
        """Instantiate classifier from environment variables."""
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        model = os.environ.get("GEMINI_MODEL", MODEL).strip()
        threshold = float(os.environ.get("CLASSIFIER_CONFIDENCE_THRESHOLD", DEFAULT_CONFIDENCE_THRESHOLD))
        cache_ttl = int(os.environ.get("CLASSIFIER_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS))
        max_retries = int(os.environ.get("GEMINI_MAX_RETRIES", 3))
        timeout = int(os.environ.get("GEMINI_TIMEOUT_SECONDS", 30))
        return cls(
            api_key=api_key,
            model=model,
            confidence_threshold=threshold,
            cache_ttl_seconds=cache_ttl,
            max_retries=max_retries,
            timeout_seconds=timeout,
        )

    def classify(
        self,
        title: str,
        description: str = "",
        article_id: Optional[str] = None,
    ) -> ClassificationResult:
        """Classify a single financial article into sentiment, importance, and confidence.

        Args:
            title: Headline or article title.
            description: Context or summary text.
            article_id: Optional custom identifier. Defaults to SHA-256 hash.

        Returns:
            Structured dictionary with sentiment, importance, confidence, and review_required flag.
        """
        compact_title = self._compact(title)
        compact_desc = self._compact(description)

        if not compact_title and not compact_desc:
            raise ValueError("title or description is required for classification")

        resolved_id = article_id or self._generate_id(compact_title, compact_desc)

        # 1. Deduplication Cache Check
        cache_key = self._generate_id(compact_title, compact_desc)
        now = time.time()
        if self.cache_ttl_seconds > 0 and cache_key in self._cache:
            cached_data, expires_at = self._cache[cache_key]
            if now < expires_at:
                result_copy = dict(cached_data)
                result_copy["article_id"] = resolved_id
                result_copy["cached"] = True
                return result_copy  # type: ignore[return-value]
            del self._cache[cache_key]

        # 2. Build Prompt & Strict Schema
        prompt_text = self._build_prompt(resolved_id, compact_title, compact_desc)
        schema = {
            "type": "object",
            "properties": {
                "article_id": {"type": "string"},
                "sentiment": {"type": "string", "enum": list(SENTIMENTS)},
                "importance": {"type": "string", "enum": list(IMPORTANCE)},
                "confidence": {"type": "number"},
            },
            "required": ["article_id", "sentiment", "importance", "confidence"],
        }
        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema,
                "temperature": 0,
                "maxOutputTokens": 180,
            },
        }

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?"
            + urlencode({"key": self.api_key})
        )
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        # 3. Call Gemini with retry & exponential backoff
        response_data = self._call_with_retry(request)

        # 4. Extract and validate structured payload
        candidate = response_data.get("candidates", [{}])[0]
        parts = candidate.get("content", {}).get("parts", [])
        text = "".join(str(part.get("text", "")) for part in parts)
        if not text:
            raise RuntimeError("Empty response received from Gemini API")

        parsed = json.loads(text)
        sentiment = parsed.get("sentiment")
        importance = parsed.get("importance")
        confidence_val = parsed.get("confidence")

        if sentiment not in SENTIMENTS:
            raise ValueError(f"Invalid sentiment received from model: {sentiment}")
        if importance not in IMPORTANCE:
            raise ValueError(f"Invalid importance received from model: {importance}")
        if not isinstance(confidence_val, (int, float)):
            confidence_val = 0.5
        confidence = max(0.0, min(1.0, float(confidence_val)))

        review_required = confidence < self.confidence_threshold

        result: ClassificationResult = {
            "article_id": str(parsed.get("article_id") or resolved_id),
            "sentiment": sentiment,
            "importance": importance,
            "confidence": round(confidence, 4),
            "review_required": review_required,
            "model": self.model,
            "prompt_version": PROMPT_VERSION,
            "cached": False,
        }

        # 5. Populate cache
        if self.cache_ttl_seconds > 0:
            self._cache[cache_key] = (result, now + self.cache_ttl_seconds)
            if len(self._cache) > 10000:
                first_k = next(iter(self._cache))
                del self._cache[first_k]

        return result

    def classify_batch(
        self,
        articles: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Classify a list of articles sequentially."""
        start_time = time.time()
        results: List[ClassificationResult] = []
        review_count = 0

        for item in articles:
            res = self.classify(
                title=item.get("title", ""),
                description=item.get("description", ""),
                article_id=item.get("article_id"),
            )
            if res["review_required"]:
                review_count += 1
            results.append(res)

        return {
            "results": results,
            "total": len(results),
            "review_count": review_count,
            "duration_ms": round((time.time() - start_time) * 1000, 2),
        }

    def health_check(self) -> Dict[str, Any]:
        """Return readiness and diagnostic status."""
        return {
            "status": "ready" if bool(self.api_key) else "missing_api_key",
            "version": "V.4",
            "prompt_version": PROMPT_VERSION,
            "model": self.model,
            "examples_count": len(self.examples),
            "cached_entries": len(self._cache),
            "confidence_threshold": self.confidence_threshold,
        }

    def _build_prompt(self, article_id: str, title: str, description: str) -> str:
        article = {"article_id": article_id, "title": title, "description": description}
        examples_str = json.dumps(self.examples, ensure_ascii=False, separators=(",", ":"))
        article_str = json.dumps(article, ensure_ascii=False, separators=(",", ":"))

        return f"""Classify expected financial-market impact within 1–5 trading days.
BULLISH supports assets/sector/market; BEARISH harms them; NEUTRAL is unclear,
balanced, or not financially material. HIGH is broad market, central bank, major
policy, major company, or crisis; MEDIUM is sector/several-company impact; LOW is
limited or unclear impact. Use supplied text only. Return JSON only.

Labeled examples:
{examples_str}
Article:
{article_str}"""

    def _call_with_retry(self, request: Request) -> Dict[str, Any]:
        for attempt in range(self.max_retries + 1):
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    return json.load(response)
            except HTTPError as error:
                is_retryable = error.code in {429, 500, 502, 503, 504}
                if not is_retryable or attempt == self.max_retries:
                    raise
                # Exponential backoff with jitter
                delay = (1.5 * (2**attempt)) + random.uniform(0.1, 0.5)
                time.sleep(delay)
            except Exception:
                if attempt == self.max_retries:
                    raise
                time.sleep(1.5 * (2**attempt))
        raise RuntimeError("Retry loop exhausted unexpectedly")

    @staticmethod
    def _compact(value: Optional[str]) -> str:
        return " ".join(str(value or "").split())[:1200]

    @staticmethod
    def _generate_id(title: str, description: str) -> str:
        digest = hashlib.sha256(f"{title}|{description}".encode("utf-8")).hexdigest()
        return f"sha256:{digest}"
