<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;

class RiwayatController extends Controller
{
    private const BERKAS = [
        'xlsx' => [
            'path' => 'export/xlsx',
            'nama' => 'laporan-dataset-%d.xlsx',
            'tipe' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        'forecast' => [
            'path' => 'export/forecast.csv',
            'nama' => 'prediksi-dataset-%d.csv',
            'tipe' => 'text/csv',
        ],
    ];

    public function index(int $id)
    {
        try {
            $dataset = FastApi::dataset($id);
            $res = FastApi::http()->get("/datasets/{$id}/history");
            abort_if($res->failed(), 404);
            $lr = FastApi::http()->get("/datasets/{$id}/clean-report");
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.show', $id)->with('gagal', FastApi::OFFLINE);
        }

        $json = $res->json() ?? [];
        $riwayat = array_is_list($json) ? $json : ($json['riwayat'] ?? $json['history'] ?? $json['items'] ?? []);
        // catatan teknis laporan kualitas tidak perlu ditampilkan di riwayat
        $riwayat = array_values(array_filter($riwayat, fn ($r) => ($r['langkah'] ?? '') !== 'cleaning_report'));
        usort($riwayat, fn ($a, $b) => strcmp($b['waktu'] ?? '', $a['waktu'] ?? ''));

        $laporan = null;
        if ($lr->successful()) {
            $j = $lr->json() ?? [];
            $laporan = $j['laporan'] ?? $j;
        }

        return view('riwayat.index', [
            'id' => $id,
            'dataset' => $dataset,
            'riwayat' => $riwayat,
            'laporan' => $laporan,
            'mentah' => $json,
        ]);
    }

    public function unduh(int $id, string $jenis)
    {
        $b = self::BERKAS[$jenis] ?? abort(404);

        try {
            $res = FastApi::http()->get("/datasets/{$id}/{$b['path']}");
        } catch (ConnectionException $e) {
            return back()->with('gagal', FastApi::OFFLINE);
        }

        if ($res->failed()) {
            return back()->with('gagal', FastApi::pesan($res, 'Berkas belum bisa dibuat. Pastikan data sudah dibersihkan dan prediksi sudah dibuat.'));
        }

        return response($res->body(), 200, [
            'Content-Type' => $res->header('Content-Type') ?: $b['tipe'],
            'Content-Disposition' => $res->header('Content-Disposition')
                ?: 'attachment; filename="'.sprintf($b['nama'], $id).'"',
        ]);
    }
}
