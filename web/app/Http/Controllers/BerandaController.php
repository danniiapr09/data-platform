<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;

class BerandaController extends Controller
{
    public function index()
    {
        $datasets = [];
        $perluDitinjau = [];
        $offline = false;

        try {
            $datasets = FastApi::daftar();

            // anomali yang menunggu review: cek 10 dataset terbaru yang sudah dibersihkan
            $sudahBersih = array_filter($datasets, fn ($d) => in_array($d['status'] ?? '', ['cleaned', 'forecasted']));
            foreach (array_slice($sudahBersih, 0, 10) as $d) {
                $did = $d['id'] ?? $d['dataset_id'] ?? 0;
                $res = FastApi::http()->get("/datasets/{$did}/anomalies", ['status' => 'pending']);
                $jumlah = $res->successful() ? count($res->json() ?? []) : 0;
                if ($jumlah > 0) {
                    $perluDitinjau[] = ['id' => $did, 'nama' => $d['nama'] ?? "Dataset #{$did}", 'jumlah' => $jumlah];
                }
            }
        } catch (ConnectionException $e) {
            $offline = true;
        }

        $urut = ['uploaded' => 1, 'cleaned' => 2, 'forecasted' => 3];
        $hitung = [1 => 0, 2 => 0, 3 => 0];
        foreach ($datasets as $d) {
            $hitung[$urut[$d['status'] ?? 'uploaded'] ?? 1]++;
        }

        return view('beranda', [
            'terbaru' => array_slice($datasets, 0, 5),
            'total' => count($datasets),
            'hitung' => $hitung,
            'perluDitinjau' => $perluDitinjau,
            'offline' => $offline,
        ]);
    }
}
