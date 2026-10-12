"""Perbandingan antar kelompok/periode, rasio, dan deskripsi otomatis (berbasis template)."""
import numpy as np
import pandas as pd

from . import eda
from .eda import _f, _label

AGG_LABEL = {"sum": "total", "mean": "rata-rata", "median": "median",
             "min": "nilai minimum", "max": "nilai maksimum"}


# ---------- helper format ----------
def fmt(x, desimal: int | None = None) -> str:
    """Format angka gaya Indonesia: 1.234,50"""
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return "-"
    x = float(x)
    if desimal is None:
        desimal = 0 if abs(x - round(x)) < 1e-9 else 2
    return f"{x:,.{desimal}f}".replace(",", "§").replace(".", ",").replace("§", ".")


def pct(x: float, sign: bool = True) -> str:
    return (f"{x:+.1f}%" if sign else f"{x:.1f}%").replace(".", ",")


def nama(c: str) -> str:
    return str(c).replace("_", " ")


def _need(df: pd.DataFrame, *cols):
    for c in cols:
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada.")


def _labels(df: pd.DataFrame, waktu: str) -> pd.Series:
    return eda._period(df, waktu).map(lambda v: str(_label(v)) if pd.notna(v) else None)


def _key(df: pd.DataFrame, kelompok: str, waktu: str | None) -> pd.Series:
    return eda._period(df, waktu) if (waktu and kelompok == waktu) else df[kelompok]


# ---------- filter ----------
def describe_filters(periode=None, dari=None, sampai=None, filter_kolom=None, filter_nilai=None) -> str:
    parts = []
    if periode is not None:
        parts.append(f"periode {periode}")
    if dari is not None or sampai is not None:
        parts.append(f"rentang {fmt(dari) if dari is not None else '...'} s/d "
                     f"{fmt(sampai) if sampai is not None else '...'}")
    if filter_kolom and filter_nilai:
        parts.append(f"{nama(filter_kolom)}: {filter_nilai}")
    return ("Data difilter: " + "; ".join(parts) + ".") if parts else ""


def apply_filters(df, waktu, periode=None, dari=None, sampai=None,
                  filter_kolom=None, filter_nilai=None) -> pd.DataFrame:
    if filter_kolom or filter_nilai:
        if not (filter_kolom and filter_nilai):
            raise ValueError("filter_kolom dan filter_nilai harus diisi bersamaan.")
        _need(df, filter_kolom)
        vals = [v.strip() for v in filter_nilai.split(",") if v.strip()]
        df = df[df[filter_kolom].astype(str).str.strip().isin(vals)]
    if periode is not None or dari is not None or sampai is not None:
        if not waktu:
            raise ValueError("Kolom waktu tidak terdeteksi, filter periode tidak bisa dipakai.")
        mask = pd.Series(True, index=df.index)
        if periode is not None:
            mask &= _labels(df, waktu) == str(periode)
        if dari is not None or sampai is not None:
            num = pd.to_numeric(df[waktu], errors="coerce")
            if num.isna().all():
                raise ValueError("Filter dari/sampai hanya untuk kolom waktu berupa angka (mis. tahun).")
            if dari is not None:
                mask &= num >= dari
            if sampai is not None:
                mask &= num <= sampai
        df = df[mask]
    if df.empty:
        raise ValueError("Tidak ada data yang cocok dengan filter.")
    return df


# ---------- perbandingan antar kelompok ----------
def compare(df, nilai, kelompok, waktu, agg="sum", urut="desc", top=None, ket_filter="") -> dict:
    _need(df, nilai, kelompok)
    if agg not in eda.AGGS:
        raise ValueError(f"agg harus salah satu dari: {', '.join(eda.AGGS)}")
    if urut not in ("asc", "desc"):
        raise ValueError("urut harus asc atau desc.")
    waktu_mode = bool(waktu) and kelompok == waktu
    tmp = pd.DataFrame({"k": _key(df, kelompok, waktu),
                        "v": pd.to_numeric(df[nilai], errors="coerce")}).dropna()
    if tmp.empty:
        raise ValueError(f"Kolom '{nilai}' tidak berisi angka untuk dibandingkan.")
    g = tmp.groupby("k")["v"].agg(agg)
    g = g.sort_index() if waktu_mode else g.sort_values(ascending=(urut == "asc"))
    total = float(g.sum()) if agg == "sum" else None

    data = [{"label": _label(k), "nilai": _f(v),
             "persen_dari_total": _f(v / total * 100) if total else None}
            for k, v in g.items()]
    if top and not waktu_mode:
        data = data[:max(1, top)]

    grafik = ["garis", "batang"] if waktu_mode else ["batang"]
    if not waktu_mode:
        if len(g) > 8:
            grafik = ["batang_horizontal"]
        if agg == "sum" and len(g) <= 8 and (g >= 0).all():
            grafik.append("donut")
    return {
        "nilai": nilai, "kelompok": kelompok, "agg": agg,
        "jumlah_kelompok": len(g), "total": _f(total),
        "rata_rata_per_kelompok": _f(g.mean()),
        "grafik_disarankan": grafik,
        "data": data,
        "deskripsi": _desc_compare(nilai, kelompok, agg, g, total, waktu_mode, ket_filter),
    }


def _desc_compare(nilai, kelompok, agg, g, total, waktu_mode, ket) -> str:
    n, lab = len(g), AGG_LABEL[agg]
    awal = (ket + " ") if ket else ""
    if n == 1:
        return f"{awal}Hanya ada satu {nama(kelompok)}: {_label(g.index[0])} dengan {lab} {nama(nilai)} {fmt(g.iloc[0])}."
    mx, mn = g.idxmax(), g.idxmin()
    if waktu_mode:
        f, l = g.iloc[0], g.iloc[-1]
        growth = (l - f) / abs(f) * 100 if f else None
        arah = "stabil" if growth is None or abs(growth) < 1 else ("naik" if growth > 0 else "turun")
        txt = (f"{lab.capitalize()} {nama(nilai)} dari {_label(g.index[0])} sampai {_label(g.index[-1])} "
               f"cenderung {arah}: {fmt(f)} menjadi {fmt(l)}"
               + (f" ({pct(growth)})" if growth is not None else "") + ". "
               f"Tertinggi pada {_label(mx)} ({fmt(g[mx])}) dan terendah pada {_label(mn)} ({fmt(g[mn])}).")
        return awal + txt
    porsi = f", {pct(g[mx] / total * 100, False)} dari total" if total else ""
    txt = (f"{lab.capitalize()} {nama(nilai)} per {nama(kelompok)}: tertinggi di {_label(mx)} "
           f"({fmt(g[mx])}{porsi}), terendah di {_label(mn)} ({fmt(g[mn])}). "
           f"Rata-rata {fmt(g.mean())} dari {n} {nama(kelompok)}.")
    if total:
        txt += f" Totalnya {fmt(total)}."
    if g[mn] > 0:
        txt += f" {_label(mx)} sekitar {fmt(g[mx] / g[mn], 1)} kali {_label(mn)}."
    return awal + txt


# ---------- perbandingan dua periode ----------
def compare_periode(df, nilai, kelompok, waktu, periode_a, periode_b, agg="sum", ket_filter="") -> dict:
    if not waktu:
        raise ValueError("Kolom waktu tidak terdeteksi.")
    _need(df, nilai, kelompok)
    if kelompok == waktu:
        raise ValueError("kelompok tidak boleh sama dengan kolom waktu.")
    if agg not in eda.AGGS:
        raise ValueError(f"agg harus salah satu dari: {', '.join(eda.AGGS)}")
    lab = _labels(df, waktu)
    res = {}
    for key, p in (("a", periode_a), ("b", periode_b)):
        sub = df[lab == str(p)]
        if sub.empty:
            raise ValueError(f"Tidak ada data untuk periode '{p}'.")
        tmp = pd.DataFrame({"k": sub[kelompok], "v": pd.to_numeric(sub[nilai], errors="coerce")}).dropna()
        res[key] = tmp.groupby("k")["v"].agg(agg)
    both = pd.concat([res["a"].rename("a"), res["b"].rename("b")], axis=1)
    both["selisih"] = both["b"] - both["a"]
    both["persen"] = both["selisih"] / both["a"].abs().replace(0, np.nan) * 100
    both = both.sort_values("selisih", ascending=False, na_position="last")

    data = [{"label": _label(k), "periode_a": _f(r.a), "periode_b": _f(r.b),
             "selisih": _f(r.selisih), "persen": _f(r.persen)} for k, r in both.iterrows()]
    total_a = float(res["a"].sum()) if agg == "sum" else None
    total_b = float(res["b"].sum()) if agg == "sum" else None

    valid = both.dropna(subset=["selisih"])
    naik, turun = valid[valid.selisih > 0], valid[valid.selisih < 0]
    awal = (ket_filter + " ") if ket_filter else ""
    txt = f"Dari {periode_a} ke {periode_b}, "
    if total_a:
        growth = (total_b - total_a) / abs(total_a) * 100
        txt += (f"total {nama(nilai)} {'naik' if growth > 0 else 'turun' if growth < 0 else 'tidak berubah'} "
                f"{pct(abs(growth), False)} ({fmt(total_a)} menjadi {fmt(total_b)}). ")
    else:
        txt += f"{lab_text(agg)} {nama(nilai)} dibandingkan per {nama(kelompok)}. "
    txt += f"{len(naik)} {nama(kelompok)} naik dan {len(turun)} turun."
    if len(naik):
        k = naik.index[0]
        txt += f" Kenaikan terbesar: {k} ({fmt(naik.loc[k, 'selisih'])}"
        txt += f", {pct(naik.loc[k, 'persen'])})." if pd.notna(naik.loc[k, "persen"]) else ")."
    if len(turun):
        k = turun.index[-1]
        txt += f" Penurunan terbesar: {k} ({fmt(turun.loc[k, 'selisih'])}"
        txt += f", {pct(turun.loc[k, 'persen'])})." if pd.notna(turun.loc[k, "persen"]) else ")."
    return {"nilai": nilai, "kelompok": kelompok, "agg": agg,
            "periode_a": str(periode_a), "periode_b": str(periode_b),
            "total_a": _f(total_a), "total_b": _f(total_b),
            "grafik_disarankan": ["batang_berkelompok"], "data": data, "deskripsi": awal + txt}


def lab_text(agg: str) -> str:
    return AGG_LABEL[agg].capitalize()


# ---------- rasio ----------
def ratio(df, pembilang, penyebut, kelompok, waktu, sebagai_persen=False,
          urut="desc", top=None, ket_filter="") -> dict:
    _need(df, pembilang, penyebut, kelompok)
    if urut not in ("asc", "desc"):
        raise ValueError("urut harus asc atau desc.")
    waktu_mode = bool(waktu) and kelompok == waktu
    tmp = pd.DataFrame({"k": _key(df, kelompok, waktu),
                        "p": pd.to_numeric(df[pembilang], errors="coerce"),
                        "d": pd.to_numeric(df[penyebut], errors="coerce")}).dropna()
    if tmp.empty:
        raise ValueError("Tidak ada pasangan data angka untuk dihitung.")
    mult = 100.0 if sebagai_persen else 1.0
    g = tmp.groupby("k")[["p", "d"]].sum()
    g["r"] = g["p"] / g["d"].replace(0, np.nan) * mult
    if g["r"].isna().all():
        raise ValueError("Semua penyebut bernilai 0, rasio tidak bisa dihitung.")
    g = g.sort_index() if waktu_mode else g.sort_values("r", ascending=(urut == "asc"), na_position="last")

    dsum = g["d"].sum()
    overall = float(g["p"].sum() / dsum * mult) if dsum else None
    data = [{"label": _label(k), "pembilang": _f(r.p), "penyebut": _f(r.d), "rasio": _f(r.r),
             "selisih_vs_keseluruhan": _f(r.r - overall) if overall is not None and pd.notna(r.r) else None}
            for k, r in g.iterrows()]
    if top and not waktu_mode:
        data = data[:max(1, top)]

    satuan = "%" if sebagai_persen else "x"
    awal = (ket_filter + " ") if ket_filter else ""
    unit = " %" if sebagai_persen else ""
    arti = ("" if sebagai_persen else
            f", artinya rata-rata {fmt(overall)} {nama(pembilang)} untuk setiap 1 {nama(penyebut)}")
    valid = g["r"].dropna()
    mx, mn = valid.idxmax(), valid.idxmin()
    txt = f"Rasio {nama(pembilang)} terhadap {nama(penyebut)} secara keseluruhan {fmt(overall)}{unit}{arti}. "
    if waktu_mode:
        txt += (f"Dari {_label(g.index[0])} ke {_label(g.index[-1])} rasio berubah dari "
                f"{fmt(g['r'].iloc[0])} menjadi {fmt(g['r'].iloc[-1])}{unit}. ")
    else:
        txt += (f"Tertinggi di {_label(mx)} ({fmt(valid[mx])}{unit}), terendah di {_label(mn)} "
                f"({fmt(valid[mn])}{unit}). ")
        if overall is not None:
            txt += (f"{int((valid > overall).sum())} dari {len(valid)} {nama(kelompok)} "
                    f"berada di atas rasio keseluruhan.")
    sisa = int(g["r"].isna().sum())
    if sisa:
        txt += f" {sisa} {nama(kelompok)} tidak dihitung karena penyebutnya 0."
    return {
        "pembilang": pembilang, "penyebut": penyebut, "kelompok": kelompok, "satuan": satuan,
        "rasio_keseluruhan": _f(overall), "rata_rata_rasio": _f(valid.mean()),
        "grafik_disarankan": ["garis", "batang"] if waktu_mode else ["batang"],
        "data": data, "deskripsi": awal + txt.strip(),
    }