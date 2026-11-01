@extends('layouts.app')
@section('title', 'Edit data')

@section('content')
    @php
        $nama = $dataset['nama'] ?? "Dataset #{$id}";
        $labelJenis = [
            'kosong' => 'Data kosong',
            'outlier' => 'Nilai tidak wajar',
            'format' => 'Format salah',
        ];
    @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold text-ink">Edit data</h1>
    <p class="mt-1 mb-6 max-w-2xl text-sm leading-relaxed text-slate-600">
        Isi data yang kosong atau perbaiki nilai yang keliru. Data mentah asli tidak akan diubah; hasil perbaikan Anda disimpan sebagai versi data bersih baru dan tercatat di riwayat audit.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'edit'])

    @if ($belumBersih ?? false)
        <x-keadaan-kosong
            judul="Data belum dibersihkan."
            deskripsi="Pembersihan otomatis perlu dijalankan terlebih dahulu sebelum perbaikan nilai sel manual dapat dilakukan."
        >
            <x-tombol href="{{ route('datasets.show', $id) }}">
                Buka tab Data
            </x-tombol>
        </x-keadaan-kosong>
    @else
        {{-- Peringatan Hasil Prediksi Perlu Dihitung Ulang (A5) --}}
        @if (session('peringatan_forecast'))
            <div class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-card">
                <div class="flex items-start gap-3">
                    <span class="grid h-8 w-8 place-items-center rounded-xl bg-amber-600 text-white shrink-0 mt-0.5">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </span>
                    <div>
                        <div class="font-bold text-amber-950">Perhatian: Hasil Prediksi Perlu Dihitung Ulang</div>
                        <p class="text-xs text-amber-900 mt-0.5 leading-relaxed">
                            {{ session('peringatan_forecast') }}
                        </p>
                    </div>
                </div>
                <a href="{{ route('analisis.index', $id) }}"
                   class="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition shadow-2xs">
                    <span>Buka Analisis & Prediksi</span>
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                </a>
            </div>
        @endif

        @php
            $pill = [
                ['k' => null, 't' => 'Semua masalah', 'n' => $hitung['semua']],
                ['k' => 'kosong', 't' => 'Data kosong', 'n' => $hitung['kosong']],
                ['k' => 'outlier', 't' => 'Nilai tidak wajar', 'n' => $hitung['outlier']],
                ['k' => 'format', 't' => 'Format salah', 'n' => $hitung['format']],
            ];
        @endphp

        {{-- Filter Pil Jenis Masalah --}}
        <div class="mb-5 flex flex-wrap gap-2">
            @foreach ($pill as $p)
                @php $aktif = $jenis === $p['k']; @endphp
                <a href="{{ route('edit.index', array_filter(['id' => $id, 'jenis' => $p['k']])) }}"
                   @if ($aktif) aria-current="true" @endif
                   class="rounded-full border px-3.5 py-1 text-xs font-semibold transition-all duration-150 {{ $aktif ? 'border-brand-600 bg-brand-600 text-white shadow-2xs' : 'border-line bg-white text-slate-600 hover:border-brand-600 hover:text-ink' }}">
                    {{ $p['t'] }} <span class="tabular-nums opacity-85 ml-1">({{ $p['n'] }})</span>
                </a>
            @endforeach
        </div>

        @if ($terpotong)
            <div class="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
                <svg class="h-4 w-4 shrink-0 text-amber-700 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>Daftar ini menampilkan 200 anomali pertama. Simpan perubahan Anda, lalu muat ulang halaman untuk memproses anomali berikutnya.</span>
            </div>
        @endif

        @if (count($sel))
            <form method="POST" action="{{ route('edit.simpan', $id) }}"
                  onsubmit="const b = this.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Menyimpan perubahan…';"
                  class="rounded-2xl border border-line bg-white shadow-card overflow-hidden">
                @csrf
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-line bg-slate-50/60">
                                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Baris di file</th>
                                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Kolom</th>
                                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Masalah terdeteksi</th>
                                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nilai baru</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-line">
                            @foreach ($sel as $c)
                                @php $k = $c['id']; @endphp
                                <tr class="transition-colors duration-150 hover:bg-brand-50/50">
                                    <td class="px-5 py-3.5 tabular-nums font-medium text-ink">{{ $c['baris_file'] }}</td>
                                    <td class="px-5 py-3.5 font-semibold text-ink">{{ $c['kolom'] }}</td>
                                    <td class="px-5 py-3.5 text-xs text-slate-600 max-w-sm">
                                        {{ implode('; ', array_unique($c['alasan'])) }}
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <input type="hidden" name="edit[{{ $k }}][row_index]" value="{{ $c['row_index'] }}">
                                        <input type="hidden" name="edit[{{ $k }}][kolom]" value="{{ $c['kolom'] }}">
                                        <input type="text" name="edit[{{ $k }}][nilai]" inputmode="decimal"
                                               value="{{ old("edit.{$k}.nilai") }}"
                                               aria-label="Nilai baru untuk {{ $c['kolom'] }} di baris {{ $c['baris_file'] }}"
                                               placeholder="Isi nilai baru"
                                               class="w-44 rounded-xl border border-line bg-white px-3 py-1.5 text-sm tabular-nums focus-visible:outline-brand-600">
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>

                <div class="flex flex-wrap items-end justify-between gap-4 border-t border-line bg-slate-50/40 p-5 sm:p-6">
                    <div class="min-w-64 flex-1">
                        <label for="alasan" class="mb-1 block text-sm font-semibold text-ink">
                            Alasan perubahan data <span class="text-red-600 font-bold">*</span>
                        </label>
                        <input id="alasan" name="alasan" type="text" maxlength="200" required
                               value="{{ old('alasan', 'Melengkapi data yang kosong') }}"
                               placeholder="Contoh: Mengisi dari laporan resmi Dinas Pendidikan"
                               class="w-full rounded-xl border border-line bg-white px-3.5 py-2 text-sm focus-visible:outline-brand-600">
                        @error('alasan') <p class="mt-1 text-xs font-semibold text-red-600" role="alert">{{ $message }}</p> @enderror
                        <p class="mt-1.5 text-xs text-slate-500">Tulis angka tanpa titik pemisah ribuan. Baris yang dibiarkan kosong tidak akan diubah.</p>
                    </div>
                    <div>
                        <button type="submit"
                                class="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-700 focus-visible:outline-brand-600">
                            Simpan perubahan data
                        </button>
                    </div>
                </div>
            </form>
        @else
            <x-keadaan-kosong
                judul="Tidak ada data yang perlu diperbaiki."
                deskripsi="Semua anomali pada kategori yang dipilih telah selesai diperbaiki atau tidak memerlukan penanganan."
            />
        @endif

        {{-- Riwayat Edit Manual --}}
        <section class="mt-8 rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-card">
            <h2 class="text-base font-bold text-ink">Riwayat perbaikan data manual</h2>
            <p class="mt-1 text-xs text-slate-500">{{ $ringkasanEdit['deskripsi'] ?? 'Belum ada edit manual.' }}</p>

            @if (count($riwayatEdit))
                <div class="mt-4 max-h-80 overflow-auto rounded-xl border border-line">
                    <table class="w-full text-xs">
                        <thead class="sticky top-0 bg-slate-50/90 backdrop-blur-xs text-left text-slate-600 font-semibold border-b border-line">
                            <tr>
                                <th class="whitespace-nowrap px-4 py-2.5">Waktu</th>
                                <th class="whitespace-nowrap px-4 py-2.5">Baris</th>
                                <th class="whitespace-nowrap px-4 py-2.5">Kolom</th>
                                <th class="whitespace-nowrap px-4 py-2.5">Nilai lama</th>
                                <th class="whitespace-nowrap px-4 py-2.5">Nilai baru</th>
                                <th class="whitespace-nowrap px-4 py-2.5">Alasan</th>
                                <th class="whitespace-nowrap px-4 py-2.5">Petugas</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-line tabular-nums">
                            @foreach ($riwayatEdit as $r)
                                @php
                                    try {
                                        $waktuFormatted = isset($r['waktu'])
                                            ? \Carbon\Carbon::parse($r['waktu'])->timezone('Asia/Jakarta')->format('d/m/Y H:i')
                                            : '-';
                                    } catch (\Throwable $e) {
                                        $waktuFormatted = '-';
                                    }
                                    $petugas = ($r['diubah_oleh'] ?? 'tidak diketahui') === 'tidak diketahui' ? 'Petugas' : $r['diubah_oleh'];
                                @endphp
                                <tr class="hover:bg-slate-50/60">
                                    <td class="whitespace-nowrap px-4 py-2 text-slate-500">{{ $waktuFormatted }}</td>
                                    <td class="whitespace-nowrap px-4 py-2 font-medium">{{ $r['baris_di_file_asli'] ?? $r['row_index'] }}</td>
                                    <td class="whitespace-nowrap px-4 py-2 font-semibold text-ink">{{ $r['kolom'] ?? '-' }}</td>
                                    <td class="whitespace-nowrap px-4 py-2 text-red-700 bg-red-50/30 font-mono">{{ json_encode($r['nilai_lama'] ?? null) }}</td>
                                    <td class="whitespace-nowrap px-4 py-2 text-emerald-800 bg-emerald-50/30 font-mono font-semibold">{{ json_encode($r['nilai_baru'] ?? null) }}</td>
                                    <td class="px-4 py-2 text-slate-700 max-w-xs truncate">{{ $r['alasan'] ?? '-' }}</td>
                                    <td class="whitespace-nowrap px-4 py-2 text-slate-600">{{ $petugas }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </section>
    @endif
@endsection
