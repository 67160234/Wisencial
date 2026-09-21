# NestJS News Classifier Module (V.4) — Drop-in Guide

Production-ready NestJS module powered by **Google Gemini V.4 Few-Shot Classifier** (9 balanced $3 \times 3$ examples).

---

## 3-Step Quick Integration

### Step 1: Copy module folder
Copy this entire `nestjs/` directory into your NestJS backend:
```bash
# From the root of your NestJS backend repo:
cp -r path/to/Handoff\ Coding/nestjs ./src/modules/news-classifier
```

### Step 2: Register in `AppModule`
Import `NewsClassifierModule` into `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { NewsClassifierModule } from './modules/news-classifier/news-classifier.module';

@Module({
  imports: [
    // ... your existing modules
    NewsClassifierModule,
  ],
})
export class AppModule {}
```

### Step 3: Configure Environment Variables
Ensure `GEMINI_API_KEY` is present in your backend `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-flash-lite-latest
CLASSIFIER_CONFIDENCE_THRESHOLD=0.80
CLASSIFIER_CACHE_TTL_SECONDS=86400
```

That's it! The endpoints are now active.

---

## API Endpoints

### 1. Classify Single News
- **Endpoint**: `POST /ai/news/classify`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "title": "Fed leaves interest rates unchanged, signals gradual easing later this year",
  "description": "Federal Reserve officials held benchmark rates steady while noting inflation risks have continued to subside."
}
```
- **Response (200 OK)**:
```json
{
  "article_id": "sha256:4b9e28f1b...",
  "sentiment": "BULLISH",
  "importance": "HIGH",
  "confidence": 0.88,
  "review_required": false,
  "model": "gemini-flash-lite-latest",
  "prompt_version": "financial-news-fewshot-v4-sim"
}
```

> **Review Queue**: If `confidence < 0.80`, `review_required` will be `true`. Your frontend or background cron can route these articles to a manual review queue.

---

### 2. Batch Classification
- **Endpoint**: `POST /ai/news/classify-batch`
- **Request Body**:
```json
{
  "articles": [
    { "title": "Headline 1", "description": "Details 1" },
    { "title": "Headline 2", "description": "Details 2" }
  ]
}
```
- **Response (200 OK)**:
```json
{
  "results": [ ... ],
  "total": 2,
  "review_count": 0,
  "duration_ms": 1420
}
```

---

### 3. Health & Readiness Probe
- **Endpoint**: `GET /ai/news/health`
- **Response (200 OK)**:
```json
{
  "status": "ready",
  "version": "V.4",
  "prompt_version": "financial-news-fewshot-v4-sim",
  "model": "gemini-flash-lite-latest",
  "examples_count": 9,
  "cached_entries": 42,
  "confidence_threshold": 0.8
}
```

---

## Direct Service Injection (Internal Use)

If your existing cron job (e.g. `news-enrichment.service.ts`) needs to classify articles without making HTTP calls, simply inject `NewsClassifierService`:

```typescript
import { Injectable } from '@nestjs/common';
import { NewsClassifierService } from './modules/news-classifier/news-classifier.service';

@Injectable()
export class NewsEnrichmentService {
  constructor(private readonly classifier: NewsClassifierService) {}

  async enrich(article: { title: string; description: string }) {
    const aiResult = await this.classifier.classify({
      title: article.title,
      description: article.description,
    });

    // Save to PostgreSQL / Prisma
    // sentiment: aiResult.sentiment
    // importance: aiResult.importance
    // confidence: aiResult.confidence
    // review_required: aiResult.review_required
  }
}
```

---

## Production Safeguards Included

1. **SHA-256 Deduplication Cache**: Identical news requests are served in 0ms from cache without calling the Gemini API, preventing duplicated costs.
2. **Auto-Retry & Jitter**: Automatically retries 429 (rate limits) and 5xx (Google provider hiccups) with exponential backoff.
3. **Input Sanitization & Length Guard**: Truncates inputs to safe 1200 characters and strips excessive whitespace to protect against prompt injection and token overflow.
4. **Structured JSON Schema**: Enforces Gemini output strictly using `responseMimeType: 'application/json'` and `responseJsonSchema`.
