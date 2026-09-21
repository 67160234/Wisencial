import { defineStore } from 'pinia';
import axios from 'axios';

export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type Importance = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ClassifyResult {
  article_id: string;
  sentiment: Sentiment;
  importance: Importance;
  confidence: number;
  review_required: boolean;
  model: string;
  prompt_version: string;
  cached?: boolean;
}

export interface NewsClassifierState {
  loading: boolean;
  error: string | null;
  history: Record<string, ClassifyResult>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useNewsClassifierStore = defineStore('newsClassifier', {
  state: (): NewsClassifierState => ({
    loading: false,
    error: null,
    history: {},
  }),

  getters: {
    getResultById: (state) => (id: string): ClassifyResult | undefined => {
      return state.history[id];
    },
  },

  actions: {
    /**
     * Classify an article via backend API
     */
    async classifyNews(payload: { title: string; description?: string; article_id?: string }): Promise<ClassifyResult> {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post<ClassifyResult>(
          `${API_BASE_URL}/ai/news/classify`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 35000,
          }
        );

        const result = response.data;
        if (result.article_id) {
          this.history[result.article_id] = result;
        }
        return result;
      } catch (err: any) {
        const message = err.response?.data?.message || err.message || 'Failed to classify news article';
        this.error = message;
        throw new Error(message);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Batch classify multiple articles
     */
    async classifyBatch(articles: Array<{ title: string; description?: string; article_id?: string }>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post(
          `${API_BASE_URL}/ai/news/classify-batch`,
          { articles },
          { timeout: 60000 }
        );
        const { results } = response.data;
        for (const res of results) {
          if (res.article_id) {
            this.history[res.article_id] = res;
          }
        }
        return response.data;
      } catch (err: any) {
        this.error = err.response?.data?.message || err.message || 'Batch classification failed';
        throw err;
      } finally {
        this.loading = false;
      }
    },
  },
});
