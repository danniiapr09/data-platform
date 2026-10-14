"""Pengamanan API: kunci internal (X-API-Key) dan identitas pengguna dari Laravel (X-User, X-Role).

Alurnya: browser -> Laravel (login, sesi) -> FastAPI. Hanya Laravel yang memegang kunci,
jadi header X-User/X-Role bisa dipercaya selama kuncinya rahasia dan port FastAPI tidak terbuka ke publik.
"""
import hmac
import os
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Security
from fastapi.security import APIKeyHeader

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(key: str | None = Security(_api_key_header)) -> None:
    expected = os.getenv("INTERNAL_API_KEY")
    if not expected:
        return  # mode development: INTERNAL_API_KEY belum diisi, API tidak dikunci
    if not key or not hmac.compare_digest(key.encode(), expected.encode()):
        raise HTTPException(401, "API key tidak valid.")


@dataclass
class Actor:
    user: str | None
    role: str | None

    @property
    def nama(self) -> str:
        return self.user or "tidak diketahui"


def get_actor(x_user: str | None = Header(None), x_role: str | None = Header(None)) -> Actor:
    return Actor(user=(x_user or "").strip()[:100] or None,
                 role=(x_role or "").strip().lower()[:30] or None)


def require_role(*roles: str):
    """Pembatas role per endpoint. Baru aktif kalau env ENFORCE_ROLES=true, supaya development tidak terhalang."""
    allowed = {r.lower() for r in roles}

    def dependency(actor: Actor = Depends(get_actor)) -> Actor:
        if os.getenv("ENFORCE_ROLES", "").lower() in ("1", "true", "yes") and actor.role not in allowed:
            raise HTTPException(403, f"Aksi ini hanya untuk role: {', '.join(sorted(allowed))}.")
        return actor

    return dependency