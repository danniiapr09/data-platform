<?php

namespace App\Http\Controllers;

use App\Services\FastApi;
use Illuminate\Http\Client\ConnectionException;

class BerandaController extends Controller
{
    public function index()
    {
        $datasets = [];
        $ringkasan = [];
        $offline = false;

        try {
            $datasets = FastApi::daftar();
            $ringkasan = FastApi::ringkasan();
        } catch (ConnectionException $e) {
            $offline = true;
        }

        $perStatus = $ringkasan['per_status'] ?? [];
        $hitung = [
            1 => $perStatus['uploaded'] ?? 0,
            2 => $perStatus['cleaned'] ?? 0,
            3 => $perStatus['forecasted'] ?? 0,
        ];

        // Fallback hitung manual jika ringkasan kosong
        if (empty($perStatus)) {
            $urut = ['uploaded' => 1, 'cleaned' => 2, 'forecasted' => 3];
            foreach ($datasets as $d) {
                $hitung[$urut[$d['status'] ?? 'uploaded'] ?? 1]++;
            }
        }

        $pendingTeratas = $ringkasan['pending_teratas'] ?? [];
        $perluDitinjau = array_map(fn ($p) => [
            'id' => $p['dataset_id'],
            'nama' => $p['nama'],
            'jumlah' => $p['pending'],
        ], $pendingTeratas);

        $total = $ringkasan['jumlah_dataset'] ?? count($datasets);
        $totalAnomaliPending = $ringkasan['anomali_pending'] ?? array_sum(array_column($perluDitinjau, 'jumlah'));

        return view('beranda', [
            'terbaru' => array_slice($datasets, 0, 5),
            'total' => $total,
            'hitung' => $hitung,
            'perluDitinjau' => $perluDitinjau,
            'totalAnomaliPending' => $totalAnomaliPending,
            'offline' => $offline,
        ]);
    }
}
