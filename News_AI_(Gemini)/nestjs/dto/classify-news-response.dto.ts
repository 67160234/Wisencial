import { Sentiment, Importance } from '../interfaces/news-classifier.interface';

export class ClassifyNewsResponseDto {
  article_id: string;
  sentiment: Sentiment;
  importance: Importance;
  confidence: number;
  review_required: boolean;
  model: string;
  prompt_version: string;
  cached?: boolean;
}

export class BatchClassifyNewsResponseDto {
  results: ClassifyNewsResponseDto[];
  total: number;
  review_count: number;
  duration_ms: number;
}
