<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class DatasetController extends Controller
{
    private const OFFLINE = 'Layanan data tidak bisa dihubungi. Pastikan Docker sudah menyala, lalu muat ulang halaman.';

    private function api()
    {
        return Http::baseUrl(config('services.fastapi.url'))->acceptJson()->timeout(120);
    }

    /** Daftar dataset dari FastAPI, terbaru di atas. */
    private function daftar(): array
    {
        $json = $this->api()->get('/datasets')->json() ?? [];
        if (! array_is_list($json)) {
            $json = $json['datasets'] ?? $json['items'] ?? [];
        }
        return collect($json)
            ->sortByDesc(fn ($d) => $d['id'] ?? $d['dataset_id'] ?? 0)
            ->values()
            ->all();
    }

    public function index()
    {
        $datasets = [];
        $offline = false;
        try {
            $datasets = $this->daftar();
        } catch (ConnectionException $e) {
            $offline = true;
        }
        return view('datasets.index', compact('datasets', 'offline'));
    }

    public function store(Request $request)
    {
        $request->validate(
            ['file' => 'required|file|max:10240'],
            [
                'file.required' => 'Pilih file CSV atau Excel terlebih dahulu.',
                'file.max' => 'Ukuran file maksimal 10 MB.',
            ]
        );
        $file = $request->file('file');

        try {
            $res = $this->api()
                ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName())
                ->post('/datasets/upload');
        } catch (ConnectionException $e) {
            return back()->withErrors(['file' => self::OFFLINE]);
        }

        if ($res->failed()) {
            $detail = $res->json('detail');
            return back()->withErrors([
                'file' => is_string($detail) ? $detail : 'File tidak bisa diproses. Periksa formatnya (CSV atau Excel).',
            ]);
        }

        return redirect()->route('datasets.show', $res->json('dataset_id'))
            ->with('sukses', 'Dataset berhasil diunggah.');
    }

    public function show(int $id)
    {
        try {
            $dataset = collect($this->daftar())
                ->first(fn ($d) => ($d['id'] ?? $d['dataset_id'] ?? null) == $id) ?? [];
            $status = $dataset['status'] ?? 'uploaded';
            $bersih = in_array($status, ['cleaned', 'forecasted']);

            $res = $this->api()->get($bersih ? "/datasets/{$id}/clean-preview" : "/datasets/{$id}/preview");
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.index')->with('gagal', self::OFFLINE);
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
            'mentah' => $data,
        ]);
    }

    public function clean(int $id)
    {
        try {
            $res = $this->api()->post("/datasets/{$id}/clean");
        } catch (ConnectionException $e) {
            return back()->with('gagal', self::OFFLINE);
        }

        if ($res->failed()) {
            $detail = $res->json('detail');
            return back()->with('gagal', is_string($detail) ? $detail : 'Data belum bisa dibersihkan.');
        }

        return back()
            ->with('sukses', 'Data berhasil dibersihkan.')
            ->with('laporan', $res->json('laporan'));
    }
}
