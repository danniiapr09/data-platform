@extends('layouts.app')
@section('title', $nama)

@section('content')
    @php
        $urut = ['uploaded' => 1, 'cleaned' => 2, 'forecasted' => 3];
        $n = $urut[$status] ?? 1;
        $langkah = ['Diunggah', 'Dibersihkan', 'Diprediksi'];
    @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <span>{{ $nama }}</span>
    </nav>

    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
            <h1 class="text-2xl font-bold">{{ $nama }}</h1>
            <p class="text-sm text-slate-500 mt-1">Dataset #{{ $id }}</p>
        </div>

        @if ($bersih)
            {{-- Tombol pemicu dialog konfirmasi A --}}
            <button type="button"
                    onclick="bukaDialog_dialogBersihkanUlang(this)"
                    class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-brand-600">
                Bersihkan ulang
            </button>
        @else
            {{-- Belum pernah dibersihkan: langsung proses tanpa dialog --}}
            <form method="POST" action="{{ route('datasets.clean', $id) }}"
                  onsubmit="const b = this.querySelector('button'); b.disabled = true; b.textContent = 'Membersihkan…';">
                @csrf
                <button type="submit"
                        class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Bersihkan data
                </button>
            </form>
        @endif
    </div>

    {{-- DIALOG A: Konfirmasi Bersihkan Ulang Biasa --}}
    @if ($bersih)
        <x-konfirmasi-dialog
            id="dialogBersihkanUlang"
            judul="Bersihkan ulang dataset ini?"
            deskripsi="Sistem akan menjalankan ulang aturan pembersihan mulai dari data mentah asli."
            varian="amber"
            teksKonfirmasi="Ya, bersihkan ulang"
            teksBatal="Batal"
            :action="route('datasets.clean', $id)">
            <div class="space-y-4">
                {{-- Kelompok: Yang akan berubah --}}
                <div class="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <div class="flex items-center gap-2 font-semibold text-amber-900 mb-2">
                        <svg class="h-4 w-4 shrink-0 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <span>Yang akan diperbarui</span>
                    </div>
                    <ul class="space-y-2 text-xs leading-relaxed text-amber-950">
                        <li class="flex items-start gap-2">
                            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600"></span>
                            <span>Daftar anomali dan status tinjauan (diterima/ditolak) akan <strong>dihapus dan dideteksi ulang</strong> dari awal.</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600"></span>
                            <span>Hasil pembersihan akan disimpan sebagai <strong>versi data bersih baru</strong>.</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600"></span>
                            <span>Prediksi yang sudah dibuat tidak otomatis diperbarui, sehingga perlu dibuat ulang bila diinginkan.</span>
                        </li>
                    </ul>
                </div>

                {{-- Kelompok: Yang tetap aman --}}
                <div class="rounded-xl border border-line bg-slate-50 p-4">
                    <div class="flex items-center gap-2 font-semibold text-ink mb-2">
                        <svg class="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        <span>Yang tetap aman</span>
                    </div>
                    <ul class="space-y-2 text-xs leading-relaxed text-slate-700">
                        <li class="flex items-start gap-2">
                            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600"></span>
                            <span><strong>Berkas data mentah asli</strong> tidak akan diubah atau dihapus sama sekali.</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600"></span>
                            <span>Riwayat proses sebelumnya tetap tercatat di sistem.</span>
                        </li>
                    </ul>
                </div>

                <p class="text-xs text-slate-500 italic">
                    Catatan: Jika dataset ini memiliki perbaikan data manual, Anda akan dimintai persetujuan khusus sebelum data ditimpa.
                </p>
            </div>
        </x-konfirmasi-dialog>
    @endif

    {{-- DIALOG B: Muncul otomatis setelah backend merespons 409 (Punya edit manual) --}}
    @if (session('konfirmasi_timpa'))
        <x-konfirmasi-dialog
            id="dialogKonfirmasiTimpa"
            judul="Persetujuan: Timpa perbaikan manual?"
            deskripsi="Dataset ini tercatat memiliki perbaikan data yang pernah Anda simpan secara manual."
            varian="merah"
            teksKonfirmasi="Ya, bersihkan ulang dan timpa"
            teksBatal="Batal, pertahankan edit"
            :action="route('datasets.clean', $id)">
            <x-slot:hiddenFields>
                <input type="hidden" name="timpa" value="1">
            </x-slot:hiddenFields>

            <div class="space-y-4">
                <div class="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div class="flex items-center gap-2 font-semibold text-red-900 mb-2">
                        <svg class="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <span>Peringatan kehilangan perbaikan data</span>
                    </div>
                    <p class="text-xs leading-relaxed text-red-900">
                        Pembersihan ulang akan membentuk <strong>versi data bersih baru langsung dari data mentah</strong>. Akibatnya, seluruh hasil perbaikan manual yang pernah diedit pada tabel data <strong>tidak akan terbawa</strong> ke versi baru ini.
                    </p>
                </div>

                <div class="rounded-xl border border-line bg-slate-50 p-4">
                    <div class="flex items-center gap-2 font-semibold text-ink mb-2">
                        <svg class="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        <span>Yang tetap aman</span>
                    </div>
                    <ul class="space-y-1.5 text-xs text-slate-700">
                        <li class="flex items-start gap-2">
                            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600"></span>
                            <span>Data mentah asli tetap utuh dan tersimpan aman.</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600"></span>
                            <span>Catatan audit log mengenai siapa yang pernah mengedit tetap tersimpan di riwayat.</span>
                        </li>
                    </ul>
                </div>
            </div>
        </x-konfirmasi-dialog>

        <script>
            document.addEventListener('DOMContentLoaded', function() {
                if (typeof window['bukaDialog_dialogKonfirmasiTimpa'] === 'function') {
                    window['bukaDialog_dialogKonfirmasiTimpa']();
                }
            });
        </script>
    @endif

    {{-- Tahap --}}
    <ol class="flex flex-wrap items-center gap-2 text-sm mb-6" aria-label="Tahap pengolahan">
        @foreach ($langkah as $i => $nm)
            @php $selesai = ($i + 1) <= $n; @endphp
            <li class="flex items-center gap-2">
                <span class="grid h-6 w-6 place-items-center rounded-full text-xs font-semibold
                             {{ $selesai ? 'bg-brand-600 text-white' : 'bg-white border border-line text-slate-400' }}">
                    @if ($selesai)
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                    @else
                        {{ $i + 1 }}
                    @endif
                </span>
                <span class="{{ $selesai ? 'font-medium text-ink' : 'text-slate-400' }}">{{ $nm }}</span>
            </li>
            @if (! $loop->last)
                <li aria-hidden="true" class="h-px w-8 bg-line"></li>
            @endif
        @endforeach
    </ol>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'data'])

    {{-- Hasil pembersihan --}}
    @if ($laporan)
        @php $r = $laporan; @endphp
        <section class="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
            <h2 class="font-semibold mb-1">Hasil pembersihan</h2>
            <p class="text-sm leading-relaxed max-w-2xl">
                Dari {{ $r['baris_awal'] ?? '?' }} baris, {{ $r['baris_akhir'] ?? '?' }} baris tersisa setelah dibersihkan.
                Ditemukan {{ $r['anomali_total'] ?? 0 }} anomali yang perlu ditinjau.
                Kelengkapan data {{ $r['kelengkapan_persen'] ?? '-' }}%.
            </p>
        </section>
    @endif

    {{-- Pratinjau data --}}
    <section class="rounded-xl border border-line bg-white">
        <div class="flex items-baseline justify-between border-b border-line px-5 py-4">
            <h2 class="font-semibold">{{ $bersih ? 'Data bersih' : 'Data mentah' }}</h2>
            <span class="text-sm text-slate-500">Menampilkan {{ count($rows) }} baris</span>
        </div>

        @if (count($rows))
            <div class="max-h-[28rem] overflow-auto">
                <table class="w-full text-sm">
                    <thead class="sticky top-0 bg-slate-50 text-left text-slate-600">
                        <tr>
                            @foreach ($columns as $c)
                                <th class="whitespace-nowrap border-b border-line px-4 py-2.5 font-semibold">{{ $c }}</th>
                            @endforeach
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-line">
                        @foreach ($rows as $row)
                            <tr class="hover:bg-brand-50/60">
                                @foreach ($columns as $c)
                                    @php $v = $row[$c] ?? null; @endphp
                                    <td class="whitespace-nowrap px-4 py-2 tabular-nums">
                                        @if ($v === null || $v === '')
                                            <span class="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">kosong</span>
                                        @else
                                            {{ is_scalar($v) ? $v : json_encode($v) }}
                                        @endif
                                    </td>
                                @endforeach
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @else
            <p class="px-5 py-10 text-center text-slate-600">Tidak ada baris yang bisa ditampilkan.</p>
        @endif
    </section>

    <details class="mt-6 text-sm text-slate-500">
        <summary class="cursor-pointer hover:text-ink">Lihat respons mentah dari layanan data</summary>
        <pre class="mt-2 max-h-72 overflow-auto rounded-lg border border-line bg-white p-4 text-xs">{{ json_encode($mentah, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) }}</pre>
    </details>
@endsection
