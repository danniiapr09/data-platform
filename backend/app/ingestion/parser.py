"""Baca file CSV/Excel jadi DataFrame + ringkasan struktur kolom."""
import io
import json

import pandas as pd

ALLOWED_EXT = {".csv", ".xlsx", ".xls"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


class ParseError(ValueError):
    pass


def read_file(content: bytes, filename: str) -> pd.DataFrame:
    name = filename.lower()
    ext = name[name.rfind("."):] if "." in name else ""
    if ext not in ALLOWED_EXT:
        raise ParseError(f"Format {ext or 'tanpa ekstensi'} tidak didukung. Pakai CSV atau Excel.")
    if len(content) > MAX_BYTES:
        raise ParseError("Ukuran file maksimal 10 MB.")
    if len(content) == 0:
        raise ParseError("File kosong.")

    try:
        if ext == ".csv":
            df = _read_csv(content)
        else:
            df = pd.read_excel(io.BytesIO(content))
    except ParseError:
        raise
    except Exception as e:
        raise ParseError(f"Gagal membaca file: {e}")

    if df.empty or len(df.columns) == 0:
        raise ParseError("File tidak berisi data.")
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _read_csv(content: bytes) -> pd.DataFrame:
    last_err = None
    for enc in ("utf-8-sig", "latin-1"):
        try:
            # sep=None + engine python = deteksi otomatis koma / titik koma / tab
            return pd.read_csv(io.BytesIO(content), sep=None, engine="python", encoding=enc)
        except UnicodeDecodeError as e:
            last_err = e
    raise ParseError(f"Encoding file tidak dikenali: {last_err}")


def to_records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> list dict yang aman untuk JSON (NaN jadi None, tanggal jadi ISO)."""
    return json.loads(df.to_json(orient="records", date_format="iso"))


def profile_columns(df: pd.DataFrame) -> list[dict]:
    out = []
    for col in df.columns:
        s = df[col]
        sample = s.dropna().head(3).astype(str).tolist()
        out.append({
            "kolom": col,
            "tipe": str(s.dtype),
            "kosong": int(s.isna().sum()),
            "unik": int(s.nunique(dropna=True)),
            "contoh": sample,
        })
    return out
