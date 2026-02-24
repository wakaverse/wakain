"""Phase 0.1: Product Scanner + Pipeline Router.

Quick pre-scan using Gemini Flash Lite to extract:
- Product category, name, brand
- Marketing video quality gate
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

AUTO_MODEL = "gemini-2.5-flash-lite"

SCAN_PROMPT = """\
You are a shortform marketing video pre-scanner.
Watch this video quickly and extract:

1. Product: What is being sold?
   - category: food/beauty/fashion/electronics/living/health/service/general
   - name: product name as shown/spoken (Korean preferred), null if unclear
   - brand: brand name if visible/mentioned, null if unclear
   - multi_product: true if multiple products featured

2. Quality Gate: Is this a marketing/commerce video?
   - is_marketing_video: true/false

3. Response (JSON only, no markdown):
{
  "product": {
    "category": "...",
    "name": "..." or null,
    "brand": "..." or null,
    "multi_product": false
  },
  "is_marketing_video": true,
  "category_confidence": 0.0-1.0,
  "reasoning": "1 sentence in Korean"
}
"""

CATEGORY_LABELS_KO = {
    "food": "식품",
    "beauty": "뷰티",
    "fashion": "패션",
    "electronics": "전자기기",
    "living": "리빙",
    "health": "건강",
    "service": "서비스",
    "general": "일반",
}


@dataclass
class ProductScanResult:
    """Product scanning result."""
    category: str
    category_ko: str
    category_confidence: float
    product_name: Optional[str]
    product_brand: Optional[str]
    multi_product: bool
    is_marketing_video: bool
    reasoning: str

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "category_ko": self.category_ko,
            "category_confidence": round(self.category_confidence, 2),
            "product_name": self.product_name,
            "product_brand": self.product_brand,
            "multi_product": self.multi_product,
            "is_marketing_video": self.is_marketing_video,
            "reasoning": self.reasoning,
        }


def _prepare_video_for_upload(video_path: str, max_size_mb: int = 20) -> str:
    """Downscale video if too large for Gemini upload."""
    file_size = os.path.getsize(video_path) / (1024 * 1024)
    if file_size <= max_size_mb:
        return video_path

    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp.close()
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", "scale=-2:480",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
        "-c:a", "aac", "-b:a", "64k",
        tmp.name,
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return tmp.name


def scan_product(video_path: str) -> ProductScanResult:
    """Scan video for product category, name, brand using Gemini Flash Lite."""
    client = genai.Client()

    upload_path = _prepare_video_for_upload(video_path)
    try:
        uploaded = client.files.upload(file=upload_path)

        while uploaded.state.name == "PROCESSING":
            time.sleep(1)
            uploaded = client.files.get(name=uploaded.name)

        if uploaded.state.name != "ACTIVE":
            raise RuntimeError(f"File upload failed: {uploaded.state.name}")

        response = client.models.generate_content(
            model=AUTO_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_uri(
                            file_uri=uploaded.uri,
                            mime_type=uploaded.mime_type,
                        ),
                        types.Part.from_text(text=SCAN_PROMPT),
                    ],
                ),
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=500,
            ),
        )

        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        data = json.loads(text)
        product = data.get("product", {})
        category = product.get("category", "general")
        if category not in CATEGORY_LABELS_KO:
            category = "general"

        return ProductScanResult(
            category=category,
            category_ko=CATEGORY_LABELS_KO.get(category, "일반"),
            category_confidence=data.get("category_confidence", 0.0),
            product_name=product.get("name"),
            product_brand=product.get("brand"),
            multi_product=product.get("multi_product", False),
            is_marketing_video=data.get("is_marketing_video", True),
            reasoning=data.get("reasoning", ""),
        )

    except Exception as e:
        logger.error(f"[Phase 0.1] Product scanning failed: {e}")
        print(f"  ⚠️  제품 스캔 실패: {e}. 기본값(general)으로 대체합니다.")
        return ProductScanResult(
            category="general",
            category_ko="일반",
            category_confidence=0.0,
            product_name=None,
            product_brand=None,
            multi_product=False,
            is_marketing_video=True,
            reasoning=f"스캔 실패 — 기본값 사용 ({type(e).__name__})",
        )

    finally:
        try:
            client.files.delete(name=uploaded.name)
        except Exception:
            pass
        if upload_path != video_path and os.path.exists(upload_path):
            os.unlink(upload_path)


if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="Phase 0.1: Product Scanner")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--output", "-o", help="Output directory")
    args = parser.parse_args()

    from dotenv import load_dotenv
    load_dotenv()

    result = scan_product(args.video)

    print(f"\n[Phase 0.1] Product Scan:")
    print(f"  category:  {result.category} ({result.category_ko})"
          f" [{result.category_confidence:.0%}]")
    if result.product_name:
        print(f"  product:   {result.product_name}")
    if result.product_brand:
        print(f"  brand:     {result.product_brand}")
    print(f"  multi:     {result.multi_product}")
    print(f"  marketing: {result.is_marketing_video}")
    print(f"  reason:    {result.reasoning}")

    if args.output:
        out = Path(args.output)
        out.mkdir(parents=True, exist_ok=True)
        video_name = Path(args.video).stem
        path = out / f"{video_name}_product.json"
        path.write_text(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
        print(f"  → saved to {path}")
