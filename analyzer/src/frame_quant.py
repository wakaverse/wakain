"""Phase 1: OpenCV quantitative frame analysis.

For each frame compute:
  edge_diff, color_diff, is_stagnant, dominant_colors,
  brightness, saturation, contrast, text_region, face detection,
  face_area_ratio, subject_area_ratio.

Uses Sobel edge → 16×16 grid → L1 diff and RGB histogram 64-bin × 3-channel
comparison as specified in SPEC.md.
"""

from __future__ import annotations

from typing import Literal

import cv2
import numpy as np

from .schemas import DominantColor, FrameQuant, TextRegion

# ── Thresholds ───────────────────────────────────────────────────────────────

EDGE_DIFF_STAGNANT = 5.0
COLOR_DIFF_STAGNANT = 0.15
GRID_SIZE = 16
HIST_BINS = 64
DOMINANT_K = 5
DOMINANT_MIN_RATIO = 0.03


# ── Edge diff ────────────────────────────────────────────────────────────────


def _edge_grid(gray: np.ndarray) -> np.ndarray:
    """Sobel edge magnitude → 16×16 grid of average magnitudes."""
    sx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    mag = np.sqrt(sx**2 + sy**2)

    h, w = mag.shape
    gh, gw = h // GRID_SIZE, w // GRID_SIZE
    # Crop to exact grid multiple
    mag = mag[: gh * GRID_SIZE, : gw * GRID_SIZE]
    # Reshape into grid cells and average
    grid = mag.reshape(GRID_SIZE, gh, GRID_SIZE, gw).transpose(0, 2, 1, 3).reshape(GRID_SIZE, GRID_SIZE, -1)
    return grid.mean(axis=2)


def compute_edge_diff(
    gray_cur: np.ndarray, gray_prev: np.ndarray | None
) -> float:
    """L1 distance between edge grids of current and previous frame."""
    grid_cur = _edge_grid(gray_cur)
    if gray_prev is None:
        return 0.0
    grid_prev = _edge_grid(gray_prev)
    return float(np.abs(grid_cur - grid_prev).mean())


# ── Color diff ───────────────────────────────────────────────────────────────


def _rgb_histogram(bgr: np.ndarray) -> np.ndarray:
    """Concatenated normalised RGB histogram (64-bin × 3 channels)."""
    hists = []
    for ch in range(3):
        h = cv2.calcHist([bgr], [ch], None, [HIST_BINS], [0, 256])
        h = h.flatten().astype(np.float64)
        s = h.sum()
        if s > 0:
            h /= s
        hists.append(h)
    return np.concatenate(hists)


def compute_color_diff(
    bgr_cur: np.ndarray, bgr_prev: np.ndarray | None
) -> float:
    """L1 distance between RGB histograms of current and previous frame."""
    hist_cur = _rgb_histogram(bgr_cur)
    if bgr_prev is None:
        return 0.0
    hist_prev = _rgb_histogram(bgr_prev)
    return float(np.abs(hist_cur - hist_prev).sum())


# ── Dominant colors ──────────────────────────────────────────────────────────


def _bgr_to_hex(bgr: np.ndarray) -> str:
    b, g, r = int(bgr[0]), int(bgr[1]), int(bgr[2])
    return f"#{r:02X}{g:02X}{b:02X}"


def extract_dominant_colors(bgr: np.ndarray, k: int = DOMINANT_K) -> list[DominantColor]:
    """K-means clustering on downsampled frame to find dominant colors."""
    small = cv2.resize(bgr, (100, 100))
    pixels = small.reshape(-1, 3).astype(np.float32)

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, centers = cv2.kmeans(
        pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS
    )

    label_counts = np.bincount(labels.flatten(), minlength=k)
    total = label_counts.sum()

    colors: list[DominantColor] = []
    for idx in np.argsort(-label_counts):
        ratio = label_counts[idx] / total
        if ratio < DOMINANT_MIN_RATIO:
            continue
        colors.append(
            DominantColor(hex=_bgr_to_hex(centers[idx]), ratio=round(ratio, 3))
        )
    return colors


# ── Brightness / Saturation / Contrast ───────────────────────────────────────


def compute_brightness(hsv: np.ndarray) -> float:
    """Average V-channel normalised to 0-1."""
    return float(hsv[:, :, 2].mean() / 255.0)


def compute_saturation(hsv: np.ndarray) -> float:
    """Average S-channel normalised to 0-1."""
    return float(hsv[:, :, 1].mean() / 255.0)


def compute_contrast(gray: np.ndarray) -> float:
    """Standard deviation of grayscale normalised to 0-1."""
    return float(gray.std() / 128.0)  # 128 = half of 256, maps ~[0,2] → clip later


# ── Text region detection ────────────────────────────────────────────────────

_TextPosition = Literal["top_third", "middle_third", "bottom_third", "full", "none"]


def detect_text_region(gray: np.ndarray) -> TextRegion:
    """Detect text-like regions via morphological gradient + contour analysis."""
    h, w = gray.shape
    total_area = h * w

    # Morphological gradient to highlight edges (text strokes)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)

    # Binarise
    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

    # Close with horizontal kernel to connect characters into text blocks
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
    closed = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, h_kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    text_area = 0
    y_centers: list[float] = []

    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        aspect = cw / max(ch, 1)
        area = cw * ch
        # Filter: text blocks are wider than tall, reasonably sized
        if aspect < 1.5 or area < (total_area * 0.002) or area > (total_area * 0.5):
            continue
        text_area += area
        y_centers.append(y + ch / 2)

    area_ratio = text_area / total_area
    detected = area_ratio > 0.01

    position: _TextPosition = "none"
    if detected and y_centers:
        avg_y = sum(y_centers) / len(y_centers)
        rel = avg_y / h
        if rel < 0.33:
            position = "top_third"
        elif rel < 0.66:
            position = "middle_third"
        else:
            position = "bottom_third"
        # If text spans most of the frame
        if area_ratio > 0.3:
            position = "full"

    return TextRegion(
        detected=detected,
        area_ratio=round(min(area_ratio, 1.0), 3),
        position=position,
    )


# ── Face detection ───────────────────────────────────────────────────────────

_face_cascade: cv2.CascadeClassifier | None = None


def _get_face_cascade() -> cv2.CascadeClassifier:
    global _face_cascade
    if _face_cascade is None:
        path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"  # type: ignore[attr-defined]
        _face_cascade = cv2.CascadeClassifier(path)
    return _face_cascade


def detect_faces(gray: np.ndarray) -> tuple[bool, float]:
    """Detect faces. Returns (face_detected, face_area_ratio)."""
    cascade = _get_face_cascade()
    h, w = gray.shape
    total_area = h * w

    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    if len(faces) == 0:
        return False, 0.0

    face_area = sum(fw * fh for (_, _, fw, fh) in faces)
    return True, round(min(face_area / total_area, 1.0), 3)


# ── Subject area (saliency-based) ───────────────────────────────────────────


def compute_subject_area_ratio(gray: np.ndarray) -> float:
    """Estimate main subject area ratio using spectral residual saliency."""
    h, w = gray.shape

    # Resize for FFT efficiency
    small = cv2.resize(gray, (64, 64)).astype(np.float64)

    spectrum = np.fft.fft2(small)
    log_amp = np.log(np.abs(spectrum) + 1e-8)
    phase = np.angle(spectrum)

    # Spectral residual = log_amplitude - averaged_log_amplitude
    avg_log_amp = cv2.blur(log_amp, (3, 3))
    residual = log_amp - avg_log_amp

    saliency = np.abs(np.fft.ifft2(np.exp(residual + 1j * phase))) ** 2
    saliency = cv2.GaussianBlur(saliency.astype(np.float32), (9, 9), 2.5)
    saliency = cv2.normalize(saliency, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    # Threshold to get salient region
    _, mask = cv2.threshold(saliency, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

    ratio = mask.sum() / (255.0 * mask.size)
    return round(min(max(ratio, 0.0), 1.0), 3)


# ── Public API ───────────────────────────────────────────────────────────────


def analyse_frame(
    bgr: np.ndarray,
    timestamp: float,
    prev_bgr: np.ndarray | None = None,
) -> FrameQuant:
    """Run all quantitative analyses on a single BGR frame."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    prev_gray = (
        cv2.cvtColor(prev_bgr, cv2.COLOR_BGR2GRAY) if prev_bgr is not None else None
    )

    edge_diff = compute_edge_diff(gray, prev_gray)
    color_diff = compute_color_diff(bgr, prev_bgr)
    is_stagnant = edge_diff < EDGE_DIFF_STAGNANT and color_diff < COLOR_DIFF_STAGNANT

    dominant_colors = extract_dominant_colors(bgr)
    brightness = compute_brightness(hsv)
    saturation = compute_saturation(hsv)
    contrast = min(compute_contrast(gray), 1.0)

    text_region = detect_text_region(gray)
    face_detected, face_area_ratio = detect_faces(gray)
    subject_area_ratio = compute_subject_area_ratio(gray)

    return FrameQuant(
        timestamp=timestamp,
        edge_diff=round(edge_diff, 2),
        color_diff=round(color_diff, 3),
        is_stagnant=is_stagnant,
        dominant_colors=dominant_colors,
        brightness=round(brightness, 3),
        saturation=round(saturation, 3),
        contrast=round(contrast, 3),
        text_region=text_region,
        face_detected=face_detected,
        face_area_ratio=face_area_ratio,
        subject_area_ratio=subject_area_ratio,
    )
