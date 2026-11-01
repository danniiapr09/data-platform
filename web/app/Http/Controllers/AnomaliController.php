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
        $page = max(1, (int) $request->query('page', 1));
        $limit = 50;
        $offset = ($page - 1) * $limit;
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

            // Teruskan filter ke backend dan terapkan paginasi (A1)
            $itemParams = [
                'limit' => $limit,
                'offset' => $offset,
            ];
            if ($filter) {
                $itemParams['status'] = $filter;
            }
            if ($grup) {
                if ($by === 'jenis') {
                    $itemParams['jenis'] = $grup;
                } else {
                    $itemParams['kolom'] = $grup;
                }
            }

            $res = FastApi::http()->get("/datasets/{$id}/anomalies/items", $itemParams);
            if ($res->failed()) {
                $res = FastApi::http()->get("/datasets/{$id}/anomalies/items");
            }
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.show', $id)->with('gagal', FastApi::OFFLINE);
        }

        $ringkasan = $sum->successful() ? $sum->json() : null;
        $items = $res->successful() ? ($res->json('data') ?? []) : [];
        $totalFiltered = $res->successful() ? ($res->json('total') ?? count($items)) : 0;
        $totalPages = max(1, (int) ceil($totalFiltered / $limit));

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
            'totalFiltered' => $totalFiltered,
            'page' => $page,
            'totalPages' => $totalPages,
            'limit' => $limit,
            'hitung' => $hitung,
            'by' => $by,
            'grup' => $grup,
            'filter' => $filter,
            'items' => $items,
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

    /**
     * Review massal anomali (A3).
     */
    public function reviewMassal(Request $request, int $id)
    {
        $status = $request->validate([
            'status' => 'required|in:diterima,ditolak,pending',
            'jenis' => 'nullable|string',
            'kolom' => 'nullable|string',
            'semua' => 'nullable|boolean',
        ])['status'];

        $payload = [
            'status' => $status,
            'dari_status' => 'pending',
        ];
        if ($request->filled('jenis')) {
            $payload['jenis'] = $request->input('jenis');
        }
        if ($request->filled('kolom')) {
            $payload['kolom'] = $request->input('kolom');
        }
        if ($request->boolean('semua') || (empty($payload['jenis']) && empty($payload['kolom']))) {
            $payload['semua'] = true;
        }

        try {
            $res = FastApi::http()->post("/datasets/{$id}/anomalies/review", $payload);
        } catch (ConnectionException $e) {
            return back()->with('gagal', FastApi::OFFLINE);
        }

        if ($res->failed()) {
            return back()->with('gagal', FastApi::pesan($res, 'Review massal belum bisa diproses.'));
        }

        $r = $res->json() ?? [];
        $diubah = $r['jumlah_diubah'] ?? 0;
        $statusTeks = match($status) {
            'diterima' => 'diterima',
            'ditolak' => 'ditolak',
            default => 'menunggu review',
        };

        return back()->with('sukses', "{$diubah} anomali berhasil ditandai sebagai {$statusTeks}.");
    }

    /**
     * Terapkan hasil review (A4).
     */
    public function terapkan(int $id)
    {
        if (! config('fitur.apply_review', false)) {
            return back()->with('info', 'Fitur terapkan review sedang disiapkan.');
        }

        try {
            $res = FastApi::http()->post("/datasets/{$id}/apply-review");
        } catch (ConnectionException $e) {
            return back()->with('gagal', FastApi::OFFLINE);
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
