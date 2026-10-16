@extends('layouts.app')
@section('title', 'Beranda')

@section('content')
@php
    $urut = ['uploaded' => 1, 'cleaned' => 2, 'forecasted' => 3];
@endphp

{{-- Hero bergradien + tombol unggah --}}
{{--
    $hitung dikonfirmasi dari BerandaController:
      $hitung[1] = jumlah dataset berstatus 'uploaded'
      $hitung[2] = jumlah dataset berstatus 'cleaned'
      $hitung[3] = jumlah dataset berstatus 'forecasted'
    Tidak ada kalkulasi ulang di view.
--}}
<x-halaman-header
    judul="Beranda"
    :deskripsi="$total > 0 ? $total . ' dataset terdaftar.' : 'Belum ada dataset. Unggah file pertama untuk memulai.'"
    :gradien="true"
>
    <x-tombol varian="terang" href="{{ route('datasets.index') }}">
        Unggah dataset
    </x-tombol>
</x-halaman-header>

{{-- Notifikasi offline --}}
@if ($offline)
    <x-notifikasi
        tipe="peringatan"
        pesan="Layanan data tidak bisa dihubungi. Pastikan Docker sudah menyala, lalu muat ulang halaman."
        class="mb-6"
    />
@endif

{{-- Kartu metrik: satu kolom di mobile (360px aman), tiga kolom mulai sm --}}
{{-- Pilihan: grid-cols-1 sm:grid-cols-3 — angka informatif lebih baik ditumpuk daripada digeser --}}
<div class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
    <x-kartu-metrik
        :nilai="$hitung[1]"
        label="Baru diunggah"
        varian="abu"
        ikon-path="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
    />
    <x-kartu-metrik
        :nilai="$hitung[2]"
        label="Sudah dibersihkan"
        varian="brand"
        ikon-path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
    <x-kartu-metrik
        :nilai="$hitung[3]"
        label="Sudah diprediksi"
        varian="hijau"
        ikon-path="M13 10V3L4 14h7v7l9-11h-7z"
    />
</div>

{{-- Bagian: Anomali perlu ditinjau --}}
<section class="mb-8">
    <h2 class="mb-3 text-base font-semibold text-ink">Perlu ditinjau</h2>
    @if (count($perluDitinjau))
        <x-kartu padding="tanpa-padding">
            <ul class="divide-y divide-line" role="list">
                @foreach ($perluDitinjau as $p)
                    <li class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div>
                            <div class="font-semibold text-ink">{{ $p['nama'] }}</div>
                            <div class="text-sm text-slate-600">{{ $p['jumlah'] }} anomali menunggu review</div>
                        </div>
                        <x-tombol
                            varian="ghost"
                            href="{{ route('anomali.index', ['id' => $p['id'], 'status' => 'pending']) }}"
                        >
                            Tinjau anomali
                        </x-tombol>
                    </li>
                @endforeach
            </ul>
        </x-kartu>
    @else
        <x-keadaan-kosong judul="Tidak ada anomali yang menunggu review." />
    @endif
</section>

{{-- Bagian: Dataset terbaru --}}
<section>
    <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-base font-semibold text-ink">Dataset terbaru</h2>
        <a href="{{ route('datasets.index') }}" class="text-sm font-medium text-brand-700 hover:underline">
            Lihat semua
        </a>
    </div>
    @if (count($terbaru))
        <x-kartu padding="tanpa-padding">
            <ul class="divide-y divide-line" role="list">
                @foreach ($terbaru as $d)
                    @php
                        $did    = $d['id'] ?? $d['dataset_id'] ?? 0;
                        $status = $d['status'] ?? 'uploaded';
                    @endphp
                    <li>
                        {{-- hover mengangkat: motion-safe: agar dihormati prefers-reduced-motion --}}
                        <a href="{{ route('datasets.show', $did) }}"
                           class="flex flex-wrap items-center justify-between gap-3 px-5 py-4
                                  transition-all duration-150
                                  hover:bg-brand-50/60
                                  motion-safe:hover:-translate-y-px motion-safe:hover:shadow-card">
                            <span class="font-semibold text-ink">{{ $d['nama'] ?? 'Dataset #'.$did }}</span>
                            <x-badge :status="$status" />
                        </a>
                    </li>
                @endforeach
            </ul>
        </x-kartu>
    @else
        <x-keadaan-kosong
            judul="Belum ada dataset."
            deskripsi="Unggah file CSV atau Excel untuk memulai pengolahan data."
        >
            <x-tombol href="{{ route('datasets.index') }}">
                Unggah dataset pertama
            </x-tombol>
        </x-keadaan-kosong>
    @endif
</section>
@endsection
