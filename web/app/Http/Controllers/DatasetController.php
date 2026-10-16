<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;

class DatasetController extends Controller
{
    public function index()
    {
        $datasets = [];
        $offline = false;
        try {
            $datasets = FastApi::daftar();
        } catch (ConnectionException $e) {
            $offline = true;
        }
        return view('datasets.index', compact('datasets', 'offline'));
    }

    public function store(Request $request)
    {
        $data = $request->validate(
            [
                'file' => 'required|file|max:10240',
                'nama' => 'nullable|string|max:150',
                'jenis' => 'nullable|string|max:50',
            ],
            [
                'file.required' => 'Pilih file CSV atau Excel terlebih dahulu.',
                'file.max' => 'Ukuran file maksimal 10 MB.',
                'nama.max' => 'Nama dataset maksimal 150 huruf.',
                'jenis.max' => 'Jenis data maksimal 50 huruf.',
            ]
        );
        $file = $request->file('file');
        $isian = array_filter(
            ['nama' => $data['nama'] ?? null, 'jenis' => $data['jenis'] ?? null],
            fn ($v) => filled($v)
        );

        try {
            $res = FastApi::http()
                ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName())
                ->post('/datasets/upload', $isian);
        } catch (ConnectionException $e) {
            return back()->withErrors(['file' => FastApi::OFFLINE]);
        }

        if ($res->failed()) {
            return back()->withErrors([
                'file' => FastApi::pesan($res, 'File tidak bisa diproses. Periksa formatnya (CSV atau Excel).'),
            ]);
        }

        return redirect()->route('datasets.show', $res->json('dataset_id'))
            ->with('sukses', 'Dataset berhasil diunggah.');
    }

    public function show(int $id)
    {
        try {
            $dataset = FastApi::dataset($id);
            $status = $dataset['status'] ?? 'uploaded';
            $bersih = in_array($status, ['cleaned', 'forecasted']);

            $res = FastApi::http()->get(
                $bersih ? "/datasets/{$id}/clean-preview" : "/datasets/{$id}/preview",
                ['limit' => 50]
            );

            // laporan kualitas: dari hasil pembersihan barusan, atau diambil dari server
            $laporan = session('laporan');
            if (! $laporan && $bersih) {
                $lr = FastApi::http()->get("/datasets/{$id}/clean-report");
                if ($lr->successful()) {
                    $j = $lr->json() ?? [];
                    $laporan = $j['laporan'] ?? $j;
                }
            }
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.index')->with('gagal', FastApi::OFFLINE);
        }
        abort_if($res->failed(), 404);

        $data = $res->json() ?? [];
        $rows = $data['preview'] ?? $data['rows'] ?? $data['data'] ?? (array_is_list($data) ? $data : []);
        $rows = array_map(fn ($r) => $r['row_json'] ?? $r, $rows);
        $columns = $rows ? array_keys($rows[0]) : [];

        return view('datasets.show', [
            'id' => $id,
            'nama' => $dataset['nama'] ?? "Dataset #{$id}",
            'status' => $status,
            'bersih' => $bersih,
            'rows' => $rows,
            'columns' => $columns,
            'laporan' => $laporan,
            'mentah' => $data,
        ]);
    }

    public function clean(Request $request, int $id)
    {
        $timpa = $request->boolean('timpa');

        try {
            $param = $timpa ? ['timpa' => 'true'] : [];
            $res = FastApi::http()->post("/datasets/{$id}/clean", $param);
        } catch (ConnectionException $e) {
            return back()->with('gagal', FastApi::OFFLINE);
        }

        if ($res->status() === 409) {
            return back()->with('konfirmasi_timpa', true);
        }

        if ($res->status() === 400) {
            return back()->with('gagal', 'Dataset tidak memiliki data mentah untuk dibersihkan.');
        }

        if ($res->failed()) {
            return back()->with('gagal', FastApi::pesan($res, 'Data belum bisa dibersihkan. Silakan coba beberapa saat lagi.'));
        }

        return back()
            ->with('sukses', 'Data berhasil dibersihkan.')
            ->with('laporan', $res->json('laporan'));
    }
}
