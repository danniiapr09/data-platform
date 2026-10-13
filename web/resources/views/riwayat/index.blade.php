@extends('layouts.app')
@section('title', 'Riwayat dan unduhan')

@section('content')
    @php
        $nama = $dataset['nama'] ?? "Dataset #{$id}";
        $status = $dataset['status'] ?? 'uploaded';
        $bisaExcel = in_array($status, ['cleaned', 'forecasted']);
        $bisaPrediksi = $status === 'forecasted';
        $labelLangkah = [
            'upload' => 'Data diunggah',
            'cleaning' => 'Data dibersihkan',
            'apply_review' => 'Hasil review diterapkan',
            'forecasting' => 'Prediksi dibuat',
        ];
    @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold">Riwayat dan unduhan</h1>
    <p class="mt-1 mb-6 max-w-2xl text-slate-600">
        Lihat apa saja yang sudah dikerjakan pada dataset ini, lalu unduh hasilnya.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'riwayat'])

    {{-- Unduh --}}
    <section class="mb-6 rounded-xl border border-line bg-white">
        <h2 class="border-b border-line px-5 py-4 font-semibold">Unduh hasil</h2>
        <div class="divide-y divide-line">
            <div class="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                    <div class="font-medium">Laporan lengkap (Excel)</div>
                    <p class="text-sm text-slate-600">Laporan dalam format Excel dengan beberapa lembar.</p>
                    @unless ($bisaExcel)
                        <p class="mt-1 text-sm text-amber-800">Tersedia setelah data dibersihkan.</p>
                    @endunless
                </div>
                @if ($bisaExcel)
                    <a href="{{ route('riwayat.unduh', ['id' => $id, 'jenis' => 'xlsx']) }}"
                       class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Unduh Excel</a>
                @else
                    <span class="cursor-not-allowed rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white opacity-50" aria-disabled="true">Unduh Excel</span>
                @endif
            </div>

            <div class="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                    <div class="font-medium">Hasil prediksi (CSV)</div>
                    <p class="text-sm text-slate-600">Nilai prediksi per periode, bisa dibuka di Excel.</p>
                    @unless ($bisaPrediksi)
                        <p class="mt-1 text-sm text-amber-800">Tersedia setelah prediksi dibuat di tab Analisis dan prediksi.</p>
                    @endunless
                </div>
                @if ($bisaPrediksi)
                    <a href="{{ route('riwayat.unduh', ['id' => $id, 'jenis' => 'forecast']) }}"
                       class="rounded-lg border border-brand-600 px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">Unduh CSV</a>
                @else
                    <span class="cursor-not-allowed rounded-lg border border-brand-600 px-5 py-2.5 text-sm font-semibold text-brand-700 opacity-50" aria-disabled="true">Unduh CSV</span>
                @endif
            </div>
        </div>
    </section>

    {{-- Laporan kualitas --}}
    <section class="mb-6 rounded-xl border border-line bg-white p-5">
        <h2 class="font-semibold">Laporan kualitas data</h2>
        @if ($laporan)
            <p class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
                Dari {{ $laporan['baris_awal'] ?? '?' }} baris, {{ $laporan['baris_akhir'] ?? '?' }} baris tersisa setelah dibersihkan.
                Ditemukan {{ $laporan['anomali_total'] ?? 0 }} anomali.
                Kelengkapan data {{ $laporan['kelengkapan_persen'] ?? '-' }}%.
            </p>
            @if (! empty($laporan['anomali_per_jenis']) && is_array($laporan['anomali_per_jenis']))
                <ul class="mt-3 flex flex-wrap gap-2 text-sm">
                    @foreach ($laporan['anomali_per_jenis'] as $jenis => $jumlah)
                        <li class="rounded-full border border-line bg-slate-50 px-3 py-1">{{ $jenis }}: <span class="font-medium tabular-nums">{{ $jumlah }}</span></li>
                    @endforeach
                </ul>
            @endif
        @else
            <p class="mt-2 text-sm text-slate-600">Belum ada laporan. Jalankan <strong class="font-semibold">Bersihkan data</strong> di tab Data.</p>
        @endif
    </section>

    {{-- Riwayat --}}
    <section class="rounded-xl border border-line bg-white p-5">
        <h2 class="mb-4 font-semibold">Riwayat pemrosesan</h2>
        @if (count($riwayat))
            <ol class="ml-2 border-l border-line">
                @foreach ($riwayat as $r)
                    @php
                        $kunci = $r['langkah'] ?? '';
                        try {
                            $waktu = isset($r['waktu'])
                                ? \Carbon\Carbon::parse($r['waktu'])->timezone('Asia/Jakarta')->format('d/m/Y H:i')
                                : '';
                        } catch (\Throwable $e) {
                            $waktu = '';
                        }
                    @endphp
                    <li class="relative mb-6 ml-6 last:mb-0">
                        <span class="absolute top-1.5 -left-[31px] h-3 w-3 rounded-full bg-brand-600 ring-4 ring-white" aria-hidden="true"></span>
                        <div class="font-medium">{{ $labelLangkah[$kunci] ?? $kunci }}</div>
                        @if (! empty($r['ringkasan']))
                            <p class="text-sm text-slate-600">{{ $r['ringkasan'] }}</p>
                        @endif
                        @if ($waktu)
                            <p class="mt-0.5 text-xs text-slate-500 tabular-nums">{{ $waktu }}</p>
                        @endif
                    </li>
                @endforeach
            </ol>
        @else
            <p class="text-sm text-slate-600">Belum ada riwayat untuk dataset ini.</p>
        @endif
    </section>

    <details class="mt-6 text-sm text-slate-500">
        <summary class="cursor-pointer hover:text-ink">Lihat respons mentah riwayat</summary>
        <pre class="mt-2 max-h-72 overflow-auto rounded-lg border border-line bg-white p-4 text-xs">{{ json_encode($mentah, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) }}</pre>
    </details>
@endsection
