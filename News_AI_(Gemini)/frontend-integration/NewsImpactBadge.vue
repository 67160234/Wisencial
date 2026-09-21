<template>
  <div class="news-impact-container" :class="{ 'compact-mode': compact }">
    <!-- Sentiment Badge -->
    <span
      class="impact-badge sentiment-badge"
      :class="sentimentClass"
      :title="`Sentiment: ${sentiment}`"
    >
      <span class="badge-icon">{{ sentimentIcon }}</span>
      <span class="badge-label">{{ sentimentText }}</span>
    </span>

    <!-- Importance Badge -->
    <span
      class="impact-badge importance-badge"
      :class="importanceClass"
      :title="`Impact Importance: ${importance}`"
    >
      <span class="badge-label">{{ importanceText }}</span>
    </span>

    <!-- Confidence & Review Flag -->
    <span
      v-if="showConfidence"
      class="impact-badge confidence-badge"
      :class="{ 'review-needed': reviewRequired }"
      :title="reviewRequired ? 'AI Confidence < 80% — Human review recommended' : 'High AI Confidence'"
    >
      <span class="confidence-val">{{ Math.round(confidence * 100) }}%</span>
      <span v-if="reviewRequired" class="review-tag">Review</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    importance: 'HIGH' | 'MEDIUM' | 'LOW';
    confidence?: number;
    reviewRequired?: boolean;
    compact?: boolean;
    showConfidence?: boolean;
  }>(),
  {
    confidence: 0.85,
    reviewRequired: false,
    compact: false,
    showConfidence: true,
  }
);

const sentimentClass = computed(() => {
  switch (props.sentiment) {
    case 'BULLISH':
      return 'sentiment-bullish';
    case 'BEARISH':
      return 'sentiment-bearish';
    default:
      return 'sentiment-neutral';
  }
});

const sentimentIcon = computed(() => {
  switch (props.sentiment) {
    case 'BULLISH':
      return '▲';
    case 'BEARISH':
      return '▼';
    default:
      return '●';
  }
});

const sentimentText = computed(() => {
  return props.sentiment;
});

const importanceClass = computed(() => {
  switch (props.importance) {
    case 'HIGH':
      return 'importance-high';
    case 'MEDIUM':
      return 'importance-medium';
    default:
      return 'importance-low';
  }
});

const importanceText = computed(() => {
  return `${props.importance} IMPACT`;
});
</script>

<style scoped>
.news-impact-container {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.impact-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1.2;
}

/* Sentiment Styles */
.sentiment-bullish {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.sentiment-bearish {
  background-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.sentiment-neutral {
  background-color: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

/* Importance Styles */
.importance-high {
  background-color: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.importance-medium {
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.importance-low {
  background-color: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

/* Confidence & Review */
.confidence-badge {
  background-color: rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 10px;
}

.confidence-badge.review-needed {
  background-color: rgba(234, 179, 8, 0.15);
  color: #eab308;
  border: 1px solid rgba(234, 179, 8, 0.4);
}

.review-tag {
  background-color: #eab308;
  color: #0f172a;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  margin-left: 2px;
}

.compact-mode .impact-badge {
  padding: 2px 5px;
  font-size: 10px;
}
</style>
