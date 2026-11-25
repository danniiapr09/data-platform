import logging
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app.errors")

# Kode dan pesan bawaan kalau endpoint cuma raise HTTPException biasa.
BAWAAN = {
    400: ("PERMINTAAN_TIDAK_VALID", "Permintaan tidak dapat diproses."),
    401: ("BELUM_LOGIN", "Anda belum terautentikasi."),
    403: ("AKSES_DITOLAK", "Anda tidak memiliki akses."),
    404: ("TIDAK_DITEMUKAN", "Data yang diminta tidak ditemukan."),
    405: ("METODE_TIDAK_DIIZINKAN", "Metode permintaan tidak diizinkan."),
    409: ("KONFLIK_DATA", "Terjadi konflik dengan kondisi data saat ini."),
    422: ("DATA_TIDAK_VALID", "Data yang dikirim tidak valid."),
    500: ("KESALAHAN_SERVER", "Terjadi kesalahan pada server. Silakan coba lagi."),
}


class AppError(HTTPException):
    """Error dengan kode spesifik, mis. AppError(409, "DATASET_HAS_MANUAL_EDITS", "pesan", detail="petunjuk")."""

    def __init__(self, status_code: int, error_code: str, message: str,
                 detail: str | None = None, field: str | None = None):
        super().__init__(status_code=status_code, detail=message)
        self.error_code, self.message, self.hint, self.field = error_code, message, detail, field


def _respon(status: int, kode: str, pesan: str, detail=None, field=None, headers=None):
    return JSONResponse(status_code=status, headers=headers, content={
        "error_code": kode,
        "message": pesan,
        "detail": detail if detail is not None else pesan,
        "field": field,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })


async def _http(request: Request, exc: StarletteHTTPException):
    if isinstance(exc, AppError):
        return _respon(exc.status_code, exc.error_code, exc.message, exc.hint, exc.field, exc.headers)
    kode, pesan_bawaan = BAWAAN.get(exc.status_code, ("KESALAHAN", "Permintaan gagal."))
    pesan = exc.detail if isinstance(exc.detail, str) else pesan_bawaan
    return _respon(exc.status_code, kode, pesan, headers=exc.headers)


async def _validasi(request: Request, exc: RequestValidationError):
    errs = exc.errors()
    pertama = errs[0] if errs else {}
    loc = [str(x) for x in pertama.get("loc", ()) if x not in ("body", "query", "path")]
    return _respon(422, "DATA_TIDAK_VALID", BAWAAN[422][1], pertama.get("msg"), ".".join(loc) or None)


async def _server(request: Request, exc: Exception):
    # Traceback cuma masuk log server, tidak pernah dikirim ke klien.
    log.exception("Error tak tertangani di %s %s", request.method, request.url.path, exc_info=exc)
    return _respon(500, *BAWAAN[500])


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http)
    app.add_exception_handler(RequestValidationError, _validasi)
    app.add_exception_handler(Exception, _server)