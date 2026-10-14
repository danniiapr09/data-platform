<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;

class EditController extends Controller
{
    private const JENIS = ['kosong', 'outlier', 'format'];

    public function index(Request $request, int $id)
    {
        $jenis = in_array($request->query('jenis'), self::JENIS, true) ? $request->query('jenis') : null;

        try {
            $dataset = FastApi::dataset($id);
            if (! in_array($dataset['status'] ?? 'uploaded', ['cleaned', 'forecasted'], true)) {
                return view('edit.index', ['id' => $id, 'dataset' => $dataset, 'belumBersih' => true]);
            }

            $res = FastApi::http()->get("/datasets/{$id}/anomalies/items", ['limit' => 200]);
            if ($res->failed()) {
                $res = FastApi::http()->get("/datasets/{$id}/anomalies/items");
            }
            abort_if($res->failed(), 404);

            $riwayat = FastApi::http()->get("/datasets/{$id}/edits", ['limit' => 20]);
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.show', $id)->with('gagal', FastApi::OFFLINE);
        }

        $dataAnomali = $res->json('data') ?? [];
        $totalServer = $res->json('total') ?? count($dataAnomali);

        // satu isian per sel (baris + kolom), gabungkan beberapa anomali di sel yang sama
        $sel = [];
        foreach ($dataAnomali as $a) {
            if (($a['status'] ?? 'pending') !== 'pending') {
                continue;
            }
            if (! in_array($a['jenis'] ?? '', self::JENIS, true)) {
                continue;
            }
            $kunci = $a['row_index'].'|'.$a['kolom'];
            $sel[$kunci] ??= [
                'id' => $a['id'],
                'row_index' => $a['row_index'],
                'baris_file' => $a['baris_di_file_asli'] ?? $a['row_index'],
                'kolom' => $a['kolom'],
                'jenis' => [],
                'alasan' => [],
            ];
            $sel[$kunci]['jenis'][] = $a['jenis'];
            $sel[$kunci]['alasan'][] = preg_replace('/^\[[^\]]+\]\s*/', '', (string) ($a['alasan'] ?? ''));
        }

        $hitung = ['semua' => count($sel), 'kosong' => 0, 'outlier' => 0, 'format' => 0];
        foreach ($sel as $c) {
            foreach (array_unique($c['jenis']) as $j) {
                $hitung[$j]++;
            }
        }

        $sel = collect($sel)
            ->when($jenis, fn ($c) => $c->filter(fn ($x) => in_array($jenis, $x['jenis'], true)))
            ->sortBy('baris_file')
            ->values()
            ->all();

        $r = $riwayat->successful() ? $riwayat->json() : [];

        return view('edit.index', [
            'id' => $id,
            'dataset' => $dataset,
            'belumBersih' => false,
            'sel' => $sel,
            'hitung' => $hitung,
            'jenis' => $jenis,
            'terpotong' => $totalServer > count($dataAnomali),
            'ringkasanEdit' => $r['ringkasan'] ?? null,
            'riwayatEdit' => $r['data'] ?? [],
        ]);
    }

    public function simpan(Request $request, int $id)
    {
        $data = $request->validate([
            'alasan' => 'required|string|max:200',
            'edit' => 'required|array',
            'edit.*.row_index' => 'required|integer|min:0',
            'edit.*.kolom' => 'required|string|max:100',
            'edit.*.nilai' => 'nullable|string|max:100',
        ], [
            'alasan.required' => 'Tulis alasan perubahan supaya riwayatnya jelas.',
            'edit.required' => 'Tidak ada isian yang dikirim.',
        ]);

        $perubahan = [];
        foreach ($data['edit'] as $e) {
            $v = trim((string) ($e['nilai'] ?? ''));
            if ($v === '') {
                continue;
            }
            if (preg_match('/^-?\d+,\d+$/', $v)) {
                $v = str_replace(',', '.', $v);
            }
            $perubahan[] = ['row_index' => (int) $e['row_index'], 'kolom' => $e['kolom'], 'nilai' => $v];
        }

        if (! $perubahan) {
            return back()->withInput()->with('gagal', 'Belum ada nilai yang diisi.');
        }

        try {
            $res = FastApi::http()->patch("/datasets/{$id}/data", [
                'perubahan' => $perubahan,
                'alasan' => $data['alasan'],
            ]);
        } catch (ConnectionException $e) {
            return back()->withInput()->with('gagal', FastApi::OFFLINE);
        }

        if ($res->failed()) {
            return back()->withInput()->with('gagal', FastApi::pesan($res, 'Perubahan belum bisa disimpan. Periksa isiannya.'));
        }

        return back()->with('sukses', count($perubahan).' nilai berhasil disimpan.');
    }
}
