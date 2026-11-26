import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import AppError
from .analysis import load_clean_df
from .reports import get_dataset_or_404

router = APIRouter(prefix="/datasets/{dataset_id}/analysis", tags=["analysis-charts"])

AGGS = ("sum", "mean", "median", "min", "max", "count")
MAX_LEVELS = 4
MAX_MATRIX_CELLS = 50_000
EMPTY_LABEL = "(kosong)"


def _label(v) -> str:
    if pd.isna(v):
        return EMPTY_LABEL
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def _natural(label: str):
    """Urutan natural: angka dulu (2 sebelum 10), lalu teks, '(kosong)' paling akhir."""
    if label == EMPTY_LABEL:
        return (2, 0.0, "")
    try:
        return (0, float(label), "")
    except ValueError:
        return (1, 0.0, label.lower())


def _num(v):
    v = v.item() if hasattr(v, "item") else v
    return round(v, 4) if isinstance(v, float) else v


def _require_columns(df: pd.DataFrame, names: list, field: str):
    for n in names:
        if n not in df.columns:
            raise AppError(422, "COLUMN_NOT_FOUND", f"Kolom '{n}' tidak ada di dataset ini.", field=field)


def _prepare(df: pd.DataFrame, group_cols: list, metric: str | None, agg: str) -> pd.DataFrame:
    """Frame kerja: kolom pengelompokan (jadi label teks) + kolom nilai '_v'."""
    if agg not in AGGS:
        raise AppError(422, "INVALID_AGG", "Nilai agg tidak dikenal.",
                       detail="Gunakan: sum, mean, median, min, max, atau count.", field="agg")
    work = df[group_cols].copy()
    if agg == "count":
        work["_v"] = 1
    else:
        if not metric:
            raise AppError(422, "METRIC_REQUIRED", "Parameter metric wajib diisi.",
                           detail="Isi metric dengan nama kolom numerik, atau pakai agg=count.", field="metric")
        _require_columns(df, [metric], "metric")
        if not pd.api.types.is_numeric_dtype(df[metric]) or pd.api.types.is_bool_dtype(df[metric]):
            raise AppError(422, "METRIC_NOT_NUMERIC", f"Kolom '{metric}' bukan kolom numerik.", field="metric")
        work["_v"] = df[metric]
        work = work.dropna(subset=["_v"])  # baris tanpa nilai tidak ikut dihitung
    for c in group_cols:
        work[c] = work[c].map(_label)
    return work


def _grouped(work: pd.DataFrame, group_cols: list, agg: str) -> pd.Series:
    return work.groupby(group_cols)["_v"].agg("sum" if agg == "count" else agg)


def _to_nodes(d: dict) -> list:
    nodes = []
    for name in sorted(d, key=_natural):
        v = d[name]
        nodes.append({"name": name, "children": _to_nodes(v)} if isinstance(v, dict)
                     else {"name": name, "value": v})
    return nodes


@router.get("/hierarchy")
def hierarchy(
    dataset_id: int,
    levels: str = Query(..., min_length=1),
    metric: str | None = None,
    agg: str = "sum",
    db: Session = Depends(get_db),
):
    get_dataset_or_404(db, dataset_id)
    df = load_clean_df(db, dataset_id)  # 400 kalau belum di-cleaning
    cols = [x.strip() for x in levels.split(",") if x.strip()]
    if not cols or len(cols) > MAX_LEVELS or len(set(cols)) != len(cols):
        raise AppError(422, "INVALID_LEVELS", f"levels harus 1 sampai {MAX_LEVELS} nama kolom yang berbeda.",
                       field="levels")
    _require_columns(df, cols, "levels")
    work = _prepare(df, cols, metric, agg)
    if work.empty:
        return {"name": "root", "children": []}

    tree: dict = {}
    for key, val in _grouped(work, cols, agg).items():
        key = key if isinstance(key, tuple) else (key,)
        node = tree
        for k in key[:-1]:
            node = node.setdefault(k, {})
        node[key[-1]] = _num(val)
    return {"name": "root", "children": _to_nodes(tree)}


@router.get("/matrix")
def matrix(
    dataset_id: int,
    row: str,
    col: str,
    metric: str | None = None,
    agg: str = "sum",
    db: Session = Depends(get_db),
):
    get_dataset_or_404(db, dataset_id)
    df = load_clean_df(db, dataset_id)
    if row == col:
        raise AppError(422, "SAME_AXIS", "row dan col harus kolom yang berbeda.", field="col")
    _require_columns(df, [row], "row")
    _require_columns(df, [col], "col")
    work = _prepare(df, [row, col], metric, agg)
    empty = {"row": row, "col": col, "metric": metric, "agg": agg,
             "rows": [], "cols": [], "values": [], "min": None, "max": None}
    if work.empty:
        return empty

    if work[row].nunique() * work[col].nunique() > MAX_MATRIX_CELLS:
        raise AppError(422, "MATRIX_TOO_LARGE", "Kombinasi baris dan kolom terlalu banyak.",
                       detail=f"Maksimal {MAX_MATRIX_CELLS} sel. Pilih kolom dengan nilai unik lebih sedikit.")
    table = _grouped(work, [row, col], agg).unstack(col)
    row_labels = sorted(table.index, key=_natural)
    col_labels = sorted(table.columns, key=_natural)
    table = table.reindex(index=row_labels, columns=col_labels)
    values = [[None if pd.isna(v) else _num(v) for v in r] for r in table.itertuples(index=False)]
    flat = [v for r in values for v in r if v is not None]
    return {**empty, "rows": row_labels, "cols": col_labels, "values": values,
            "min": min(flat) if flat else None, "max": max(flat) if flat else None}