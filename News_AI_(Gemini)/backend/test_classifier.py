"""Unit tests for GeminiNewsClassifier V.4."""

import json
import sys
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

# Ensure backend directory is in path regardless of CWD
sys.path.insert(0, str(Path(__file__).resolve().parent))

from gemini_news_classifier import GeminiNewsClassifier, SENTIMENTS, IMPORTANCE


class TestGeminiNewsClassifier(unittest.TestCase):
    def setUp(self):
        self.classifier = GeminiNewsClassifier(
            api_key="fake-key-for-testing",
            confidence_threshold=0.80,
            cache_ttl_seconds=3600,
        )

    def test_examples_loaded(self):
        """Ensure all 9 balanced examples are loaded."""
        self.assertEqual(len(self.classifier.examples), 9)

        # Check that all 9 pairs exist
        pairs = {(ex["label"]["sentiment"], ex["label"]["importance"]) for ex in self.classifier.examples}
        expected_pairs = {(s, i) for s in SENTIMENTS for i in IMPORTANCE}
        self.assertEqual(pairs, expected_pairs)

    def test_health_check(self):
        health = self.classifier.health_check()
        self.assertEqual(health["version"], "V.4")
        self.assertEqual(health["examples_count"], 9)
        self.assertEqual(health["confidence_threshold"], 0.80)

    @patch("gemini_news_classifier.urlopen")
    def test_classify_success_high_confidence(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.__enter__.return_value = mock_response
        mock_response.read.return_value = json.dumps({
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "article_id": "test-1",
                                    "sentiment": "BULLISH",
                                    "importance": "HIGH",
                                    "confidence": 0.95,
                                })
                            }
                        ]
                    }
                }
            ]
        }).encode("utf-8")
        mock_urlopen.return_value = mock_response

        result = self.classifier.classify(
            title="Tech giant reports record revenue beating analyst consensus",
            description="Revenue jumped 28% while margins expanded across cloud divisions.",
        )

        self.assertEqual(result["sentiment"], "BULLISH")
        self.assertEqual(result["importance"], "HIGH")
        self.assertEqual(result["confidence"], 0.95)
        self.assertFalse(result["review_required"])
        self.assertFalse(result["cached"])

    @patch("gemini_news_classifier.urlopen")
    def test_classify_low_confidence_triggers_review(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.__enter__.return_value = mock_response
        mock_response.read.return_value = json.dumps({
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "article_id": "test-2",
                                    "sentiment": "NEUTRAL",
                                    "importance": "LOW",
                                    "confidence": 0.65,
                                })
                            }
                        ]
                    }
                }
            ]
        }).encode("utf-8")
        mock_urlopen.return_value = mock_response

        result = self.classifier.classify(
            title="Local bakery expands operating hours",
            description="Bakery will now open at 6am on weekends.",
        )

        self.assertEqual(result["sentiment"], "NEUTRAL")
        self.assertEqual(result["importance"], "LOW")
        self.assertEqual(result["confidence"], 0.65)
        self.assertTrue(result["review_required"])

    @patch("gemini_news_classifier.urlopen")
    def test_deduplication_cache(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.__enter__.return_value = mock_response
        mock_response.read.return_value = json.dumps({
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "article_id": "test-cache",
                                    "sentiment": "BEARISH",
                                    "importance": "MEDIUM",
                                    "confidence": 0.88,
                                })
                            }
                        ]
                    }
                }
            ]
        }).encode("utf-8")
        mock_urlopen.return_value = mock_response

        title = "Crude oil plunges 5% amid unexpected supply build"
        desc = "Inventories rose unexpectedly by 4.2 million barrels."

        # First call hits mock_urlopen
        res1 = self.classifier.classify(title, desc)
        self.assertEqual(mock_urlopen.call_count, 1)
        self.assertFalse(res1["cached"])

        # Second call with same text returns from cache
        res2 = self.classifier.classify(title, desc)
        self.assertEqual(mock_urlopen.call_count, 1)  # NOT incremented!
        self.assertTrue(res2["cached"])
        self.assertEqual(res2["sentiment"], "BEARISH")


if __name__ == "__main__":
    unittest.main()
