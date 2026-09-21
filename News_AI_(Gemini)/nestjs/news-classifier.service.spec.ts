import { Test, TestingModule } from '@nestjs/testing';
import { NewsClassifierService } from './news-classifier.service';

describe('NewsClassifierService', () => {
  let service: NewsClassifierService;

  beforeEach(async () => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.CLASSIFIER_CONFIDENCE_THRESHOLD = '0.80';

    const module: TestingModule = await Test.createTestingModule({
      providers: [NewsClassifierService],
    }).compile();

    service = module.get<NewsClassifierService>(NewsClassifierService);
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should be defined and return health check status', () => {
    expect(service).toBeDefined();
    const health = service.healthCheck();
    expect(health.version).toBe('V.4');
    expect(health.examples_count).toBe(9);
    expect(health.confidence_threshold).toBe(0.8);
  });

  it('should flag review_required when confidence is below 0.80', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  article_id: 'test-123',
                  sentiment: 'BULLISH',
                  importance: 'MEDIUM',
                  confidence: 0.72,
                }),
              },
            ],
          },
        },
      ],
    };

    jest.spyOn<any, any>(service, 'callGeminiWithRetry').mockResolvedValue(mockGeminiResponse);

    const result = await service.classify({
      title: 'Company revenue growth hits new record',
      description: 'Q3 net profit rose 15% year-on-year.',
    });

    expect(result.sentiment).toBe('BULLISH');
    expect(result.importance).toBe('MEDIUM');
    expect(result.confidence).toBe(0.72);
    expect(result.review_required).toBe(true);
  });

  it('should set review_required to false when confidence is >= 0.80', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  article_id: 'test-456',
                  sentiment: 'BEARISH',
                  importance: 'HIGH',
                  confidence: 0.94,
                }),
              },
            ],
          },
        },
      ],
    };

    jest.spyOn<any, any>(service, 'callGeminiWithRetry').mockResolvedValue(mockGeminiResponse);

    const result = await service.classify({
      title: 'Central bank announces surprise interest rate hike of 75 bps',
      description: 'Markets tumble as inflation concerns escalate globally.',
    });

    expect(result.sentiment).toBe('BEARISH');
    expect(result.importance).toBe('HIGH');
    expect(result.confidence).toBe(0.94);
    expect(result.review_required).toBe(false);
  });

  it('should cache results to prevent redundant calls to Gemini API', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  article_id: 'test-cache',
                  sentiment: 'NEUTRAL',
                  importance: 'LOW',
                  confidence: 0.88,
                }),
              },
            ],
          },
        },
      ],
    };

    const spy = jest.spyOn<any, any>(service, 'callGeminiWithRetry').mockResolvedValue(mockGeminiResponse);

    const input = {
      title: 'Local council updates parking permit guidelines',
      description: 'New regulations will take effect next quarter.',
    };

    // First call: calls Gemini
    const res1 = await service.classify(input);
    expect(res1.cached).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);

    // Second call with same content: served from cache
    const res2 = await service.classify(input);
    expect(res2.cached).toBe(true);
    expect(res2.sentiment).toBe('NEUTRAL');
    expect(spy).toHaveBeenCalledTimes(1); // Not called again!
  });
});
