"""Compact image encoding helpers shared by AutoGrader model calls."""

from __future__ import annotations

import base64
import io
import os

import fitz
from PIL import Image


def _positive_env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(maximum, value))


def pdf_first_page_data_url(
    pdf_bytes: bytes,
    *,
    dpi_env: str,
    default_dpi: int,
    quality_env: str = "AUTOGRADER_VISION_JPEG_QUALITY",
    default_quality: int = 80,
) -> str:
    """Render the first PDF page as a configurable JPEG data URL."""
    dpi = _positive_env_int(dpi_env, default_dpi, 72, 220)
    quality = _positive_env_int(quality_env, default_quality, 40, 95)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        pixmap = doc[0].get_pixmap(dpi=dpi, alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
    finally:
        doc.close()
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"
