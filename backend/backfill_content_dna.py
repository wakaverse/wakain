"""R23 T5: 기존 results 데이터를 content_dna로 백필하는 1회성 스크립트.

Usage:
    cd backend && python backfill_content_dna.py

중복 방지: content_dna.result_id UNIQUE 제약 → ON CONFLICT 시 skip.
"""

import os
import sys

# backend/ 기준으로 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from dotenv import load_dotenv

load_dotenv()

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client

# worker 함수 재사용
from app.worker import (
    _build_content_dna,
    _extract_channel_from_url,
    _match_or_create_brand,
    _resolve_category_id,
    _upsert_channel,
)


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # 모든 results 조회 (recipe_json이 있는 것만)
    print("📦 Fetching results with recipe_json...", flush=True)
    offset = 0
    page_size = 100
    total = 0
    skipped = 0
    errors = 0

    while True:
        resp = (
            sb.table("results")
            .select("id, job_id, recipe_json")
            .not_.is_("recipe_json", "null")
            .order("created_at")
            .range(offset, offset + page_size - 1)
            .execute()
        )

        if not resp.data:
            break

        for row in resp.data:
            result_id = row["id"]
            job_id = row.get("job_id")
            recipe_json = row.get("recipe_json")

            if not recipe_json or not job_id:
                skipped += 1
                continue

            # 중복 체크 (UNIQUE 제약에 의존하지만, 불필요한 에러 로그 방지)
            try:
                existing = (
                    sb.table("content_dna")
                    .select("id")
                    .eq("result_id", result_id)
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    skipped += 1
                    continue
            except Exception:
                pass

            try:
                # Brand 매칭
                brand_name = recipe_json.get("product", {}).get("brand")
                category_id = _resolve_category_id(recipe_json)
                brand_id = _match_or_create_brand(brand_name, category_id)

                # Channel 추출
                source_url = None
                try:
                    job_resp = sb.table("jobs").select("source_url").eq("id", job_id).limit(1).execute()
                    if job_resp.data:
                        source_url = job_resp.data[0].get("source_url")
                except Exception:
                    pass

                channel_id = None
                if source_url:
                    plat, ch_url, ch_name = _extract_channel_from_url(source_url)
                    channel_id = _upsert_channel(plat, ch_url, ch_name, brand_id)

                # content_dna 생성
                _build_content_dna(result_id, job_id, recipe_json, brand_id, channel_id, source_url)
                total += 1

                if total % 10 == 0:
                    print(f"  ✅ {total} rows backfilled...", flush=True)

            except Exception as e:
                errors += 1
                print(f"  ❌ result_id={result_id[:8]}: {e}", flush=True)

        offset += page_size

    print(f"\n🏁 Backfill complete: {total} created, {skipped} skipped, {errors} errors", flush=True)


if __name__ == "__main__":
    main()
