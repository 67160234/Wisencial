import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  Sentiment,
  Importance,
  FewShotExample,
  ClassifyNewsPayload,
  ClassifyNewsResult,
  BatchClassifyNewsResult,
} from './interfaces/news-classifier.interface';

const SENTIMENTS: Sentiment[] = ['BULLISH', 'BEARISH', 'NEUTRAL'];
const IMPORTANCE: Importance[] = ['HIGH', 'MEDIUM', 'LOW'];
const PROMPT_VERSION = 'financial-news-fewshot-v4-sim';

interface CacheEntry {
  result: ClassifyNewsResult;
  expiresAt: number;
}

@Injectable()
export class NewsClassifierService {
  private readonly logger = new Logger(NewsClassifierService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly confidenceThreshold: number;
  private readonly cacheTtlMs: number;
  private readonly examples: FewShotExample[];
  private readonly cache = new Map<string, CacheEntry>();

  constructor() {
    this.apiKey = (process.env.GEMINI_API_KEY || '').trim();
    this.model = (process.env.GEMINI_MODEL || 'gemini-flash-lite-latest').trim();
    this.timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10);
    this.maxRetries = parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10);
    this.confidenceThreshold = parseFloat(process.env.CLASSIFIER_CONFIDENCE_THRESHOLD || '0.80');
    this.cacheTtlMs = parseInt(process.env.CLASSIFIER_CACHE_TTL_SECONDS || '86400', 10) * 1000;

    this.examples = this.loadExamples();
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set. AI News classification requests will fail.');
    }
  }

  /**
   * Loads the 9 balanced few-shot examples (V.4).
   */
  private loadExamples(): FewShotExample[] {
    const candidatePaths = [
      path.join(__dirname, 'fewshot_examples.json'),
      path.join(process.cwd(), 'fewshot_examples.json'),
      path.join(__dirname, '..', 'fewshot_examples.json'),
    ];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(raw);
          if (Array.isArray(data) && data.length > 0) {
            return data;
          }
        } catch (err) {
          this.logger.error(`Failed to parse fewshot_examples.json at ${filePath}: ${err.message}`);
        }
      }
    }
    this.logger.error('fewshot_examples.json not found in candidate paths!');
    return [];
  }

  /**
   * Health status for monitoring probes.
   */
  public healthCheck() {
    return {
      status: this.apiKey ? 'ready' : 'missing_api_key',
      version: 'V.4',
      prompt_version: PROMPT_VERSION,
      model: this.model,
      examples_count: this.examples.length,
      cached_entries: this.cache.size,
      confidence_threshold: this.confidenceThreshold,
    };
  }

  /**
   * Classify a single financial news article.
   */
  public async classify(payload: ClassifyNewsPayload): Promise<ClassifyNewsResult> {
    if (!this.apiKey) {
      throw new HttpException('GEMINI_API_KEY is not configured on the server', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const title = this.compact(payload.title);
    const description = this.compact(payload.description || '');

    if (!title && !description) {
      throw new HttpException('Title or description is required for classification', HttpStatus.BAD_REQUEST);
    }

    const articleId = payload.article_id || this.generateArticleId(title, description);

    // 1. Check in-memory deduplication cache
    if (this.cacheTtlMs > 0) {
      const cacheKey = this.generateArticleId(title, description);
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          ...cached.result,
          article_id: articleId,
          cached: true,
        };
      }
    }

    // 2. Build prompt and structured schema
    const prompt = this.buildPrompt(articleId, title, description);
    const schema = {
      type: 'object',
      properties: {
        article_id: { type: 'string' },
        sentiment: { type: 'string', enum: SENTIMENTS },
        importance: { type: 'string', enum: IMPORTANCE },
        confidence: { type: 'number' },
      },
      required: ['article_id', 'sentiment', 'importance', 'confidence'],
    };

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        temperature: 0,
        maxOutputTokens: 180,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    // 3. Call Gemini with retry & exponential backoff
    const responseData = await this.callGeminiWithRetry(url, requestBody);

    // 4. Parse & validate response
    const result = this.parseAndValidate(responseData, articleId);

    // 5. Cache result
    if (this.cacheTtlMs > 0) {
      const cacheKey = this.generateArticleId(title, description);
      this.cache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      // Simple LRU cleanup if cache exceeds 10,000 entries
      if (this.cache.size > 10000) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
    }

    return result;
  }

  /**
   * Batch classification with sequential pacing to respect rate limits.
   */
  public async classifyBatch(articles: ClassifyNewsPayload[]): Promise<BatchClassifyNewsResult> {
    const startTime = Date.now();
    const results: ClassifyNewsResult[] = [];
    let reviewCount = 0;

    for (const article of articles) {
      const res = await this.classify(article);
      if (res.review_required) {
        reviewCount++;
      }
      results.push(res);
    }

    return {
      results,
      total: results.length,
      review_count: reviewCount,
      duration_ms: Date.now() - startTime,
    };
  }

  private buildPrompt(articleId: string, title: string, description: string): string {
    const articleJson = JSON.stringify({
      article_id: articleId,
      title,
      description,
    });

    const examplesJson = JSON.stringify(this.examples);

    return `Classify expected financial-market impact within 1–5 trading days.
BULLISH supports assets/sector/market; BEARISH harms them; NEUTRAL is unclear,
balanced, or not financially material. HIGH is broad market, central bank, major
policy, major company, or crisis; MEDIUM is sector/several-company impact; LOW is
limited or unclear impact. Use supplied text only. Return JSON only.

Labeled examples:
${examplesJson}
Article:
${articleJson}`;
  }

  private async callGeminiWithRetry(url: string, body: any): Promise<any> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return await response.json();
        }

        const status = response.status;
        const errorText = await response.text();

        // Check if retryable (429 Rate Limit, 500, 502, 503, 504 Provider errors)
        const isRetryable = [429, 500, 502, 503, 504].includes(status);

        if (!isRetryable || attempt === this.maxRetries) {
          this.logger.error(`Gemini API error [${status}]: ${errorText}`);
          if (status === 429) {
            throw new HttpException('Gemini API rate limit exceeded. Please try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
          }
          throw new HttpException(`Gemini upstream error: ${status}`, HttpStatus.BAD_GATEWAY);
        }

        // Exponential backoff with jitter: 1.5s, 3s, 6s...
        const baseDelay = 1500 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        const delay = baseDelay + jitter;

        this.logger.warn(`Gemini API returned ${status}. Retrying in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (err) {
        lastError = err;
        if (err instanceof HttpException) {
          throw err;
        }

        if (attempt === this.maxRetries) {
          this.logger.error(`Gemini request failed after ${this.maxRetries} retries: ${err.message}`);
          throw new HttpException('Failed to communicate with Gemini API', HttpStatus.GATEWAY_TIMEOUT);
        }

        const delay = 1500 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new HttpException('Unknown Gemini API error', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private parseAndValidate(responseData: any, expectedArticleId: string): ClassifyNewsResult {
    try {
      const candidate = responseData?.candidates?.[0];
      const partText = candidate?.content?.parts?.map((p: any) => p.text || '').join('');

      if (!partText) {
        throw new Error('Gemini response did not contain candidates or content parts');
      }

      const parsed = JSON.parse(partText);

      if (!SENTIMENTS.includes(parsed.sentiment)) {
        throw new Error(`Invalid sentiment returned: ${parsed.sentiment}`);
      }
      if (!IMPORTANCE.includes(parsed.importance)) {
        throw new Error(`Invalid importance returned: ${parsed.importance}`);
      }

      const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
      const reviewRequired = confidence < this.confidenceThreshold;

      return {
        article_id: parsed.article_id || expectedArticleId,
        sentiment: parsed.sentiment,
        importance: parsed.importance,
        confidence: parseFloat(confidence.toFixed(4)),
        review_required: reviewRequired,
        model: this.model,
        prompt_version: PROMPT_VERSION,
      };
    } catch (err) {
      this.logger.error(`Failed to parse structured Gemini output: ${err.message}`);
      throw new HttpException('Invalid response payload from AI model', HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  private compact(text: string): string {
    return (text || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
  }

  private generateArticleId(title: string, description: string): string {
    const hash = crypto.createHash('sha256').update(`${title}|${description}`).digest('hex');
    return `sha256:${hash}`;
  }
}
