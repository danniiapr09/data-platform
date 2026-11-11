<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class FastApi
{
    public const OFFLINE = 'Layanan data tidak bisa dihubungi. Pastikan Docker sudah menyala, lalu muat ulang halaman.';

    public static function http()
    {
        return Http::baseUrl(config('services.fastapi.url'))->acceptJson()->timeout(120);
    }

    /** Semua dataset, terbaru di atas. */
    public static function daftar(): array
    {
        $json = self::http()->get('/datasets')->json() ?? [];
        if (! array_is_list($json)) {
            $json = $json['datasets'] ?? $json['items'] ?? [];
        }
        return collect($json)
            ->sortByDesc(fn ($d) => $d['id'] ?? $d['dataset_id'] ?? 0)
            ->values()
            ->all();
    }

    /** Data satu dataset dari endpoint detail FastAPI (dengan fallback ke daftar). */
    public static function dataset(int $id): array
    {
        try {
            $res = self::http()->get("/datasets/{$id}");
            if ($res->successful()) {
                return $res->json() ?? [];
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            // fallback
        }

        return collect(self::daftar())
            ->first(fn ($d) => ($d['id'] ?? $d['dataset_id'] ?? null) == $id) ?? [];
    }

    /** Pesan error dari FastAPI (format {"detail": "pesan"}), atau pesan cadangan. */
    public static function pesan($res, string $cadangan): string
    {
        $detail = $res->json('detail');
        return is_string($detail) ? $detail : $cadangan;
    }

    /** Ambil hasil prediksi tersimpan dari backend (null jika belum ada atau offline). */
    public static function forecast(int $id): ?array
    {
        try {
            $res = self::http()->get("/datasets/{$id}/forecast");
            if ($res->successful()) {
                $data = $res->json();
                return is_array($data) && count($data) > 0 ? $data : null;
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return null;
        }
        return null;
    }

    /** Ambil laporan lengkap hasil prediksi tersimpan dari backend (null jika belum ada atau offline). */
    public static function forecastLaporan(int $id): ?array
    {
        try {
            $res = self::http()->get("/datasets/{$id}/forecast/laporan");
            if ($res->successful()) {
                $data = $res->json();
                return is_array($data) ? $data : null;
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return null;
        }
        return null;
    }

    /** Angka ringkasan beranda dari FastAPI (jumlah dataset per status, total anomali pending, 5 dataset teratas). */
    public static function ringkasan(): array
    {
        try {
            $res = self::http()->get('/ringkasan');
            if ($res->successful()) {
                return $res->json() ?? [];
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return [];
        }
        return [];
    }
}
