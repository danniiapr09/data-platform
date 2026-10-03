"""Cleaning engine: formats -> duplikat -> outlier -> missing values.

Prinsip: anomali ditandai dulu (flag) beserta alasannya. Penghapusan hanya terjadi
kalau aturan di cleaning_rules.yaml memintanya secara eksplisit.
"""
import copy
import os
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import yaml

DEFAULT_RULES = {
    "missing_values": {"strategy": "flag"},
    "duplicates": {"action": "drop"},
    "outliers": {"method": "iqr", "threshold": 1.5, "action": "flag",
                 "min_rows": 4, "exclude_columns": []},
    "formats": {"strip_whitespace": True, "lowercase_columns": True, "coerce_numeric": True},
}


def load_rules(path: str | None = None) -> dict:
    rules = copy.deepcopy(DEFAULT_RULES)
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            user = yaml.safe_load(f) or {}
        for section, values in user.items():
            if isinstance(values, dict) and section in rules:
                rules[section].update(values)
    return rules


@dataclass
class CleaningResult:
    df: pd.DataFrame
    anomalies: list[dict] = field(default_factory=list)
    report: dict = field(default_factory=dict)


def _numeric_cols(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns
            if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])]


def clean(df: pd.DataFrame, rules: dict | None = None) -> CleaningResult:
    """df.index harus berisi row_index asli, supaya anomali bisa dilacak ke baris mentah."""
    rules = rules or load_rules()
    df = df.copy()
    anomalies: list[dict] = []
    rows_before = len(df)
    cells_before = df.size

    # 1. Format
    fm = rules["formats"]
    if fm.get("lowercase_columns"):
        df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    # kolom teks: dtype object (pandas 2.x) atau string (pandas 3.x)
    obj_cols = [c for c in df.columns
                if pd.api.types.is_object_dtype(df[c]) or pd.api.types.is_string_dtype(df[c])]
    if fm.get("strip_whitespace"):
        for c in obj_cols:
            df[c] = df[c].map(lambda v: v.strip() if isinstance(v, str) else v)
    for c in obj_cols:  # string kosong dianggap data kosong
        df[c] = df[c].replace("", np.nan)
    converted = []
    if fm.get("coerce_numeric"):
        for c in obj_cols:
            non_null = df[c].dropna()
            if len(non_null) == 0:
                continue
            parsed = pd.to_numeric(non_null, errors="coerce")
            if parsed.notna().mean() >= 0.9:
                df[c] = pd.to_numeric(df[c], errors="coerce")
                converted.append(c)
                # nilai yang gagal diparse (mis. "abc") ditandai, bukan dibuang diam-diam
                for idx in non_null.index[parsed.isna()]:
                    anomalies.append({"row_index": int(idx), "kolom": c,
                                      "alasan": f"[format] nilai '{non_null[idx]}' bukan angka"})

    # 2. Duplikat
    dup_mask = df.duplicated(keep="first")
    dup_found = int(dup_mask.sum())
    dup_removed = 0
    if dup_found:
        if rules["duplicates"]["action"] == "drop":
            df = df[~dup_mask]
            dup_removed = dup_found
        else:
            for idx in df.index[dup_mask]:
                anomalies.append({"row_index": int(idx), "kolom": "*",
                                  "alasan": "[duplikat] baris sama persis dengan baris sebelumnya"})

    # 3. Outlier
    ol = rules["outliers"]
    outlier_idx: set = set()
    for c in _numeric_cols(df):
        if c in (ol.get("exclude_columns") or []):
            continue
        s = df[c].dropna()
        if len(s) < ol.get("min_rows", 4):
            continue
        if ol["method"] == "zscore":
            std = s.std()
            if not std or np.isnan(std):
                continue
            z = (s - s.mean()) / std
            mask = z.abs() > ol["threshold"]
            ket = lambda v, z=z: f"z-score {z[v[0]]:.2f}"
        else:
            q1, q3 = s.quantile(0.25), s.quantile(0.75)
            iqr = q3 - q1
            lo, hi = q1 - ol["threshold"] * iqr, q3 + ol["threshold"] * iqr
            mask = (s < lo) | (s > hi)
            ket = lambda v, lo=lo, hi=hi: f"di luar rentang wajar {lo:.2f} s/d {hi:.2f}"
        for idx in s.index[mask]:
            anomalies.append({"row_index": int(idx), "kolom": c,
                              "alasan": f"[outlier] nilai {s[idx]} {ket((idx,))}"})
            outlier_idx.add(idx)
    if ol["action"] == "drop" and outlier_idx:
        df = df.drop(index=list(outlier_idx))

    # 4. Missing values
    mv = rules["missing_values"]["strategy"]
    missing_per_col = {c: int(df[c].isna().sum()) for c in df.columns if df[c].isna().any()}
    if mv == "drop":
        df = df.dropna()
    elif mv in ("fill_mean", "fill_median", "fill_zero"):
        for c in _numeric_cols(df):
            if df[c].isna().any():
                fill = {"fill_mean": df[c].mean(), "fill_median": df[c].median(), "fill_zero": 0}[mv]
                df[c] = df[c].fillna(fill)
    else:  # flag
        for c in missing_per_col:
            for idx in df.index[df[c].isna()]:
                anomalies.append({"row_index": int(idx), "kolom": c, "alasan": "[kosong] nilai tidak diisi"})

    by_type: dict = {}
    for a in anomalies:
        jenis = a["alasan"].split("]")[0].lstrip("[")
        by_type[jenis] = by_type.get(jenis, 0) + 1

    kelengkapan = round(100 * (1 - df.isna().sum().sum() / df.size), 2) if df.size else 0.0
    report = {
        "baris_awal": rows_before,
        "baris_akhir": len(df),
        "duplikat_ditemukan": dup_found,
        "duplikat_dihapus": dup_removed,
        "kosong_per_kolom": missing_per_col,
        "kolom_diubah_ke_numerik": converted,
        "anomali_total": len(anomalies),
        "anomali_per_jenis": by_type,
        "kelengkapan_persen": kelengkapan,
        "aturan": {k: rules[k] for k in ("missing_values", "duplicates", "outliers")},
    }
    return CleaningResult(df=df, anomalies=anomalies, report=report)
