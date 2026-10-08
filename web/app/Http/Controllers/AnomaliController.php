<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;

class AnomaliController extends Controller
{
    public function index(Request $request, int $id)
    {
        $filter = $request->query('status');
        $filter = in_array($filter, ['pending', 'diterima', 'ditolak'], true) ? $filter : null;

        try {
            $dataset = FastApi::dataset($id);
            $res = FastApi::http()->get("/datasets/{$id}/anomalies");
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.show', $id)->with('gagal', FastApi::OFFLINE);
        }
        abort_if($res->failed(), 404);

        $semua = $res->json() ?? [];
        $hitung = ['pending' => 0, 'diterima' => 0, 'ditolak' => 0];
        foreach ($semua as $a) {
            $s = $a['status'] ?? 'pending';
            if (isset($hitung[$s])) {
                $hitung[$s]++;
            }
        }
        $anomali = $filter
            ? array_values(array_filter($semua, fn ($a) => ($a['status'] ?? 'pending') === $filter))
            : $semua;

        return view('anomali.index', compact('id', 'dataset', 'anomali', 'hitung', 'filter'));
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
            return back()->with('gagal', 'Status anomali belum bisa diubah.');
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
            $detail = $res->json('detail');
            return back()->with('gagal', is_string($detail) ? $detail : 'Hasil review belum bisa diterapkan.');
        }

        $r = $res->json();
        $pesan = ($r['diterapkan'] ?? false)
            ? "Hasil review diterapkan: {$r['baris_dibuang']} baris dibuang, tersimpan sebagai versi {$r['versi_baru']}."
            : ($r['pesan'] ?? 'Tidak ada baris yang perlu dibuang.');

        return back()->with('sukses', $pesan);
    }
}
