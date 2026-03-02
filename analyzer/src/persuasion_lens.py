"""Phase 4d: Persuasion Lens — 2-lens post-processing of video_recipe.

Lens 1: 7+α Persuasion Formula (step-by-step structure analysis)
Lens 2: Traditional Framework Matching (PAS/AIDA/BAB/FAB/Comparison/Story)

Single Gemini call, JSON output.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from google import genai
from google.genai import types

MODEL = "gemini-2.5-flash"


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY_PRO", "") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GEMINI_API_KEY_PRO not set.")
    return genai.Client(api_key=api_key)


def _extract_json(text: str) -> Any:
    """Extract JSON from Gemini response, handling markdown fences."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    return json.loads(text)


SYSTEM_PROMPT = """\
You are a short-form video persuasion analyst. Given a video recipe JSON and STT transcript,
produce a two-lens analysis as a single JSON object.

## Lens 1: "lens_7step" — 7+α Persuasion Formula

Analyze the video for these 7 persuasion steps (in order). Each step may or may not be present.

1. **권위 부여 (Authority)** — Trust device.
   sub_types: "professional" (전문직업형), "career" (경력연차형), "picky_standard" (까다로운기준형),
   "celebrity" (셀럽형), "backstory" (배경스토리형), "life_veteran" (생활베테랑형)

2. **감탄 훅 (Hook)** — Stop-scroll in 3 seconds.
   quality_checks: "direct_experience" (직접경험 화법?), "indirect_speech" (간접화법 "난리" 사용?),
   "specific_action" (구체적 감정/행동?)

3. **상황 묘사 (Sensory)** — Sensory simulation.
   quality_checks: which senses (visual/tactile/taste/smell/auditory), contrast structure?, onomatopoeia?

4. **간편함 어필 (Ease)** — "I can do it too."
   quality_checks: "uses_numbers" (숫자 활용?), "hidden_ingredient" (비밀재료 숨김?)

5. **과정 묘사 (Process)** — Optional. May be skipped.
   quality_checks: "skipped" (스킵했는가?)

6. **사회적 증거 (Social Proof)** — Others' reactions or personal transformation.
   sub_types: "others_reaction" (타인반응형), "personal_change" (본인변화형)

7. **CTA** — Call to action.
   sub_types: "comment" (댓글유도), "link" (링크), "limited" (한정), "general" (일반)

Extension modules (α) — tag any that appear in a step:
"price_anchoring" (가격앵커링), "scarcity" (희소성), "before_after" (비포애프터),
"data_evidence" (데이터증거), "trend" (트렌드소구), "risk_removal" (위험제거)

Output for each step:
{
  "step": <1-7>,
  "name_ko": "<Korean name>",
  "name_en": "<English key>",
  "present": <true/false>,
  "sub_type": "<sub_type key or null>",
  "sub_type_ko": "<Korean sub_type name or null>",
  "time_range": [<start_sec>, <end_sec>] or null,
  "evidence": "<quote or description from video>",
  "extensions": ["<extension keys found>"],
  "quality_checks": {<relevant checks as boolean>}
}

## Lens 2: "lens_framework" — Traditional Framework Matching

Match the video to the closest traditional persuasion framework:
- PAS (Problem → Agitate → Solution) / 문제-자극-해결
- AIDA (Attention → Interest → Desire → Action) / 주목-흥미-욕구-행동
- BAB (Before → After → Bridge) / 이전-이후-연결
- FAB (Feature → Advantage → Benefit) / 특징-장점-혜택
- Comparison (A vs B → Test → Winner) / 비교-테스트-승자
- Story (Character → Conflict → Resolution) / 인물-갈등-해결

Output:
{
  "primary_framework": "<key>",
  "primary_framework_ko": "<Korean name>",
  "confidence": <0.0-1.0>,
  "mapping": [
    {"phase": "<phase name>", "phase_ko": "<Korean>", "time_range": [<start>, <end>], "description": "<what happens>"}
  ],
  "secondary_framework": "<key or null>",
  "secondary_confidence": <0.0-1.0>
}

## Output format
Return ONLY valid JSON (no markdown, no explanation):
{"lens_7step": [...], "lens_framework": {...}}
"""


def analyze_persuasion_lens(
    video_recipe: dict,
    stt_transcript: str | None = None,
) -> dict:
    """Run 2-lens persuasion analysis on a video_recipe result.

    Args:
        video_recipe: Full video_recipe JSON (Phase 4a output).
        stt_transcript: Optional full STT transcript text.

    Returns:
        {"lens_7step": [...], "lens_framework": {...}}
    """
    client = _make_client()

    # Build compact input for the model
    recipe = video_recipe.get("video_recipe", video_recipe)

    input_data = {
        "meta": recipe.get("meta", {}),
        "structure": recipe.get("structure", {}),
        "persuasion_analysis": recipe.get("persuasion_analysis", {}),
        "scenes": [
            {
                "scene_id": s.get("scene_id"),
                "role": s.get("role"),
                "time_range": s.get("time_range"),
                "description": s.get("description", ""),
                "appeal_points": s.get("appeal_points", []),
                "effectiveness_signals": s.get("effectiveness_signals", {}),
            }
            for s in recipe.get("scenes", [])
        ],
        "audio_voice": recipe.get("audio", {}).get("voice", {}),
        "effectiveness": recipe.get("effectiveness_assessment", {}),
    }

    user_message = f"## Video Recipe\n```json\n{json.dumps(input_data, ensure_ascii=False, indent=None)}\n```"
    if stt_transcript:
        user_message += f"\n\n## Full STT Transcript\n{stt_transcript[:3000]}"

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[types.Part(text=user_message)]),
        ],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.3,
            max_output_tokens=4096,
        ),
    )

    result = _extract_json(response.text)

    # Validate structure
    if "lens_7step" not in result or "lens_framework" not in result:
        raise ValueError("Model output missing lens_7step or lens_framework keys")

    return result


# ── Standalone test ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m src.persuasion_lens <video_recipe.json>")
        sys.exit(1)

    recipe_path = sys.argv[1]
    with open(recipe_path, encoding="utf-8") as f:
        recipe_data = json.load(f)

    # Try to load STT if available
    stt_text = None
    stt_path = recipe_path.replace("_video_recipe.json", "_stt.json")
    if os.path.exists(stt_path):
        with open(stt_path, encoding="utf-8") as f:
            stt_data = json.load(f)
            stt_text = stt_data.get("full_transcript", "")

    result = analyze_persuasion_lens(recipe_data, stt_text)
    print(json.dumps(result, ensure_ascii=False, indent=2))
