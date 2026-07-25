"""Input security utilities for hostile HTML and untrusted image uploads."""

from __future__ import annotations

from io import BytesIO

import bleach
import filetype
from PIL import Image, UnidentifiedImageError

_ALLOWED_TAGS = ["p", "b", "i", "strong", "em", "a", "ul", "li"]
_ALLOWED_ATTRIBUTES = {"a": ["href"]}
_ALLOWED_PROTOCOLS = ["http", "https"]
_ALLOWED_IMAGE_MIME = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def sanitize_rich_text(raw_html: str) -> str:
    """Sanitize rich HTML input using a strict allowlist."""
    if not raw_html:
        return ""

    return bleach.clean(
        raw_html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        protocols=_ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    ).strip()


def secure_image_upload(file_bytes: bytes) -> bytes:
    """Validate magic bytes and regenerate image without EXIF metadata."""
    kind = filetype.guess(file_bytes)
    if kind is None or kind.mime not in _ALLOWED_IMAGE_MIME:
        raise ValueError("Unsupported or invalid image type")

    image_format = _ALLOWED_IMAGE_MIME[kind.mime]

    try:
        with Image.open(BytesIO(file_bytes)) as image:
            image.load()

            safe_image = Image.new(image.mode, image.size)
            safe_image.putdata(list(image.getdata()))

            if image_format == "JPEG" and safe_image.mode not in ("RGB", "L"):
                safe_image = safe_image.convert("RGB")

            output = BytesIO()
            safe_image.save(output, format=image_format)
            return output.getvalue()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Invalid image payload") from exc