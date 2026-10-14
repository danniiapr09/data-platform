<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    private const AGG = [
        'sum' => 'Total',
        'mean' => 'Rata-rata',
        'median' => 'Median',
        'min' => 'Terkecil',
        'max' => 'Terbesar',
    ];

    public function index(Request $request, int $id)
    {
        $tren = null;
        $galat = null;
        $bins = [];

        try {
            $dataset = FastApi::dataset($id);
            $edaRes = FastApi::http()->get("/datasets/{$id}/eda");

            if ($edaRes->failed()) {
                abort_unless($edaRes->status() === 400, 404);
                return view('dashboard.index', ['id' => $id, 'dataset' => $dataset, 'belumBersih' => true]);
            }

            $eda = $edaRes->json();
            $kandidat = $eda['kandidat_indikator'] ?? [];
            $waktu = $eda['kolom_waktu'] ?? null;

            // kolom teks yang cocok untuk membandingkan kelompok (2 sampai 30 nilai berbeda)
            $kategori = collect($eda['ringkasan']['kategorikal'] ?? [])
                ->filter(fn ($v, $k) => $k !== $waktu && ($v['unik'] ?? 0) >= 2 && ($v['unik'] ?? 0) <= 30)
                ->keys()->all();

            $nilai = in_array($request->query('nilai'), $kandidat, true) ? $request->query('nilai') : ($kandidat[0] ?? null);
            $agg = array_key_exists((string) $request->query('agg'), self::AGG) ? $request->query('agg') : 'sum';
            $kelompok = $request->has('kelompok')
                ? (in_array($request->query('kelompok'), $kategori, true) ? $request->query('kelompok') : null)
                : ($kategori[0] ?? null);

            if ($nilai) {
                $param = ['nilai' => $nilai, 'agg' => $agg];
                if ($kelompok) {
                    $param['group_by'] = $kelompok;
                }
                $r = FastApi::http()->get("/datasets/{$id}/eda/trend", $param);
                if ($r->successful()) {
                    $tren = $r->json();
                } else {
                    $galat = FastApi::pesan($r, 'Data belum bisa dihitung untuk pilihan ini.');
                }

                $d = FastApi::http()->get("/datasets/{$id}/eda/distribution", ['kolom' => $nilai, 'bins' => 10]);
                $bins = $d->successful() ? ($d->json('bins') ?? []) : [];
            }
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.show', $id)->with('gagal', FastApi::OFFLINE);
        }

        $periode = [];
        $seri = [];
        $total = null;
        if ($tren) {
            $titik = $tren['total']['titik'] ?? [];
            $periode = array_map(fn ($t) => (string) $t['periode'], $titik);
            $total = [
                'nilai' => array_map(fn ($t) => $t['nilai'], $titik),
                'tumbuh' => array_map(fn ($t) => $t['pertumbuhan_persen'] ?? null, $titik),
                'arah' => $tren['total']['arah'] ?? null,
            ];
            foreach ($tren['per_kelompok'] ?? [] as $namaKelompok => $g) {
                $peta = [];
                foreach ($g['titik'] ?? [] as $t) {
                    $peta[(string) $t['periode']] = ['n' => $t['nilai'], 'g' => $t['pertumbuhan_persen'] ?? null];
                }
                $seri[] = [
                    'nama' => (string) $namaKelompok,
                    'arah' => $g['arah'] ?? null,
                    'nilai' => array_map(fn ($p) => $peta[$p]['n'] ?? null, $periode),
                    'tumbuh' => array_map(fn ($p) => $peta[$p]['g'] ?? null, $periode),
                ];
            }
        }

        return view('dashboard.index', [
            'id' => $id,
            'dataset' => $dataset,
            'belumBersih' => false,
            'kandidat' => $kandidat,
            'kategori' => $kategori,
            'nilai' => $nilai,
            'agg' => $agg,
            'kelompok' => $kelompok,
            'aggPilihan' => self::AGG,
            'galat' => $galat,
            'payload' => [
                'nilai' => $nilai,
                'agg' => $agg,
                'aggLabel' => self::AGG[$agg],
                'kelompok' => $kelompok,
                'periode' => $periode,
                'seri' => $seri,
                'total' => $total,
                'bins' => $bins,
            ],
        ]);
    }
}