"""P7.5: CLAIM GROUPING — 소구 그룹핑.

P7에서 추출된 개별 claims를 의미 기반으로 그룹핑하여
중복을 제거하고 핵심 메시지를 도출한다.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from google.genai import types

from core.gemini_utils import make_client

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
MAX_RETRIES = 2

PROMPT = """당신은 커머스 숏폼 소구점 전문가입니다.

아래는 하나의 영상에서 추출된 소구점(claims) 목록입니다.
같은 의미나 같은 가치 제안을 반복하는 소구점들이 있을 수 있습니다.

작업:
1. 중복/유사한 소구점을 그룹으로 묶으세요.
2. 각 그룹에 대해:
   - theme: 2~4단어로 그룹 이름 (예: "파격적 가성비")
   - core_message: 해당 그룹의 개별 소구를 하나의 완결된 문장으로 합쳐서 작성.
     개별 소구의 맥락을 살려서 조합하세요.
     잘못된 예: "2kg 주는데" (맥락 잘림)
     올바른 예: "2kg을 1만 원대에 제공하는 파격적 가성비" (맥락 완결)
   - type: 가장 대표적인 소구 유형
   - mention_count: 영상에서 몇 번 언급됐는지 (소속 claim 수)
3. purchase_reasons: 그룹별 core_message를 "핵심 메시지 (소구 유형)" 형태로 3~5개
4. core_selling_point: 이 영상 전체의 핵심 셀링 포인트를 한 문장으로

규칙:
- 한국어로 출력
- 그룹 수는 3~6개가 적절 (너무 쪼개지도, 너무 뭉치지도 말 것)
- mention_count가 높은 그룹이 영상의 핵심 메시지
- core_message는 반드시 맥락이 완결된 문장이어야 함
- claim이 3개 미만이면 각각 별도 그룹으로

입력 claims:
{claims_json}

JSON 응답 (이 형식만):
{{
  "claim_groups": [
    {{
      "group_id": "g1",
      "theme": "그룹 이름",
      "core_message": "맥락이 완결된 한 문장",
      "type": "price",
      "claim_indices": [0, 1, 2],
      "mention_count": 3
    }}
  ],
  "purchase_reasons": [
    "핵심 메시지 (소구 유형)"
  ],
  "core_selling_point": "핵심 셀링 포인트 한 문장"
}}"""


async def run(claims: list[dict[str, Any]], api_key: str | None = None) -> dict[str, Any] | None:
    """소구점 그룹핑 실행. claims가 너무 적으면 스킵."""
    if not claims or len(claims) < 2:
        # 소구가 1개 이하면 그룹핑 불필요
        if claims:
            return {
                "claim_groups": [{
                    "group_id": "g1",
                    "theme": claims[0].get("claim", "")[:20],
                    "core_message": claims[0].get("claim", ""),
                    "type": claims[0].get("type", ""),
                    "claim_indices": [0],
                    "mention_count": 1,
                }],
                "purchase_reasons": [f"{claims[0].get('claim', '')} ({claims[0].get('type', '')})"],
                "core_selling_point": claims[0].get("claim", ""),
            }
        return None

    claims_json = json.dumps(claims, ensure_ascii=False, indent=2)
    prompt = PROMPT.format(claims_json=claims_json)

    client = make_client(api_key)
    for attempt in range(MAX_RETRIES):
        try:
            response = await client.aio.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                ),
            )
            text = response.text.strip()
            result = json.loads(text)

            # Validate
            if "claim_groups" not in result:
                logger.warning("P7.5 응답에 claim_groups 없음, 재시도 %d", attempt + 1)
                continue

            logger.info("P7.5 소구 그룹핑 완료: %d claims → %d groups",
                        len(claims), len(result["claim_groups"]))
            return result

        except Exception as exc:
            logger.warning("P7.5 attempt %d failed: %s", attempt + 1, exc)
            if attempt == MAX_RETRIES - 1:
                logger.error("P7.5 소구 그룹핑 실패, 원본 claims 유지")
                return None

    return None
