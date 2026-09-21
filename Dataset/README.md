# Wisenancial — News Dataset Documentation

> **โปรเจกต์:** Wisenancial Financial News Classifier  
> **ข้อมูลนี้ใช้ใน:** Model Store V.4 (Gemini Few-Shot 3x3 Balanced Matrix)  
> **อัปเดตล่าสุด:** 2026-09-21  

---

## 1. โครงสร้างโฟลเดอร์

```text
Dataset/
├── README.md                     # ไฟล์นี้ — เอกสารอธิบายทุกไฟล์ใน Dataset
│
├── news-api-raw/                 # ข้อมูลดิบจาก NewsAPI (ต้นทาง)
│   └── Raw_dataset/
│       ├── batch_20260917_074521.jsonl
│       ├── batch_20260917_075112_page1.jsonl
│       ├── batch_20260917_075356_page1.jsonl
│       ├── batch_20260917_075703_page1.jsonl
│       ├── batch_20260917_084513_page1.jsonl
│       ├── batch_20260917_084711_page1.jsonl
│       ├── batch_20260917_085321_page1.jsonl
│       └── (*.manifest.json สำหรับแต่ละ batch)
│
├── Train/                        # ข้อมูลสำหรับฝึกโมเดล (70%)
│   ├── Label/                    # (ว่าง — รอ human review จริง)
│   └── News/
│       ├── manifest.json
│       ├── news.jsonl                      # บทความดิบ (235 รายการ)
│       ├── news.prelabel.jsonl             # AI pre-label (V.1, ไม่ใช้ใน V.4)
│       ├── news.prelabel.errors.jsonl      # pre-label ที่ล้มเหลว
│       └── news.human-review-sim.jsonl     # *** ใช้ใน V.4 (Ground Truth)
│
├── Valid/                        # ข้อมูลสำหรับ validation (15%)
│   ├── Label/                    # (ว่าง — รอ human review จริง)
│   └── News/
│       ├── manifest.json
│       ├── news.jsonl                      # บทความดิบ (51 รายการ)
│       ├── news.prelabel.jsonl             # AI pre-label (V.1, ไม่ใช้ใน V.4)
│       ├── news.prelabel.errors.jsonl      # pre-label ที่ล้มเหลว
│       ├── news.human-review-sim.jsonl     # *** ใช้ใน V.4 (Ground Truth)
│       └── news.gemini-eval.jsonl          # *** ใช้ใน V.4 (Evaluation Output)
│
└── Test/                         # ข้อมูลสำหรับ test (15%)
    ├── Label/                    # (ว่าง — รอ human review จริง)
    └── News/
        ├── manifest.json
        ├── news.jsonl                      # บทความดิบ (50 รายการ)
        ├── news.prelabel.jsonl             # AI pre-label (V.1, ไม่ใช้ใน V.4)
        ├── news.prelabel.errors.jsonl      # pre-label ที่ล้มเหลว
        └── news.human-review-sim.jsonl     # *** ใช้ใน V.4 (Ground Truth)
```

---

## 2. ไฟล์ที่ใช้ใน Model V.4

| ไฟล์ | โฟลเดอร์ | บทบาทใน V.4 | ใช้หรือไม่ |
|------|----------|------------|------------|
| `news.human-review-sim.jsonl` | Train/News/ | Label source — ground truth สำหรับเลือก 9 few-shot examples ที่สมดุล (3x3) | ✅ ใช้ |
| `news.human-review-sim.jsonl` | Valid/News/ | Validation set — ใช้วัดประสิทธิภาพของโมเดล | ✅ ใช้ |
| `news.human-review-sim.jsonl` | Test/News/ | Test set — ใช้วัดประสิทธิภาพสุดท้าย (held-out) | ✅ ใช้ |
| `news.gemini-eval.jsonl` | Valid/News/ | Evaluation output — ผล predict ของ V.4 บน valid set สำหรับคำนวณ accuracy/F1 | ✅ ใช้ |
| `news.jsonl` | ทุก split | บทความดิบก่อน pre-label | ข้อมูลต้นทาง |
| `news.prelabel.jsonl` | ทุก split | AI pre-label เวอร์ชัน V.1 (unbalanced) | ไม่ได้ใช้ใน V.4 |
| `news.prelabel.errors.jsonl` | ทุก split | บทความที่ API ล้มเหลว | ไม่ได้ใช้ใน V.4 |
| `news-api-raw/Raw_dataset/*.jsonl` | news-api-raw/ | batch ดิบจาก NewsAPI ก่อน split | ข้อมูลต้นทาง |

---

## 3. อธิบายแต่ละไฟล์

### 3.1 `news.jsonl` — บทความดิบ

บทความข่าวจาก NewsAPI แต่ละบรรทัดคือ 1 บทความ (JSON Lines format)

```json
{
  "article_id": "sha256:...",
  "title": "...",
  "description": "...",
  "content": "...",
  "source_name": "BusinessLine",
  "published_at": "2026-09-16T08:14:41Z",
  "category": "finance",
  "status": "ready_for_label"
}
```

---

### 3.2 `news.prelabel.jsonl` — AI Pre-label (V.1, ไม่ใช้ใน V.4)

ป้ายกำกับจาก gemini-flash-lite-latest ด้วย prompt V.1 (ไม่มี few-shot ที่สมดุล)  
ไม่ได้ใช้ใน V.4 เนื่องจาก class coverage ไม่ครบ 3x3 matrix

```json
{
  "article_id": "sha256:...",
  "ai_prelabel": {
    "sentiment": "BULLISH",
    "importance": "MEDIUM",
    "confidence": 0.75
  },
  "prompt_version": "financial-news-prelabel-v1"
}
```

---

### 3.3 *** `news.human-review-sim.jsonl` — Ground Truth ที่ใช้ใน V.4

ไฟล์นี้คือ **label หลัก** สำหรับ Model Store V.4  
สร้างโดยนำ AI pre-label V.1 ผ่านกระบวนการ human review simulation  
Policy: "V4: preserve semantic AI pre-label; balance few-shot example selection, not article labels."

```json
{
  "article_id": "sha256:...",
  "ai_prelabel": { "sentiment": "BEARISH", "importance": "MEDIUM", "confidence": 0.75 },
  "human_review_sim": { "sentiment": "BEARISH", "importance": "MEDIUM", "confidence": 0.75 },
  "label_source": "human_review_sim_from_ai_prelabel",
  "review_status": "simulated",
  "simulated_review_policy": "V4: preserve semantic AI pre-label; balance few-shot example selection, not article labels."
}
```

ทำไมถึงใช้ไฟล์นี้ใน V.4:
- เป็น label ที่ผ่านการ review แล้ว (simulated human review)
- ใช้เป็น ground truth สำหรับเลือก 9 ตัวอย่าง few-shot ที่ครอบคลุมทุก class (BULLISH/BEARISH/NEUTRAL x HIGH/MEDIUM/LOW)
- เป็นอ้างอิงสำหรับคำนวณ validation accuracy / F1-score ของ V.4

---

### 3.4 *** `news.gemini-eval.jsonl` — ผลการ Evaluate V.4 (เฉพาะ Valid/)

มีเฉพาะใน Valid/News/ เท่านั้น  
บันทึกผล predict ของ V.4 few-shot classifier บน validation set

```json
{
  "article_id": "sha256:...",
  "gemini_prediction": {
    "sentiment": "BULLISH",
    "importance": "MEDIUM",
    "confidence": 0.9
  },
  "model": "gemini-flash-lite-latest",
  "prompt_version": "financial-news-fewshot-v1",
  "examples_per_sentiment": 3
}
```

V.4 Evaluation Results (Valid set, 51 รายการ):

| Metric | ผลลัพธ์ |
|--------|---------|
| Sentiment Accuracy | 94.12% |
| Sentiment Macro F1 | 0.9385 |
| Importance Accuracy | 88.24% |
| Importance Macro F1 | 0.8499 |

---

### 3.5 `news.prelabel.errors.jsonl` — Pre-label ที่ล้มเหลว

บทความที่ API ล้มเหลวระหว่าง pre-label (timeout, rate limit, invalid response)  
ไม่ได้ใช้ใน V.4

---

### 3.6 `news-api-raw/Raw_dataset/` — batch ดิบจาก NewsAPI

7 batch ที่เก็บมาวันที่ 17 กันยายน 2026  
แต่ละ batch มีไฟล์ .jsonl และ .manifest.json คู่กัน  
เป็นต้นทางที่นำมา deduplicate และ split ด้วย seed wisenancial-newsapi-split-v1

---

## 4. Dataset Split Summary

| Split | โฟลเดอร์ | จำนวนรายการ | สัดส่วน | บทบาท |
|-------|----------|------------|---------|-------|
| Train | Train/News/ | 235 | 70% | ฝึกโมเดล / เลือก few-shot examples |
| Valid | Valid/News/ | 51 | 15% | ปรับพารามิเตอร์ / วัด V.4 accuracy |
| Test | Test/News/ | 50 | 15% | วัดประสิทธิภาพสุดท้าย (held-out) |
| รวม | — | 336 | 100% | — |

Split seed: wisenancial-newsapi-split-v1 (reproducible)

---

## 5. Pipeline ของข้อมูล

```
NewsAPI Raw Batches (news-api-raw/Raw_dataset/)
         |
         v  deduplicate + filter (status=ready_for_label)
         |
    Split (70/15/15)   seed: wisenancial-newsapi-split-v1
    /          |         \
Train/(235)  Valid/(51)  Test/(50)
    |          |         |
    v  AI Pre-label (gemini-flash-lite, prompt v1)
news.prelabel.jsonl
    |
    v  Human Review Simulation (V4 policy)
news.human-review-sim.jsonl   <-- *** ใช้ใน V.4 (Ground Truth)
    |
    v  V.4 Few-Shot Evaluation (Valid only)
news.gemini-eval.jsonl        <-- *** ใช้ใน V.4 (Evaluation Output)
```

---

## 6. หมายเหตุสำคัญ

ไฟล์ที่ใช้ใน V.4 มีเพียง:
- news.human-review-sim.jsonl (ทุก split — Train, Valid, Test)
- news.gemini-eval.jsonl (Valid เท่านั้น)

ไฟล์อื่น ๆ เป็นข้อมูลกระบวนการ (pipeline artifacts) หรือข้อมูลต้นทาง

โฟลเดอร์ Label/ ใน Train/, Valid/, Test/ ยังว่างอยู่  
รอ human review จริงในอนาคต  
ปัจจุบัน V.4 ใช้ simulated human review ซึ่งคงค่า AI pre-label ไว้ และเน้นความสมดุลในการเลือก few-shot examples

ต้องการรู้ผลลัพธ์ของ V.4 เพิ่มเติม ดูที่ Model Store/V.4/model-manifest.json
