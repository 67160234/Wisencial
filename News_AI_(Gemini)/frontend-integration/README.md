# Frontend Integration Guide (Quasar / Vue 3 / Pinia)

How to integrate the Gemini V.4 News Classifier results into the Wisenancial web app.

---

## 1. Using the Pinia Store

Copy `news-classifier.store.ts` to `src/stores/news-classifier.store.ts`:

```typescript
import { useNewsClassifierStore } from '@/stores/news-classifier.store';

const classifierStore = useNewsClassifierStore();

// Classify single article
async function onArticleLoaded(article: { title: string; description: string }) {
  const result = await classifierStore.classifyNews({
    title: article.title,
    description: article.description,
  });

  console.log('Sentiment:', result.sentiment);       // 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  console.log('Importance:', result.importance);     // 'HIGH' | 'MEDIUM' | 'LOW'
  console.log('Needs Review:', result.review_required); // true if confidence < 0.80
}
```

---

## 2. Using the Vue Impact Badge Component

Copy `NewsImpactBadge.vue` to `src/components/news/NewsImpactBadge.vue`:

```vue
<template>
  <div class="news-card">
    <h3>{{ article.title }}</h3>
    <p>{{ article.description }}</p>

    <!-- Visual AI Impact Badges -->
    <NewsImpactBadge
      :sentiment="article.ai_sentiment"
      :importance="article.ai_importance"
      :confidence="article.ai_confidence"
      :review-required="article.ai_review_required"
    />
  </div>
</template>

<script setup lang="ts">
import NewsImpactBadge from '@/components/news/NewsImpactBadge.vue';

defineProps<{
  article: {
    title: string;
    description: string;
    ai_sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    ai_importance: 'HIGH' | 'MEDIUM' | 'LOW';
    ai_confidence: number;
    ai_review_required: boolean;
  };
}>();
</script>
```

---

## 3. UI Guidelines

| Value | Visual Color | Interpretation |
|---|---|---|
| **BULLISH** | Emerald Green (`#10B981`) | Positive market reaction expected within 1–5 days |
| **BEARISH** | Crimson Red (`#EF4444`) | Negative market reaction expected within 1–5 days |
| **NEUTRAL** | Slate Gray (`#94A3B8`) | Unclear or no directional financial impact |
| **HIGH** | Amber/Orange (`#F59E0B`) | Macro policy, central bank, systemic market mover |
| **MEDIUM** | Blue (`#3B82F6`) | Sector or multi-company impact |
| **LOW** | Slate (`#64748B`) | Minor company or isolated news |
| **Review Tag** | Yellow Pill | Confidence < 80% — Recommend human review |
