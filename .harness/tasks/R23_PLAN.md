# R23 — content_dna + brands + channels 구현

참조: `docs/WAKALAB_DATA_ARCHITECTURE_v2.md`

## T1: Supabase 테이블 생성 (3개)

### brands
```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  category_id TEXT,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_brands_name ON brands(name);
```

### channels
```sql
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  platform TEXT NOT NULL,
  channel_url TEXT UNIQUE,
  channel_name TEXT,
  follower_count INT,
  is_tracked BOOLEAN DEFAULT false,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_channels_platform ON channels(platform);
CREATE INDEX idx_channels_brand ON channels(brand_id);
```

### content_dna
```sql
CREATE TABLE content_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID UNIQUE REFERENCES results(id),
  job_id UUID REFERENCES jobs(id),
  organization_id UUID,
  user_id UUID,
  brand_id UUID REFERENCES brands(id),
  channel_id UUID REFERENCES channels(id),
  -- 분류 축
  category TEXT,
  subcategory TEXT,
  platform TEXT,
  duration FLOAT,
  -- 구조 DNA
  block_sequence TEXT[],
  block_count INT,
  appeal_distribution JSONB,
  style_distribution JSONB,
  -- 훅 DNA
  hook_type TEXT,
  hook_strength TEXT,
  first_3s_dynamics FLOAT,
  product_first_appear FLOAT,
  -- 리듬 DNA
  cut_count INT,
  cut_avg_duration FLOAT,
  cut_rhythm TEXT,
  dynamics_avg FLOAT,
  dynamics_std FLOAT,
  -- 혼동 변수
  has_person BOOLEAN,
  person_role TEXT,
  face_visible BOOLEAN,
  voice_type TEXT,
  bgm_genre TEXT,
  has_text_overlay BOOLEAN,
  channel_followers INT,
  trend_tag TEXT,
  -- 성과 (nullable)
  views BIGINT,
  likes INT,
  comments_count INT,
  roas FLOAT,
  ctr FLOAT,
  performance_source TEXT,
  performance_updated_at TIMESTAMPTZ,
  -- 메타
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_content_dna_category_platform ON content_dna(category, platform);
CREATE INDEX idx_content_dna_brand ON content_dna(brand_id);
CREATE INDEX idx_content_dna_channel ON content_dna(channel_id);
CREATE INDEX idx_content_dna_hook ON content_dna(hook_type, hook_strength);
```

완료 기준: Supabase에 3개 테이블 + 인덱스 생성 확인

---

## T2: worker.py — content_dna 자동 생성

`run_analysis()` 완료 시점(results INSERT 후)에 `_build_content_dna()` 호출.

### 데이터 소스 매핑

| content_dna 컬럼 | 소스 |
|-----------------|------|
| category, subcategory, platform, duration | recipe_json.identity / recipe_json.meta |
| block_sequence, block_count | recipe_json.script.blocks → block_type 순서/개수 |
| appeal_distribution | recipe_json.product.claims → claim_type별 비율 |
| style_distribution | recipe_json.visual.scenes → style별 비율 |
| hook_type, hook_strength | recipe_json.engagement.retention_analysis |
| first_3s_dynamics | recipe_json.engagement.retention_analysis.first_3s 또는 temporal |
| product_first_appear | recipe_json.meta.product_first_appear |
| cut_count, cut_avg_duration | recipe_json.visual.cut_stats 또는 temporal |
| dynamics_avg, dynamics_std | recipe_json.visual 또는 temporal |
| has_person, person_role, face_visible | recipe_json.meta.human_presence |
| voice_type | recipe_json.meta.audio.voice.type |
| bgm_genre | recipe_json.meta.audio.music.genre |
| has_text_overlay | recipe_json에서 text_overlay 존재 여부 |

### 주의
- recipe_json 구조를 반드시 실제 데이터로 확인 후 매핑할 것
- 없는 필드는 null 허용 (graceful)
- 프로젝트의 `docs/WAKAIN_DATA_MAP.md` 참고

완료 기준: 새 영상 분석 시 content_dna에 1행 자동 생성

---

## T3: brand 자동 매칭

1. recipe_json.product.brand에서 브랜드명 추출
2. brands 테이블에서 name 또는 aliases 매칭 (ILIKE 또는 ANY)
3. 매칭 실패 → 신규 brand INSERT
4. content_dna.brand_id에 연결

완료 기준: 분석 완료 시 brand 자동 매칭/생성 + content_dna.brand_id 연결

---

## T4: channel 추출 (URL 분석 시)

1. `analyze-url`의 source_url에서 platform + channel 정보 파싱
   - Instagram: `instagram.com/reel/xxx` → `instagram.com/{username}`
   - TikTok: `tiktok.com/@user/video/xxx` → `tiktok.com/@user`
   - YouTube: `youtube.com/shorts/xxx` → channel 추출 어려움 (null 허용)
2. channels UPSERT (channel_url 기준)
3. content_dna.channel_id 연결
4. 직접 업로드 시 channel_id = null

완료 기준: URL 분석 시 channel 자동 생성 + content_dna.channel_id 연결

---

## T5: 기존 데이터 백필 스크립트

- `backend/backfill_content_dna.py`
- results 테이블 전체 조회 → recipe_json에서 content_dna 생성
- 중복 방지: result_id UNIQUE 제약으로 ON CONFLICT DO NOTHING
- 1회성 실행

완료 기준: 기존 분석 데이터 전부 content_dna로 백필
