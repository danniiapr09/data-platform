<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;

class AnalisisController extends Controller
{
    public function index(Request $request, int $id)
    {
        try {
            $dataset = FastApi::dataset($id);
            $edaRes = FastApi::http()->get("/datasets/{$id}/eda");

            if ($edaRes->failed()) {
                abort_unless($edaRes->status() === 400, 404);
                return view('analisis.index', ['id' => $id, 'dataset' => $dataset, 'belumBersih' => true]);
            }

            $eda = $edaRes->json();
            $kandidat = $eda['kandidat_indikator'] ?? [];
            $waktu = $eda['kolom_waktu'] ?? null;

            // kolom teks yang cocok untuk membandingkan kelompok (2 sampai 30 nilai berbeda)
            $kategori = collect($eda['ringkasan']['kategorikal'] ?? [])
                ->filter(fn ($v, $k) => $k !== $waktu && ($v['unik'] ?? 0) >= 2 && ($v['unik'] ?? 0) <= 30)
                ->keys()->all();

            $nilai = $request->query('nilai', $kandidat[0] ?? null);
            $agg = in_array($request->query('agg'), ['sum', 'mean'], true) ? $request->query('agg') : 'sum';
            $kelompok = in_array($request->query('kelompok'), $kategori, true) ? $request->query('kelompok') : null;

            $tren = null;
            $galat = null;
            if ($nilai) {
                $param = ['nilai' => $nilai, 'agg' => $agg];
                if ($kelompok) {
                    $param['group_by'] = $kelompok;
                }
                $r = FastApi::http()->get("/datasets/{$id}/eda/trend", $param);
                if ($r->successful()) {
                    $tren = $r->json();
                } else {
                    $detail = $r->json('detail');
                    $galat = is_string($detail) ? $detail : 'Tren belum bisa dihitung untuk kolom ini.';
                }
            }
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.show', $id)->with('gagal', FastApi::OFFLINE);
        }

        // hasil prediksi: periksa session dulu, lalu fallback ke database backend
        $prediksi = session("prediksi.{$id}");
        if ($prediksi && (($prediksi['indikator'] ?? null) !== $nilai || ($prediksi['agg'] ?? null) !== $agg)) {
            $prediksi = null;
        }

        $prediksiTersimpanLain = null;

        if (! $prediksi) {
            $backendForecast = FastApi::forecast($id);
            if ($backendForecast) {
                $first = $backendForecast[0] ?? [];
                $indikatorTersimpan = $first['indikator'] ?? null;

                if ($indikatorTersimpan === $nilai) {
                    $prediksi = [
                        'indikator' => $indikatorTersimpan,
                        'model_terbaik' => $first['model'] ?? 'unknown',
                        'mae' => $first['mae'] ?? null,
                        'mape' => $first['mape'] ?? null,
                        'dibuat' => $first['dibuat'] ?? null,
                        'dari_backend' => true,
                        'prediksi' => array_map(fn ($r) => [
                            'periode' => $r['periode'],
                            'nilai' => $r['nilai_prediksi'],
                            'bawah' => null,
                            'atas' => null,
                        ], $backendForecast),
                    ];
                } elseif ($indikatorTersimpan) {
                    // Indikator tersimpan berbeda dengan nilai yang sedang dibuka
                    $prediksiTersimpanLain = [
                        'indikator' => $indikatorTersimpan,
                        'dibuat' => $first['dibuat'] ?? null,
                    ];
                }
            }
        }

        $grafik = null;
        $grafikKelompok = null;
        if ($tren) {
            $titik = $tren['total']['titik'] ?? [];
            $labels = array_map(fn ($t) => (string) $t['periode'], $titik);
            $aktual = array_map(fn ($t) => $t['nilai'], $titik);
            $bawah = $atas = $garis = array_fill(0, count($titik), null);

            $adaKisaran = false;
            if ($prediksi && $titik) {
                $n = count($titik);
                $garis[$n - 1] = $aktual[$n - 1];
                if (! empty($prediksi['prediksi'][0]['bawah']) || ! empty($prediksi['prediksi'][0]['atas'])) {
                    $adaKisaran = true;
                    $bawah[$n - 1] = $atas[$n - 1] = $aktual[$n - 1];
                }
                foreach ($prediksi['prediksi'] as $p) {
                    $labels[] = (string) $p['periode'];
                    $aktual[] = null;
                    $garis[] = $p['nilai'];
                    $bawah[] = $p['bawah'] ?? null;
                    $atas[] = $p['atas'] ?? null;
                }
            }
            $grafik = compact('labels', 'aktual', 'garis', 'bawah', 'atas', 'adaKisaran');

            if ($kelompok && ! empty($tren['per_kelompok'])) {
                $labelAsli = array_map(fn ($t) => (string) $t['periode'], $titik);
                $seri = [];
                foreach ($tren['per_kelompok'] as $namaKelompok => $g) {
                    $peta = [];
                    foreach ($g['titik'] ?? [] as $t) {
                        $peta[(string) $t['periode']] = $t['nilai'];
                    }
                    $seri[] = [
                        'nama' => (string) $namaKelompok,
                        'arah' => $g['arah'] ?? null,
                        'data' => array_map(fn ($l) => $peta[$l] ?? null, $labelAsli),
                    ];
                }
                $grafikKelompok = ['labels' => $labelAsli, 'seri' => $seri];
            }
        }

        return view('analisis.index', [
            'id' => $id,
            'dataset' => $dataset,
            'belumBersih' => false,
            'kandidat' => $kandidat,
            'kategori' => $kategori,
            'nilai' => $nilai,
            'agg' => $agg,
            'kelompok' => $kelompok,
            'tren' => $tren,
            'galat' => $galat,
            'prediksi' => $prediksi,
            'prediksiTersimpanLain' => $prediksiTersimpanLain,
            'grafik' => $grafik,
            'grafikKelompok' => $grafikKelompok,
        ]);
    }

    public function prediksi(Request $request, int $id)
    {
        $data = $request->validate([
            'nilai' => 'required|string',
            'agg' => 'required|in:sum,mean',
            'kelompok' => 'nullable|string',
            'horizon' => 'required|integer|min:1|max:12',
        ], ['horizon.*' => 'Isi jumlah periode antara 1 dan 12.']);

        try {
            $res = FastApi::http()->post("/datasets/{$id}/forecast", [
                'nilai' => $data['nilai'],
                'agg' => $data['agg'],
                'horizon' => (int) $data['horizon'],
            ]);
        } catch (ConnectionException $e) {
            return back()->with('gagal', FastApi::OFFLINE);
        }

        if ($res->failed()) {
            $detail = $res->json('detail');
            return back()->with('gagal', is_string($detail) ? $detail : 'Prediksi belum bisa dibuat.');
        }

        $hasil = $res->json();
        $hasil['agg'] = $data['agg'];
        session()->put("prediksi.{$id}", $hasil);

        return redirect()
            ->route('analisis.index', array_filter([
                'id' => $id,
                'nilai' => $data['nilai'],
                'agg' => $data['agg'],
                'kelompok' => $data['kelompok'] ?? null,
            ]))
            ->with('sukses', 'Prediksi berhasil dibuat.');
    }
}
