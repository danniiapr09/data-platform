"""Forecasting baseline: naive, moving average, drift, linear trend.

Evaluasi memakai holdout berurutan (periode terakhir jadi data uji), bukan acak,
supaya data masa depan tidak bocor ke pelatihan.
"""
import re

import numpy as np

from ..analysis.eda import _f


def naive(train: np.ndarray, h: int) -> np.ndarray:
    return np.repeat(train[-1], h)


def moving_average(train: np.ndarray, h: int, window: int = 3) -> np.ndarray:
    return np.repeat(train[-min(window, len(train)):].mean(), h)


def drift(train: np.ndarray, h: int) -> np.ndarray:
    slope = (train[-1] - train[0]) / (len(train) - 1)
    return train[-1] + slope * np.arange(1, h + 1)


def linear_trend(train: np.ndarray, h: int) -> np.ndarray:
    a, b = np.polyfit(np.arange(len(train)), train, 1)
    return a * np.arange(len(train), len(train) + h) + b


MODELS = {
    "naive": naive,
    "moving_average": moving_average,
    "drift": drift,
    "linear_trend": linear_trend,
}


def next_periods(last, n: int) -> list:
    if isinstance(last, int):
        return [last + i for i in range(1, n + 1)]
    m = re.fullmatch(r"(\d{4})-(\d{2})", str(last))
    if m:
        y, mo, out = int(m[1]), int(m[2]), []
        for _ in range(n):
            mo += 1
            if mo > 12:
                y, mo = y + 1, 1
            out.append(f"{y}-{mo:02d}")
        return out
    return [f"t+{i}" for i in range(1, n + 1)]


def _metrics(actual: np.ndarray, pred: np.ndarray) -> dict:
    err = actual - pred
    nz = actual != 0
    mape = np.mean(np.abs(err[nz] / actual[nz])) * 100 if nz.any() else None
    return {"mae": _f(np.mean(np.abs(err))), "mape": _f(mape),
            "rmse": _f(np.sqrt(np.mean(err ** 2)))}


def run_forecast(labels: list, values, horizon: int = 3, test_size: int | None = None) -> dict:
    values = np.asarray(values, dtype=float)
    n = len(values)
    if n < 4:
        raise ValueError("Minimal 4 periode data untuk forecasting.")
    if test_size is None:
        test_size = max(1, min(3, round(n * 0.2)))
    test_size = max(1, min(test_size, n - 3))  # data latih minimal 3 titik

    train, test = values[:-test_size], values[-test_size:]
    evaluasi, test_pred = [], {}
    for name, fn in MODELS.items():
        pred = fn(train, test_size)
        test_pred[name] = pred
        evaluasi.append({"model": name, **_metrics(test, pred)})
    evaluasi.sort(key=lambda e: (e["mae"], e["rmse"]))
    best = evaluasi[0]["model"]
    rmse = evaluasi[0]["rmse"] or 0.0

    # latih ulang model terbaik dengan seluruh data, lalu prediksi ke depan
    future = MODELS[best](values, horizon)
    non_negative = bool((values >= 0).all())
    prediksi = []
    for p, v in zip(next_periods(labels[-1], horizon), future):
        lo, hi = v - 1.96 * rmse, v + 1.96 * rmse
        if non_negative:
            lo = max(lo, 0.0)
        prediksi.append({"periode": p, "nilai": _f(v), "bawah": _f(lo), "atas": _f(hi)})

    catatan = [
        "Prediksi bukan kepastian. Rentang bawah-atas adalah perkiraan kasar dari "
        "kesalahan model pada data uji.",
        f"Model dipilih dari {len(MODELS)} baseline berdasarkan MAE terkecil pada "
        f"{test_size} periode terakhir yang tidak dipakai untuk pelatihan.",
    ]
    if n < 10:
        catatan.append(f"Data hanya {n} periode, jadi hasil ini bersifat indikatif.")
    if all(isinstance(x, int) for x in labels):
        diffs = {b - a for a, b in zip(labels, labels[1:])}
        if diffs != {1}:
            catatan.append("Ada periode yang tidak berurutan atau bolong; model menganggap jaraknya sama.")

    return {
        "jumlah_periode": n,
        "periode_uji": test_size,
        "model_terbaik": best,
        "evaluasi": evaluasi,
        "perbandingan_uji": [
            {"periode": l, "aktual": _f(a), "prediksi": _f(p)}
            for l, a, p in zip(labels[-test_size:], test, test_pred[best])
        ],
        "prediksi": prediksi,
        "catatan": catatan,
    }