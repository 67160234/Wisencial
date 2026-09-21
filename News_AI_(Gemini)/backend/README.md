# Gemini News Classifier (V.4) — Python Microservice & Reference

Standalone microservice and reference implementation using the **V.4 Gemini Few-Shot Classifier** (9 balanced $3 \times 3$ examples).

---

## 2 Ways to Run

### Mode A: Standalone Microservice (FastAPI + Docker)

#### Quick Run with Docker
```bash
# Build container
docker build -t wisenancial-news-classifier:v4 .

# Run container
docker run -p 8000:8000 \
  -e GEMINI_API_KEY="your-gemini-api-key" \
  -e GEMINI_MODEL="gemini-flash-lite-latest" \
  wisenancial-news-classifier:v4
```

Or with `docker-compose`:
```bash
docker-compose up -d
```

#### Run Locally with Python (venv)
```bash
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
pip install -r requirements.txt

export GEMINI_API_KEY="your-gemini-api-key"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI Swagger UI is available at: `http://localhost:8000/docs`

---

### Mode B: Direct Python Class Import (Zero Dependencies)

If you are importing directly into an existing Python service or script, `gemini_news_classifier.py` relies **only on Python's standard library** (no pip packages required):

```python
from gemini_news_classifier import GeminiNewsClassifier

classifier = GeminiNewsClassifier.from_environment()

result = classifier.classify(
    title="Fed signals potential rate cuts as inflation moderates",
    description="Markets gained across equities and precious metals following policy statement.",
)

print(result)
# Output:
# {
#   "article_id": "sha256:7a9f...",
#   "sentiment": "BULLISH",
#   "importance": "HIGH",
#   "confidence": 0.92,
#   "review_required": false,
#   "model": "gemini-flash-lite-latest",
#   "prompt_version": "financial-news-fewshot-v4-sim"
# }
```

---

## Running Tests

```bash
# Using Python standard unittest:
python -m unittest test_classifier.py

# Or using pytest:
pytest test_classifier.py -v
```

---

## Production Features

- **Prompt V.4**: 9 balanced examples covering all combinations (`BULLISH | BEARISH | NEUTRAL` $\times$ `HIGH | MEDIUM | LOW`).
- **Resilience**: Exponential backoff with jitter on HTTP 429 and 5xx errors.
- **Cost Reduction**: SHA-256 caching deduplicates repeated news queries.
- **Review Flag**: `review_required: true` when `confidence < 0.80`.
