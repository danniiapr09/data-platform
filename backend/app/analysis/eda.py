"""EDA: ringkasan statistik, distribusi, korelasi, dan tren historis."""
import numpy as np
import pandas as pd

TIME_HINTS = ("tahun", "year", "tanggal", "date", "periode", "bulan", "waktu")
AGGS = ("sum", "mean", "median", "min", "max")


def _f(x):
    """Angka aman untuk JSON: NaN/inf jadi None."""
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(x) or np.isinf(x) else round(x, 4)


def numeric_cols(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns
            if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])]


def detect_time_column(df: pd.DataFrame) -> str | None:
    for c in df.columns:
        if any(h in str(c).lower() for h in TIME_HINTS):
            return c
    for c in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[c]):
            return c
    return None


def summarize(df: pd.DataFrame) -> dict:
    num, cat = {}, {}
    for c in numeric_cols(df):
        s = df[c].dropna()
        if s.empty:
            continue
        num[c] = {
            "jumlah": int(s.count()), "kosong": int(df[c].isna().sum()),
            "rata_rata": _f(s.mean()), "median": _f(s.median()), "std": _f(s.std()),
            "min": _f(s.min()), "q1": _f(s.quantile(0.25)),
            "q3": _f(s.quantile(0.75)), "max": _f(s.max()),
        }
    for c in df.columns:
        if c in num:
            continue
        s = df[c].dropna()
        top = s.astype(str).value_counts().head(5)
        cat[c] = {
            "unik": int(s.nunique()), "kosong": int(df[c].isna().sum()),
            "teratas": [{"nilai": k, "jumlah": int(v)} for k, v in top.items()],
        }
    return {"numerik": num, "kategorikal": cat}


def distribution(df: pd.DataFrame, col: str, bins: int = 10) -> dict:
    if col not in df.columns:
        raise ValueError(f"Kolom '{col}' tidak ada.")
    s = pd.to_numeric(df[col], errors="coerce").dropna()
    if s.empty:
        raise ValueError(f"Kolom '{col}' tidak berisi angka.")
    counts, edges = np.histogram(s, bins=max(1, min(bins, 50)))
    return {
        "kolom": col,
        "skewness": _f(s.skew()),
        "bins": [{"dari": _f(edges[i]), "sampai": _f(edges[i + 1]), "jumlah": int(counts[i])}
                 for i in range(len(counts))],
    }


def correlations(df: pd.DataFrame) -> dict:
    cols = numeric_cols(df)
    if len(cols) < 2:
        return {"matriks": {}, "pasangan_teratas": []}
    m = df[cols].corr()
    matriks = {a: {b: _f(m.loc[a, b]) for b in cols} for a in cols}
    pairs = []
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            v = _f(m.loc[a, b])
            if v is not None:
                pairs.append({"kolom_a": a, "kolom_b": b, "korelasi": v})
    pairs.sort(key=lambda p: abs(p["korelasi"]), reverse=True)
    return {"matriks": matriks, "pasangan_teratas": pairs[:5]}


def _period(df: pd.DataFrame, waktu: str) -> pd.Series:
    s = df[waktu]
    if pd.api.types.is_numeric_dtype(s):
        return s
    d = pd.to_datetime(s, errors="coerce")
    if d.notna().mean() >= 0.8:
        return d.dt.strftime("%Y-%m")
    return s.astype(str)


def _label(p):
    if isinstance(p, (int, np.integer)):
        return int(p)
    if isinstance(p, (float, np.floating)) and float(p).is_integer():
        return int(p)
    return str(p)


def _describe_series(g: pd.Series) -> dict:
    vals = g.values.astype(float)
    growth = [None] + [
        _f((vals[i] - vals[i - 1]) / abs(vals[i - 1]) * 100) if vals[i - 1] else None
        for i in range(1, len(vals))
    ]
    slope, arah = None, "data kurang"
    if len(vals) >= 2:
        slope = float(np.polyfit(np.arange(len(vals)), vals, 1)[0])
        mean = abs(vals.mean())
        rel = slope / mean if mean else 0
        arah = "stabil" if abs(rel) < 0.01 else ("naik" if slope > 0 else "turun")
    return {
        "titik": [{"periode": _label(p), "nilai": _f(v), "pertumbuhan_persen": gr}
                  for p, v, gr in zip(g.index, vals, growth)],
        "slope_per_periode": _f(slope),
        "arah": arah,
    }


def _series(df: pd.DataFrame, waktu: str, nilai: str, agg: str) -> pd.Series:
    tmp = pd.DataFrame({"p": _period(df, waktu),
                        "v": pd.to_numeric(df[nilai], errors="coerce")}).dropna()
    return tmp.groupby("p")["v"].agg(agg).sort_index()


def trend(df: pd.DataFrame, waktu: str, nilai: str, agg: str = "sum",
          group_by: str | None = None) -> dict:
    for c in (waktu, nilai) + ((group_by,) if group_by else ()):
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada.")
    if agg not in AGGS:
        raise ValueError(f"agg harus salah satu dari: {', '.join(AGGS)}")
    total = _series(df, waktu, nilai, agg)
    if total.empty:
        raise ValueError("Tidak ada data valid untuk dihitung.")
    out = {"waktu": waktu, "nilai": nilai, "agg": agg,
           "total": _describe_series(total), "per_kelompok": None}
    if group_by:
        groups = df[group_by].dropna().unique()
        if len(groups) > 30:
            raise ValueError("Kelompok terlalu banyak (maks 30).")
        out["per_kelompok"] = {}
        for k in groups:
            g = _series(df[df[group_by] == k], waktu, nilai, agg)
            if not g.empty:
                out["per_kelompok"][str(k)] = _describe_series(g)
    return out