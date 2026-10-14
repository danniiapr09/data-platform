<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;

class AnomaliController extends Controller
{
    public function index(Request $request, int $id)
    {
        $by = $request->query('kelompok') === 'kolom' ? 'kolom' : 'jenis';
        $grup = $request->query('grup');
        $filter = in_array($request->query('status'), ['pending', 'diterima', 'ditolak', 'diperbaiki'], true)
            ? $request->query('status') : null;
        $catatan = null;

        try {
            $dataset = FastApi::dataset($id);
            $sum = FastApi::http()->get("/datasets/{$id}/anomalies/summary", ['group_by' => $by]);
            if ($sum->failed() && $by !== 'jenis') {
                $catatan = "Pengelompokan per {$by} belum didukung layanan data, jadi ditampilkan per jenis.";
                $by = 'jenis';
                $grup = null;
                $sum = FastApi::http()->get("/datasets/{$id}/anomalies/summary", ['group_by' => 'jenis']);
            }
            $res = FastApi::http()->get("/datasets/{$id}/anomalies/items", ['limit' => 200]);
            if ($res->failed()) {
                $res = FastApi::http()->get("/datasets/{$id}/anomalies/items");
            }
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.show', $id)->with('gagal', FastApi::OFFLINE);
        }

        $ringkasan = $sum->successful() ? $sum->json() : null;
        $semua = $res->successful() ? ($res->json('data') ?? []) : [];
        $totalServer = $res->successful() ? ($res->json('total') ?? count($semua)) : 0;

        $items = collect($semua)
            ->when($grup, fn ($c) => $c->filter(fn ($a) => ($a[$by] ?? null) === $grup))
            ->when($filter, fn ($c) => $c->filter(fn ($a) => ($a['status'] ?? 'pending') === $filter))
            ->values()
            ->all();

        $hitung = ['pending' => 0, 'diterima' => 0, 'ditolak' => 0, 'diperbaiki' => 0];
        foreach (($ringkasan['per_status'] ?? []) as $s => $n) {
            $hitung[$s] = $n;
        }

        return view('anomali.index', [
            'id' => $id,
            'dataset' => $dataset,
            'ringkasan' => $ringkasan,
            'kelompokList' => $ringkasan['kelompok'] ?? [],
            'total' => $ringkasan['total'] ?? 0,
            'hitung' => $hitung,
            'by' => $by,
            'grup' => $grup,
            'filter' => $filter,
            'items' => $items,
            'terpotong' => $totalServer > count($semua),
            'catatan' => $catatan,
        ]);
    }

    public function update(Request $request, int $anomali)
    {
        $status = $request->validate([
            'status' => 'required|in:pending,diterima,ditolak',
        ])['status'];

        try {
            $res = FastApi::http()->patch("/anomalies/{$anomali}", ['status' => $status]);
        } catch (ConnectionException $e) {
            return back()->with('gagal', FastApi::OFFLINE);
        }

        if ($res->failed()) {
            return back()->with('gagal', FastApi::pesan($res, 'Status anomali belum bisa diubah.'));
        }
        return back();
    }

    public function terapkan(int $id)
    {
        try {
            $res = FastApi::http()->post("/datasets/{$id}/apply-review");
        } catch (ConnectionException $e) {
            return back()->with('gagal', FastApi::OFFLINE);
        }

        if ($res->status() === 404 && $res->json('detail') === 'Not Found') {
            return back()->with('gagal', 'Fitur terapkan review belum ada di layanan data. Minta tim backend menggabungkan endpoint apply-review.');
        }
        if ($res->failed()) {
            return back()->with('gagal', FastApi::pesan($res, 'Hasil review belum bisa diterapkan.'));
        }

        $r = $res->json();
        $pesan = ($r['diterapkan'] ?? false)
            ? "Hasil review diterapkan: {$r['baris_dibuang']} baris dibuang, tersimpan sebagai versi {$r['versi_baru']}."
            : ($r['pesan'] ?? 'Tidak ada baris yang perlu dibuang.');

        return back()->with('sukses', $pesan);
    }
}
