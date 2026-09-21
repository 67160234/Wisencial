export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type Importance = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FewShotExample {
  article_id?: string;
  title: string;
  description: string;
  label: {
    sentiment: Sentiment;
    importance: Importance;
  };
  selection?: string;
}

export interface ClassifyNewsPayload {
  article_id?: string;
  title: string;
  description?: string;
}

export interface ClassifyNewsResult {
  article_id: string;
  sentiment: Sentiment;
  importance: Importance;
  confidence: number;
  review_required: boolean;
  model: string;
  prompt_version: string;
  cached?: boolean;
}

export interface BatchClassifyNewsResult {
  results: ClassifyNewsResult[];
  total: number;
  review_count: number;
  duration_ms: number;
}
