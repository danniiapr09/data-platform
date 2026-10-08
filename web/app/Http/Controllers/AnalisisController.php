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
            $eda = FastApi::http()->get("/datasets/{$id}/eda");

            if ($eda->failed()) {
                abort_unless($eda->status() === 400, 404);
                return view('analisis.index', ['id' => $id, 'dataset' => $dataset, 'belumBersih' => true]);
            }

            $kandidat = $eda->json('kandidat_indikator') ?? [];
            $nilai = $request->query('nilai', $kandidat[0] ?? null);
            $agg = in_array($request->query('agg'), ['sum', 'mean'], true) ? $request->query('agg') : 'sum';

            $tren = null;
            $galat = null;
            if ($nilai) {
                $r = FastApi::http()->get("/datasets/{$id}/eda/trend", ['nilai' => $nilai, 'agg' => $agg]);
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

        // hasil prediksi terakhir dipakai hanya kalau cocok dengan pilihan saat ini
        $prediksi = session("prediksi.{$id}");
        if ($prediksi && (($prediksi['indikator'] ?? null) !== $nilai || ($prediksi['agg'] ?? null) !== $agg)) {
            $prediksi = null;
        }

        $grafik = null;
        if ($tren) {
            $titik = $tren['total']['titik'] ?? [];
            $labels = array_map(fn ($t) => (string) $t['periode'], $titik);
            $aktual = array_map(fn ($t) => $t['nilai'], $titik);
            $bawah = $atas = $garis = array_fill(0, count($titik), null);

            if ($prediksi && $titik) {
                $n = count($titik);
                $bawah[$n - 1] = $atas[$n - 1] = $garis[$n - 1] = $aktual[$n - 1];
                foreach ($prediksi['prediksi'] as $p) {
                    $labels[] = (string) $p['periode'];
                    $aktual[] = null;
                    $garis[] = $p['nilai'];
                    $bawah[] = $p['bawah'];
                    $atas[] = $p['atas'];
                }
            }
            $grafik = compact('labels', 'aktual', 'garis', 'bawah', 'atas');
        }

        return view('analisis.index', [
            'id' => $id,
            'dataset' => $dataset,
            'belumBersih' => false,
            'kandidat' => $kandidat,
            'nilai' => $nilai,
            'agg' => $agg,
            'tren' => $tren,
            'galat' => $galat,
            'prediksi' => $prediksi,
            'grafik' => $grafik,
        ]);
    }

    public function prediksi(Request $request, int $id)
    {
        $data = $request->validate([
            'nilai' => 'required|string',
            'agg' => 'required|in:sum,mean',
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
            ->route('analisis.index', ['id' => $id, 'nilai' => $data['nilai'], 'agg' => $data['agg']])
            ->with('sukses', 'Prediksi berhasil dibuat.');
    }
}
