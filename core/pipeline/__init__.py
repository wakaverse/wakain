"""WakaLab V2 Pipeline modules.

각 Phase 모듈의 run 함수를 re-export.
R1 구현: P3, P5, P6, P11, P12
R2 구현: P1, P2, P4, P7, P8
R2 추가 예정: P9, P10
"""

from core.pipeline import (
    p01_stt,
    p02_scan,
    p03_extract,
    p04_classify,
    p05_temporal,
    p06_scene,
    p08_visual,
    p11_merge,
    p12_build,
)

__all__ = [
    "p01_stt",
    "p02_scan",
    "p03_extract",
    "p04_classify",
    "p05_temporal",
    "p06_scene",
    "p08_visual",
    "p11_merge",
    "p12_build",
]
