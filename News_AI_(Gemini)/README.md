# Gemini News Classifier — Fullstack Handoff (Model Store V.4)

> **Status:** Production-Ready Handoff for Public Web Integration  
> **Model Version:** `V.4` (Gemini Flash Few-Shot with 3×3 Balanced Matrix)  
> **Target Stacks:** NestJS / TypeScript (Primary Backend) & FastAPI / Docker (Standalone Microservice) + Quasar / Vue 3 (Frontend)

---

## 1. Overview & What Changed from V.1 to V.4

| Feature / Metric | V.1 (Deprecated) | V.4 (Current Handoff) |
|---|---|---|
| **Example Selection** | 10 unbalanced AI pre-label examples | **9 balanced examples** covering all 9 pairs ($3 \times 3$ grid) |
| **Class Coverage** | Incomplete importance $\times$ sentiment pairs | Complete coverage: `BULLISH/BEARISH/NEUTRAL` $\times$ `HIGH/MEDIUM/LOW` |
| **Validation Accuracy** | Baseline (~82% uncalibrated) | **Sentiment: 94.12% (Macro F1: 0.9385) \| Importance: 88.24% (Macro F1: 0.8499)** |
| **Test Set Performance**| Unverified | **Sentiment: 78.00% \| Importance: 76.00%** |
| **Fullstack Packaging** | Raw Python script only | **Native NestJS drop-in module + FastAPI Docker service + Vue 3 UI badges** |
| **API Cost Guard** | None (100% duplicate API calls) | **SHA-256 in-memory deduplication cache (0ms instant response on cache hit)** |
| **Public Safeguards** | None | **Rate-limit exponential retry, token budget ceiling, review flag `< 0.80`** |

---

## 2. Directory Structure

```text
Handoff Coding/
├── README.md                      # Master handoff documentation (this file)
├── .env.example                   # Master environment variables template
├── gitignore.additions            # Production gitignore guidelines
├── model-manifest.json            # V.4 Model metadata, schema, and metrics
├── fewshot_examples.json          # V.4 9-example balanced few-shot dataset
│
├── nestjs/                        # ⭐ PRIMARY: Drop-in module for NestJS backend
│   ├── README.md                  # 3-step NestJS installation guide
│   ├── news-classifier.module.ts  # NestJS module definition
│   ├── news-classifier.controller.ts # REST endpoints (/ai/news/classify, /classify-batch, /health)
│   ├── news-classifier.service.ts # Core service with caching, retry, confidence threshold
│   ├── news-classifier.service.spec.ts # Unit tests with mocked Gemini calls
│   ├── dto/                       # class-validator DTOs with length guards
│   │   ├── classify-news.dto.ts
│   │   ├── classify-batch-news.dto.ts
│   │   └── classify-news-response.dto.ts
│   ├── interfaces/
│   │   └── news-classifier.interface.ts # TypeScript types & enums
│   └── fewshot_examples.json      # Self-contained V.4 dataset copy
│
├── backend/                       # ⭐ ALTERNATIVE: Standalone Python Microservice & Docker
│   ├── README.md                  # Docker & local run guide
│   ├── gemini_news_classifier.py  # Pure stdlib Python V.4 classifier class
│   ├── main.py                    # FastAPI web server with Swagger docs (/docs)
│   ├── Dockerfile                 # Production minimal container (non-root user)
│   ├── docker-compose.yml         # Container orchestration configuration
│   ├── requirements.txt           # Minimal web dependencies
│   ├── test_classifier.py         # Unit test suite (unittest / pytest)
│   └── fewshot_examples.json      # V.4 dataset copy
│
└── frontend-integration/          # ⭐ UI: Frontend Components & Stores
    ├── README.md                  # Frontend integration instructions
    ├── news-classifier.store.ts   # Pinia store matching Wisenancial conventions
    └── NewsImpactBadge.vue        # Quasar/Vue 3 badge component (Bullish/Bearish/Review)
```

---

## 3. Quick Start for Fullstack Web Integration

### Option A: Integrate into NestJS Backend (Recommended — 3 Minutes)

Since Wisenancial uses NestJS for its backend, this is the most seamless integration path:

1. **Copy Module**: Copy the folder `nestjs/` into your NestJS project:
   ```bash
   cp -r "Handoff Coding/nestjs" "<path-to-backend>/src/modules/news-classifier"
   ```
2. **Register Module**: Add `NewsClassifierModule` to your `src/app.module.ts`:
   ```typescript
   import { NewsClassifierModule } from './modules/news-classifier/news-classifier.module';

   @Module({
     imports: [
       // ... other modules
       NewsClassifierModule,
     ],
   })
   export class AppModule {}
   ```
3. **Set Secret**: Add `GEMINI_API_KEY` to your backend `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-flash-lite-latest
   CLASSIFIER_CONFIDENCE_THRESHOLD=0.80
   ```

### Option B: Deploy as Independent Microservice (Docker / Cloud Run)

If your architecture isolates AI workloads:
```bash
cd "Handoff Coding/backend"
docker build -t wisenancial-news-classifier:v4 .
docker run -d -p 8000:8000 -e GEMINI_API_KEY="your-key" wisenancial-news-classifier:v4
```

---

## 4. HTTP API Contract

### Endpoint 1: Classify Single News
- **Path**: `POST /ai/news/classify`
- **Request Body**:
```json
{
  "title": "Fed leaves interest rates unchanged, signals gradual easing later this year",
  "description": "Federal Reserve officials held benchmark rates steady while noting inflation risks have subsided."
}
```
- **Response (200 OK)**:
```json
{
  "article_id": "sha256:4b9e28f1b3e8c201...",
  "sentiment": "BULLISH",
  "importance": "HIGH",
  "confidence": 0.88,
  "review_required": false,
  "model": "gemini-flash-lite-latest",
  "prompt_version": "financial-news-fewshot-v4-sim",
  "cached": false
}
```

### Endpoint 2: Batch Classification
- **Path**: `POST /ai/news/classify-batch`
- **Request Body**:
```json
{
  "articles": [
    { "title": "Headline 1", "description": "Context 1" },
    { "title": "Headline 2", "description": "Context 2" }
  ]
}
```
- **Response (200 OK)**:
```json
{
  "results": [ ... ],
  "total": 2,
  "review_count": 0,
  "duration_ms": 1350
}
```

### Endpoint 3: Health & Readiness Probe
- **Path**: `GET /ai/news/health`
- **Response (200 OK)**:
```json
{
  "status": "ready",
  "version": "V.4",
  "prompt_version": "financial-news-fewshot-v4-sim",
  "model": "gemini-flash-lite-latest",
  "examples_count": 9,
  "cached_entries": 12,
  "confidence_threshold": 0.8
}
```

---

## 5. Production & Public Readiness Checklist

Before publishing to public production, confirm the following security and reliability controls:

- [x] **Zero Client-Side Key Exposure**: The Gemini API key is strictly stored server-side via `process.env.GEMINI_API_KEY`. Never expose it to Vite or Quasar frontends.
- [x] **Confidence Review Threshold (`review_required: true`)**:
  - Any classification with `confidence < 0.80` is automatically flagged `review_required: true`.
  - Your UI or background worker should route these items to a human editor queue before publishing to high-visibility market feeds.
- [x] **Deduplication Caching**:
  - The service hashes `title + description` into a SHA-256 digest.
  - Subsequent requests for the same news are served instantly from memory (`cached: true`), reducing Gemini API costs and latency to 0ms.
- [x] **Exponential Backoff & Rate-Limit Handling**:
  - HTTP `429` (Rate Limit) and `503` (Transient upstream failure) are automatically retried with randomized jitter ($1.5\text{s} \to 3\text{s} \to 6\text{s}$).
- [x] **Token Budget & Prompt Injection Defense**:
  - Inputs are strictly truncated to 1200 characters and normalized to prevent token overflow.
  - Outputs are constrained using Gemini `maxOutputTokens: 180` and `responseJsonSchema`, guaranteeing clean JSON enums (`BULLISH | BEARISH | NEUTRAL`).
- [x] **Privacy & Logging**:
  - In accordance with production best practices, full article text and API secrets are never dumped to stdout logs.

---

## 6. คำแนะนำสำหรับทีม Fullstack (ภาษาไทย)

1. **ถ้าโปรเจกต์เป็น Monorepo หรือรวมโค้ดใน NestJS หลัก**:
   - ให้เลือก **Option A (`nestjs/`)** โดยคัดลอกโฟลเดอร์ `nestjs/` ไปวางที่ `src/modules/news-classifier` แล้วเพิ่ม `NewsClassifierModule` ใน `app.module.ts`
   - ไม่ต้องติดตั้ง library แปลกปลอมเพิ่ม โค้ดใช้ `fetch` มาตรฐานของ Node.js และ `class-validator` ที่ NestJS มีอยู่แล้ว
2. **ถ้าโปรเจกต์แยก AI เป็น Microservice / Cloud Run**:
   - ให้เลือก **Option B (`backend/`)** สั่ง `docker build` แล้วเอา image ขึ้น Google Cloud Run หรือ AWS ECS ได้ทันที มี Swagger UI อยู่ที่ `/docs`
3. **การนำผลไปแสดงที่หน้าเว็บ (Frontend)**:
   - คัดลอก `NewsImpactBadge.vue` จากโฟลเดอร์ `frontend-integration/` ไปใช้ร่วมกับ Pinia store แสดงสีป้ายแท็ก เขียว (BULLISH), แดง (BEARISH), เทา (NEUTRAL) พร้อมไฟแจ้งเตือน `Review` เมื่อความมั่นใจต่ำกว่า 80%
