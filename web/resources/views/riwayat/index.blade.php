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
            'cleaning_report' => 'Laporan kualitas data',
            'edit_data' => 'Perbaikan data manual',
            'apply_review' => 'Hasil review diterapkan',
            'forecasting' => 'Prediksi dibuat',
        ];
    @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold text-ink">Riwayat dan unduhan</h1>
    <p class="mt-1 mb-6 max-w-2xl text-sm leading-relaxed text-slate-600">
        Daftar linimasa seluruh proses yang telah dilakukan pada dataset ini beserta berkas hasil pembersihan dan prediksi yang siap diunduh.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'riwayat'])

    {{-- Unduh Berkas --}}
    <section class="mb-8 rounded-2xl border border-line bg-white shadow-card overflow-hidden">
        <h2 class="border-b border-line px-5 py-4 font-bold text-base text-ink">Unduh hasil pengolahan</h2>
        <div class="divide-y divide-line">
            {{-- Excel --}}
            <div class="flex flex-wrap items-center justify-between gap-4 p-5 sm:px-6">
                <div>
                    <div class="font-bold text-ink">Laporan lengkap (Excel .xlsx)</div>
                    <p class="text-xs text-slate-600 mt-0.5">Berkas laporan berformat Excel yang mencakup data bersih dan lembar ringkasan.</p>
                    @unless ($bisaExcel)
                        <p class="mt-1.5 text-xs font-semibold text-amber-800">Tersedia setelah data dibersihkan di tab Data.</p>
                    @endunless
                </div>
                <div>
                    @if ($bisaExcel)
                        <a href="{{ route('riwayat.unduh', ['id' => $id, 'jenis' => 'xlsx']) }}"
                           class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            <span>Unduh Excel</span>
                        </a>
                    @else
                        <span class="inline-flex items-center gap-2 cursor-not-allowed rounded-xl bg-slate-100 border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-400 select-none" aria-disabled="true">
                            <span>Unduh Excel</span>
                        </span>
                    @endif
                </div>
            </div>

            {{-- CSV Prediksi (A9: Sebutkan indikator pada label) --}}
            <div class="flex flex-wrap items-center justify-between gap-4 p-5 sm:px-6">
                <div>
                    <div class="font-bold text-ink flex items-center gap-2">
                        <span>Hasil perkiraan masa depan (CSV)</span>
                        @if ($indikatorPrediksi)
                            <span class="rounded-md bg-brand-50 border border-brand-200 px-2 py-0.5 text-xs font-semibold text-brand-800">
                                Indikator: {{ $indikatorPrediksi }}
                            </span>
                        @endif
                    </div>
                    <p class="text-xs text-slate-600 mt-0.5">
                        Nilai ramalan per periode untuk indikator <strong class="text-ink">{{ $indikatorPrediksi ?? 'yang dibuat' }}</strong>, dapat dibuka langsung di aplikasi spreadsheet.
                    </p>
                    @unless ($bisaPrediksi)
                        <p class="mt-1.5 text-xs font-semibold text-amber-800">Tersedia setelah ramalan dibuat di tab Analisis dan prediksi.</p>
                    @endunless
                </div>
                <div>
                    @if ($bisaPrediksi)
                        <a href="{{ route('riwayat.unduh', ['id' => $id, 'jenis' => 'forecast']) }}"
                           class="inline-flex items-center gap-2 rounded-xl border border-brand-600 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-2xs transition hover:bg-brand-50">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            <span>Unduh CSV{{ $indikatorPrediksi ? ' ('.$indikatorPrediksi.')' : '' }}</span>
                        </a>
                    @else
                        <span class="inline-flex items-center gap-2 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-400 select-none" aria-disabled="true">
                            <span>Unduh CSV</span>
                        </span>
                    @endif
                </div>
            </div>
        </div>
    </section>

    {{-- Laporan Kualitas Data --}}
    <section class="mb-8 rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-card">
        <h2 class="font-bold text-base text-ink mb-1">Laporan kualitas data</h2>
        @if ($laporan)
            <p class="text-sm leading-relaxed text-slate-700">
                Dari <strong>{{ $laporan['baris_awal'] ?? '?' }}</strong> baris awal, tersisa <strong>{{ $laporan['baris_akhir'] ?? '?' }}</strong> baris bersih setelah pembersihan.
                Ditemukan total <strong>{{ $laporan['anomali_total'] ?? 0 }}</strong> anomali.
                Tingkat kelengkapan data mencapai <strong>{{ $laporan['kelengkapan_persen'] ?? '-' }}%</strong>.
            </p>
            @if (! empty($laporan['anomali_per_jenis']) && is_array($laporan['anomali_per_jenis']))
                @php
                    $labelPetaJenis = [
                        'kosong' => 'Data kosong',
                        'outlier' => 'Nilai tidak wajar',
                        'format' => 'Format salah',
                        'duplikat' => 'Baris duplikat',
                    ];
                @endphp
                <ul class="mt-4 flex flex-wrap gap-2 text-xs">
                    @foreach ($laporan['anomali_per_jenis'] as $jenis => $jumlah)
                        <li class="rounded-full border border-line bg-slate-50 px-3 py-1 font-medium text-slate-700">
                            {{ $labelPetaJenis[$jenis] ?? $jenis }}: <span class="font-bold text-ink tabular-nums">{{ $jumlah }}</span>
                        </li>
                    @endforeach
                </ul>
            @endif
        @else
            <p class="text-xs text-slate-500">Laporan belum tersedia. Silakan jalankan pembersihan data terlebih dahulu di tab Data.</p>
        @endif
    </section>

    {{-- Linimasa Riwayat Pemrosesan (A10: Petakan langkah & ganti 'tidak diketahui' dengan 'petugas') --}}
    <section class="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-card">
        <h2 class="font-bold text-base text-ink mb-4">Linimasa riwayat pemrosesan</h2>
        @if (count($riwayat))
            <ol class="relative ml-3 border-l-2 border-brand-100 space-y-6">
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
                        // Ganti "tidak diketahui" menjadi "petugas" secara netral (A10)
                        $ringkasanBersih = str_ireplace('tidak diketahui', 'petugas', (string) ($r['ringkasan'] ?? ''));
                    @endphp
                    <li class="ml-6">
                        <span class="absolute -left-2 mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-100" aria-hidden="true"></span>
                        <div class="font-bold text-sm text-ink">{{ $labelLangkah[$kunci] ?? ucfirst(str_replace('_', ' ', $kunci)) }}</div>
                        @if ($ringkasanBersih)
                            <p class="mt-0.5 text-xs leading-relaxed text-slate-600">{{ $ringkasanBersih }}</p>
                        @endif
                        @if ($waktu)
                            <p class="mt-1 text-[11px] font-medium text-slate-400 tabular-nums">{{ $waktu }} WIB</p>
                        @endif
                    </li>
                @endforeach
            </ol>
        @else
            <p class="text-xs text-slate-500">Belum ada riwayat aktivitas yang tercatat untuk dataset ini.</p>
        @endif
    </section>
@endsection
