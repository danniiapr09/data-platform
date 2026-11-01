@extends('layouts.app')
@section('title', 'Review anomali')

@section('content')
    @php
        $nama = $dataset['nama'] ?? "Dataset #{$id}";
        $labelJenis = [
            'kosong' => 'Data kosong',
            'outlier' => 'Nilai tidak wajar',
            'format' => 'Format salah',
            'duplikat' => 'Baris duplikat',
        ];
        $label = [
            'pending' => 'Menunggu review',
            'diterima' => 'Diterima',
            'ditolak' => 'Ditolak',
            'diperbaiki' => 'Diperbaiki',
        ];
        $gaya = [
            'pending' => 'bg-amber-50 text-amber-900 border-amber-200',
            'diterima' => 'bg-emerald-50 text-emerald-800 border-emerald-200',
            'ditolak' => 'bg-red-50 text-red-900 border-red-200',
            'diperbaiki' => 'bg-blue-50 text-blue-900 border-blue-200',
        ];
        $warnaBar = [
            'pending' => 'bg-amber-400',
            'diterima' => 'bg-emerald-600',
            'ditolak' => 'bg-red-500',
            'diperbaiki' => 'bg-blue-500',
        ];
        $pill = [
            ['k' => null, 't' => 'Semua', 'n' => $total],
            ['k' => 'pending', 't' => 'Menunggu', 'n' => $hitung['pending']],
            ['k' => 'diterima', 't' => 'Diterima', 'n' => $hitung['diterima']],
            ['k' => 'ditolak', 't' => 'Ditolak', 'n' => $hitung['ditolak']],
            ['k' => 'diperbaiki', 't' => 'Diperbaiki', 'n' => $hitung['diperbaiki']],
        ];
        $linkDasar = fn (array $tambah = []) => route('anomali.index', array_filter(array_merge(
            ['id' => $id, 'kelompok' => $by === 'kolom' ? 'kolom' : null],
            $tambah
        )));
    @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold text-ink">Review anomali</h1>
    <p class="mt-1 mb-6 max-w-2xl text-sm leading-relaxed text-slate-600">
        Periksa baris data yang ditandai sistem. Beri tanda <strong class="font-semibold text-ink">Terima</strong> bila data dianggap wajar, atau <strong class="font-semibold text-ink">Tolak</strong> bila keliru.
        Anda juga dapat memperbaiki isi sel langsung di tab <a href="{{ route('edit.index', $id) }}" class="text-brand-700 font-semibold hover:underline">Edit data</a>.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'anomali'])

    @if ($total === 0)
        <x-keadaan-kosong
            judul="Belum ada anomali terdeteksi."
            deskripsi="Bila data baru diunggah, silakan jalankan pembersihan data terlebih dahulu di tab Data."
        >
            <x-tombol href="{{ route('datasets.show', $id) }}">
                Buka tab Data
            </x-tombol>
        </x-keadaan-kosong>
    @else
        @if ($catatan)
            <x-notifikasi tipe="peringatan" :pesan="$catatan" class="mb-6" />
        @endif

        {{-- Ringkasan per kelompok --}}
        <section class="mb-8">
            <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 class="text-base font-bold text-ink">Ringkasan kelompok anomali</h2>
                    <p class="mt-0.5 max-w-2xl text-xs text-slate-500">{{ $ringkasan['deskripsi'] ?? '' }}</p>
                </div>
                <div class="flex rounded-xl border border-line bg-white p-1 text-sm shadow-2xs" role="group" aria-label="Kelompokkan berdasarkan">
                    <a href="{{ route('anomali.index', ['id' => $id]) }}"
                       class="rounded-lg px-3 py-1.5 font-medium transition {{ $by === 'jenis' ? 'bg-brand-600 text-white font-semibold' : 'text-slate-600 hover:text-ink' }}">
                        Per jenis masalah
                    </a>
                    <a href="{{ route('anomali.index', ['id' => $id, 'kelompok' => 'kolom']) }}"
                       class="rounded-lg px-3 py-1.5 font-medium transition {{ $by === 'kolom' ? 'bg-brand-600 text-white font-semibold' : 'text-slate-600 hover:text-ink' }}">
                        Per kolom data
                    </a>
                </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                @foreach ($kelompokList as $g)
                    @php
                        $nm = $g['kelompok'];
                        $jml = max(1, $g['jumlah'] ?? 0);
                        $aktifGrup = $grup === $nm;
                    @endphp
                    <article class="rounded-2xl border bg-white p-5 shadow-card transition duration-150 {{ $aktifGrup ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-line hover:border-slate-300' }}">
                        <div class="flex items-baseline justify-between gap-2">
                            <h3 class="font-bold text-ink">{{ $by === 'jenis' ? ($labelJenis[$nm] ?? $nm) : $nm }}</h3>
                            <span class="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-500">{{ $g['jumlah'] ?? 0 }} anomali</span>
                        </div>
                        <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-line" role="img"
                             aria-label="Menunggu {{ $g['pending'] ?? 0 }}, diterima {{ $g['diterima'] ?? 0 }}, ditolak {{ $g['ditolak'] ?? 0 }}, diperbaiki {{ $g['diperbaiki'] ?? 0 }}">
                            @foreach ($warnaBar as $s => $kelas)
                                @if (($g[$s] ?? 0) > 0)
                                    <span class="{{ $kelas }}" style="width: {{ ($g[$s] / $jml) * 100 }}%"></span>
                                @endif
                            @endforeach
                        </div>
                        <p class="mt-2 text-xs text-slate-500">
                            {{ $g['pending'] ?? 0 }} menunggu, {{ $g['diterima'] ?? 0 }} diterima,
                            {{ $g['ditolak'] ?? 0 }} ditolak, {{ $g['diperbaiki'] ?? 0 }} diperbaiki
                        </p>
                        <div class="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold border-t border-line/60 pt-3">
                            <a href="{{ $aktifGrup ? $linkDasar(['status' => $filter]) : $linkDasar(['grup' => $nm, 'status' => $filter]) }}"
                               class="text-brand-700 hover:underline">
                                {{ $aktifGrup ? 'Tampilkan semua kelompok' : 'Saring kelompok ini' }}
                            </a>
                            @if ($by === 'jenis' && in_array($nm, ['kosong', 'outlier', 'format'], true))
                                <a href="{{ route('edit.index', ['id' => $id, 'jenis' => $nm]) }}" class="text-slate-600 hover:text-ink hover:underline">
                                    Perbaiki di tab Edit
                                </a>
                            @endif
                        </div>
                    </article>
                @endforeach
            </div>
        </section>

        {{-- Daftar Anomali --}}
        <section>
            <div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                    <h2 class="text-base font-bold text-ink">
                        Daftar anomali@if ($grup), kelompok: <span class="text-brand-700">{{ $by === 'jenis' ? ($labelJenis[$grup] ?? $grup) : $grup }}</span>@endif
                    </h2>
                    <p class="text-xs text-slate-500 mt-0.5">
                        Menampilkan {{ count($items) }} dari total {{ $totalFiltered }} anomali
                        @if ($totalPages > 1) (Halaman {{ $page }} dari {{ $totalPages }}) @endif
                    </p>
                </div>

                {{-- Tindakan Massal (A3) --}}
                @if ($hitung['pending'] > 0)
                    <div class="flex flex-wrap items-center gap-2">
                        <form method="POST" action="{{ route('anomali.review-massal', $id) }}"
                              onsubmit="return confirm('Tandai semua anomali yang masih menunggu sebagai DITERIMA? Tindakan ini mencatat keputusan review Anda.');">
                            @csrf
                            <input type="hidden" name="status" value="diterima">
                            @if ($grup)
                                <input type="hidden" name="{{ $by === 'jenis' ? 'jenis' : 'kolom' }}" value="{{ $grup }}">
                            @else
                                <input type="hidden" name="semua" value="1">
                            @endif
                            <button type="submit"
                                    class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs">
                                <svg class="h-3.5 w-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                <span>Terima semua yang menunggu</span>
                            </button>
                        </form>

                        <form method="POST" action="{{ route('anomali.review-massal', $id) }}"
                              onsubmit="return confirm('Tandai semua anomali yang masih menunggu sebagai DITOLAK? Tindakan ini mencatat keputusan review Anda.');">
                            @csrf
                            <input type="hidden" name="status" value="ditolak">
                            @if ($grup)
                                <input type="hidden" name="{{ $by === 'jenis' ? 'jenis' : 'kolom' }}" value="{{ $grup }}">
                            @else
                                <input type="hidden" name="semua" value="1">
                            @endif
                            <button type="submit"
                                    class="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 transition shadow-2xs">
                                <svg class="h-3.5 w-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                <span>Tolak semua yang menunggu</span>
                            </button>
                        </form>
                    </div>
                @endif
            </div>

            {{-- Filter Status (Pill) --}}
            <div class="mb-4 flex flex-wrap gap-2">
                @foreach ($pill as $p)
                    @php $aktif = $filter === $p['k']; @endphp
                    <a href="{{ $linkDasar(['grup' => $grup, 'status' => $p['k']]) }}"
                       @if ($aktif) aria-current="true" @endif
                       class="rounded-full border px-3.5 py-1 text-xs font-semibold transition-all duration-150 {{ $aktif ? 'border-brand-600 bg-brand-600 text-white shadow-2xs' : 'border-line bg-white text-slate-600 hover:border-brand-600 hover:text-ink' }}">
                        {{ $p['t'] }} <span class="tabular-nums opacity-85 ml-1">({{ $p['n'] }})</span>
                    </a>
                @endforeach
            </div>

            {{-- Penjelasan Jujur Terima/Tolak (A2) --}}
            <div class="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2.5">
                <svg class="h-4 w-4 shrink-0 text-slate-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span><strong>Catatan:</strong> Menandai Terima atau Tolak mencatat hasil penilaian Anda dan belum mengubah isi data bersih. Baris yang ditolak tidak langsung dihapus dari tabel sampai ada mekanisme pembaruan data resmi.</span>
            </div>

            {{-- Tabel Anomali (A1: Terhubung ke Backend Filter & Paginasi) --}}
            <div class="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-line bg-slate-50/60">
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Baris di file</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Kolom</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Jenis</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Alasan</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                            <th class="px-5 py-3 text-right"><span class="sr-only">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-line">
                        @forelse ($items as $a)
                            @php $s = $a['status'] ?? 'pending'; @endphp
                            <tr class="transition-colors duration-150 hover:bg-brand-50/50">
                                <td class="px-5 py-3.5 tabular-nums font-medium text-ink">{{ $a['baris_di_file_asli'] ?? $a['row_index'] }}</td>
                                <td class="px-5 py-3.5 font-semibold text-ink">{{ $a['kolom'] }}</td>
                                <td class="px-5 py-3.5 text-xs text-slate-700">
                                    <span class="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                                        {{ $labelJenis[$a['jenis'] ?? ''] ?? ($a['jenis'] ?? '-') }}
                                    </span>
                                </td>
                                <td class="px-5 py-3.5 text-xs text-slate-600 max-w-md">
                                    {{ preg_replace('/^\[[^\]]+\]\s*/', '', (string) ($a['alasan'] ?? '')) }}
                                </td>
                                <td class="px-5 py-3.5">
                                    <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold {{ $gaya[$s] ?? $gaya['pending'] }}">
                                        {{ $label[$s] ?? $s }}
                                    </span>
                                </td>
                                <td class="px-5 py-3.5 text-right whitespace-nowrap">
                                    @if ($s !== 'diperbaiki')
                                        <div class="inline-flex items-center gap-1.5">
                                            @if ($s !== 'diterima')
                                                <form method="POST" action="{{ route('anomali.update', $a['id']) }}">
                                                    @csrf @method('PATCH')
                                                    <input type="hidden" name="status" value="diterima">
                                                    <button class="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-emerald-600 shadow-2xs">
                                                        Terima
                                                    </button>
                                                </form>
                                            @endif
                                            @if ($s !== 'ditolak')
                                                <form method="POST" action="{{ route('anomali.update', $a['id']) }}">
                                                    @csrf @method('PATCH')
                                                    <input type="hidden" name="status" value="ditolak">
                                                    <button class="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-red-600 shadow-2xs">
                                                        Tolak
                                                    </button>
                                                </form>
                                            @endif
                                            @if ($s !== 'pending')
                                                <form method="POST" action="{{ route('anomali.update', $a['id']) }}">
                                                    @csrf @method('PATCH')
                                                    <input type="hidden" name="status" value="pending">
                                                    <button class="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:text-ink hover:underline">
                                                        Batal
                                                    </button>
                                                </form>
                                            @endif
                                        </div>
                                    @else
                                        <span class="text-xs text-slate-400 italic">Telah diedit manual</span>
                                    @endif
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="px-5 py-12 text-center text-slate-500 text-sm">
                                    Tidak ada anomali yang sesuai dengan pilihan penyaringan saat ini.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            {{-- Navigasi Halaman / Paginasi (A1) --}}
            @if ($totalPages > 1)
                <div class="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
                    <p class="text-xs text-slate-500">
                        Menampilkan halaman {{ $page }} dari {{ $totalPages }}
                    </p>
                    <div class="flex items-center gap-2">
                        @if ($page > 1)
                            <a href="{{ $linkDasar(['page' => $page - 1, 'grup' => $grup, 'status' => $filter]) }}"
                               class="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50 shadow-2xs">
                                &larr; Sebelumnya
                            </a>
                        @endif
                        @if ($page < $totalPages)
                            <a href="{{ $linkDasar(['page' => $page + 1, 'grup' => $grup, 'status' => $filter]) }}"
                               class="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50 shadow-2xs">
                                Berikutnya &rarr;
                            </a>
                        @endif
                    </div>
                </div>
            @endif

            {{-- Bagian Terapkan Hasil Review (A4: Nonaktif & Terproteksi) --}}
            <div class="mt-8 rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-card flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 class="font-bold text-ink text-base">Terapkan hasil review</h3>
                    <p class="mt-1 max-w-xl text-xs leading-relaxed text-slate-600">
                        Fitur penerapan hasil review (membuang baris data bersih yang ditolak) sedang disiapkan di layanan data. Pilihan yang Anda tandai tetap tersimpan aman di sistem.
                    </p>
                </div>
                <div>
                    <button type="button" disabled
                            class="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-400 cursor-not-allowed select-none shadow-none"
                            title="Fitur ini sedang disiapkan">
                        <span>Terapkan hasil review</span>
                        <span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">Segera hadir</span>
                    </button>
                </div>
            </div>
        </section>
@endsection
