<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;

class StatistikController extends Controller
{
    public function index(Request $request, int $id)
    {
        try {
            $dataset = FastApi::dataset($id);
            $res = FastApi::http()->get("/datasets/{$id}/eda");

            if ($res->failed()) {
                abort_unless($res->status() === 400, 404);
                return view('statistik.index', ['id' => $id, 'dataset' => $dataset, 'belumBersih' => true]);
            }

            $eda = $res->json();
            $kandidat = $eda['kandidat_indikator'] ?? [];
            $kolom = $request->query('kolom');
            $kolom = in_array($kolom, $kandidat, true) ? $kolom : ($kandidat[0] ?? null);

            $dist = null;
            if ($kolom) {
                $d = FastApi::http()->get("/datasets/{$id}/eda/distribution", ['kolom' => $kolom, 'bins' => 10]);
                $dist = $d->successful() ? $d->json() : null;
            }
        } catch (ConnectionException $e) {
            return redirect()->route('datasets.show', $id)->with('gagal', FastApi::OFFLINE);
        }

        return view('statistik.index', [
            'id' => $id,
            'dataset' => $dataset,
            'belumBersih' => false,
            'eda' => $eda,
            'kandidat' => $kandidat,
            'kolom' => $kolom,
            'dist' => $dist,
        ]);
    }
}
