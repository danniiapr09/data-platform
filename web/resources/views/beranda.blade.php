@extends('layouts.app')
@section('title', 'Beranda')

@section('content')
    @php
        $urut = ['uploaded' => 1, 'cleaned' => 2, 'forecasted' => 3];
        $label = [1 => 'Diunggah', 2 => 'Dibersihkan', 3 => 'Sudah diprediksi'];
    @endphp

    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold">Beranda</h1>
            <p class="mt-1 max-w-xl text-slate-600">
                @if ($total > 0)
                    Ada {{ $total }} dataset: {{ $hitung[1] }} baru diunggah, {{ $hitung[2] }} sudah dibersihkan,
                    dan {{ $hitung[3] }} sudah diprediksi.
                @else
                    Belum ada dataset. Unggah file pertama untuk memulai.
                @endif
            </p>
        </div>
        <a href="{{ route('datasets.index') }}"
           class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            Unggah dataset
        </a>
    </div>

    @if ($offline)
        <div role="alert" class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Layanan data tidak bisa dihubungi. Pastikan Docker sudah menyala, lalu muat ulang halaman.
        </div>
    @endif

    <section class="mb-8">
        <h2 class="mb-3 text-lg font-semibold">Perlu ditinjau</h2>
        @if (count($perluDitinjau))
            <div class="divide-y divide-line rounded-xl border border-line bg-white">
                @foreach ($perluDitinjau as $p)
                    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div>
                            <div class="font-semibold">{{ $p['nama'] }}</div>
                            <div class="text-sm text-slate-600">{{ $p['jumlah'] }} anomali menunggu review</div>
                        </div>
                        <a href="{{ route('anomali.index', ['id' => $p['id'], 'status' => 'pending']) }}"
                           class="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                            Tinjau anomali
                        </a>
                    </div>
                @endforeach
            </div>
        @else
            <div class="rounded-xl border border-line bg-white px-5 py-6 text-sm text-slate-600">
                Tidak ada anomali yang menunggu review.
            </div>
        @endif
    </section>

    <section>
        <div class="mb-3 flex items-baseline justify-between">
            <h2 class="text-lg font-semibold">Dataset terbaru</h2>
            <a href="{{ route('datasets.index') }}" class="text-sm font-medium text-brand-700 hover:underline">Lihat semua</a>
        </div>
        @if (count($terbaru))
            <div class="divide-y divide-line rounded-xl border border-line bg-white">
                @foreach ($terbaru as $d)
                    @php
                        $did = $d['id'] ?? $d['dataset_id'] ?? 0;
                        $n = $urut[$d['status'] ?? 'uploaded'] ?? 1;
                    @endphp
                    <a href="{{ route('datasets.show', $did) }}" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-brand-50/60">
                        <span class="font-semibold">{{ $d['nama'] ?? 'Dataset #'.$did }}</span>
                        <span class="flex items-center gap-3">
                            <span class="flex gap-1" aria-hidden="true">
                                @for ($i = 1; $i <= 3; $i++)
                                    <span class="h-1.5 w-6 rounded-full {{ $i <= $n ? 'bg-brand-600' : 'bg-line' }}"></span>
                                @endfor
                            </span>
                            <span class="text-sm font-medium text-brand-700">{{ $label[$n] }}</span>
                        </span>
                    </a>
                @endforeach
            </div>
        @else
            <div class="rounded-xl border border-line bg-white px-5 py-6 text-sm text-slate-600">Belum ada dataset.</div>
        @endif
    </section>
@endsection
