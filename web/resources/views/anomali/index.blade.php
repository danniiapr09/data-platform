@extends('layouts.app')
@section('title', 'Review anomali')

@section('content')
    @php
        $nama = $dataset['nama'] ?? "Dataset #{$id}";
        $labelJenis = ['kosong' => 'Data kosong', 'outlier' => 'Nilai di luar kewajaran', 'format' => 'Format salah'];
        $label = ['pending' => 'Menunggu review', 'diterima' => 'Diterima', 'ditolak' => 'Ditolak', 'diperbaiki' => 'Diperbaiki'];
        $gaya = [
            'pending' => 'bg-amber-50 text-amber-800',
            'diterima' => 'bg-brand-50 text-brand-700',
            'ditolak' => 'bg-red-50 text-red-700',
            'diperbaiki' => 'bg-sky-50 text-sky-700',
        ];
        $warnaBar = ['pending' => 'bg-amber-400', 'diterima' => 'bg-brand-600', 'ditolak' => 'bg-red-500', 'diperbaiki' => 'bg-sky-500'];
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

    <h1 class="text-2xl font-bold">Review anomali</h1>
    <p class="mt-1 mb-6 max-w-2xl text-slate-600">
        Anomali dikelompokkan supaya mudah ditangani sekaligus. Pilih <strong class="font-semibold">Terima</strong> kalau datanya benar,
        <strong class="font-semibold">Tolak</strong> kalau salah dan perlu dibuang, atau isi nilainya di tab Edit data.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'anomali'])

    @if ($total === 0)
        <div class="rounded-xl border border-line bg-white px-6 py-12 text-center text-slate-600">
            Belum ada anomali. Kalau data belum dibersihkan, jalankan <strong class="font-semibold">Bersihkan data</strong> di tab Data.
        </div>
    @else
        @if ($catatan)
            <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{{ $catatan }}</div>
        @endif

        {{-- Ringkasan per kelompok --}}
        <section class="mb-8">
            <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 class="text-lg font-semibold">Ringkasan per kelompok</h2>
                    <p class="mt-1 max-w-2xl text-sm text-slate-600">{{ $ringkasan['deskripsi'] ?? '' }}</p>
                </div>
                <div class="flex rounded-lg border border-line bg-white p-0.5 text-sm" role="group" aria-label="Kelompokkan berdasarkan">
                    <a href="{{ route('anomali.index', ['id' => $id]) }}"
                       class="rounded-md px-3 py-1.5 {{ $by === 'jenis' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-ink' }}">Per jenis</a>
                    <a href="{{ route('anomali.index', ['id' => $id, 'kelompok' => 'kolom']) }}"
                       class="rounded-md px-3 py-1.5 {{ $by === 'kolom' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-ink' }}">Per kolom</a>
                </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                @foreach ($kelompokList as $g)
                    @php
                        $nm = $g['kelompok'];
                        $jml = max(1, $g['jumlah'] ?? 0);
                        $aktifGrup = $grup === $nm;
                    @endphp
                    <article class="rounded-xl border bg-white p-4 {{ $aktifGrup ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line' }}">
                        <div class="flex items-baseline justify-between gap-2">
                            <h3 class="font-semibold">{{ $by === 'jenis' ? ($labelJenis[$nm] ?? $nm) : $nm }}</h3>
                            <span class="whitespace-nowrap text-sm tabular-nums text-slate-500">{{ $g['jumlah'] ?? 0 }} anomali</span>
                        </div>
                        <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-line" role="img"
                             aria-label="Menunggu {{ $g['pending'] ?? 0 }}, diterima {{ $g['diterima'] ?? 0 }}, ditolak {{ $g['ditolak'] ?? 0 }}, diperbaiki {{ $g['diperbaiki'] ?? 0 }}">
                            @foreach ($warnaBar as $s => $kelas)
                                @if (($g[$s] ?? 0) > 0)
                                    <span class="{{ $kelas }}" style="width: {{ ($g[$s] / $jml) * 100 }}%"></span>
                                @endif
                            @endforeach
                        </div>
                        <p class="mt-2 text-xs text-slate-600">
                            {{ $g['pending'] ?? 0 }} menunggu, {{ $g['diterima'] ?? 0 }} diterima,
                            {{ $g['ditolak'] ?? 0 }} ditolak, {{ $g['diperbaiki'] ?? 0 }} diperbaiki
                        </p>
                        <div class="mt-3 flex flex-wrap gap-4 text-sm">
                            <a href="{{ $aktifGrup ? $linkDasar(['status' => $filter]) : $linkDasar(['grup' => $nm, 'status' => $filter]) }}"
                               class="font-medium text-brand-700 hover:underline">
                                {{ $aktifGrup ? 'Tampilkan semua' : 'Lihat anomali' }}
                            </a>
                            @if ($by === 'jenis' && isset($labelJenis[$nm]))
                                <a href="{{ route('edit.index', ['id' => $id, 'jenis' => $nm]) }}" class="font-medium text-brand-700 hover:underline">Isi atau perbaiki</a>
                            @endif
                        </div>
                    </article>
                @endforeach
            </div>
        </section>

        {{-- Daftar --}}
        <section>
            <h2 class="mb-3 text-lg font-semibold">
                Daftar anomali@if ($grup), kelompok {{ $by === 'jenis' ? ($labelJenis[$grup] ?? $grup) : $grup }}@endif
            </h2>

            <div class="mb-4 flex flex-wrap gap-2">
                @foreach ($pill as $p)
                    @php $aktif = $filter === $p['k']; @endphp
                    <a href="{{ $linkDasar(['grup' => $grup, 'status' => $p['k']]) }}"
                       @if ($aktif) aria-current="true" @endif
                       class="rounded-full border px-4 py-1.5 text-sm font-medium transition {{ $aktif ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-slate-600 hover:border-brand-600' }}">
                        {{ $p['t'] }} <span class="tabular-nums opacity-80">{{ $p['n'] }}</span>
                    </a>
                @endforeach
            </div>

            @if ($terpotong)
                <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Daftar ini menampilkan 200 anomali pertama dari seluruh data.
                </div>
            @endif

            <div class="overflow-x-auto rounded-xl border border-line bg-white">
                <table class="w-full text-sm">
                    <thead class="text-left text-slate-500">
                        <tr class="border-b border-line">
                            <th class="px-4 py-3 font-medium">Baris di file</th>
                            <th class="px-4 py-3 font-medium">Kolom</th>
                            <th class="px-4 py-3 font-medium">Jenis</th>
                            <th class="px-4 py-3 font-medium">Alasan</th>
                            <th class="px-4 py-3 font-medium">Status</th>
                            <th class="px-4 py-3"><span class="sr-only">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-line">
                        @forelse ($items as $a)
                            @php $s = $a['status'] ?? 'pending'; @endphp
                            <tr class="hover:bg-brand-50/60">
                                <td class="px-4 py-3 tabular-nums">{{ $a['baris_di_file_asli'] ?? $a['row_index'] }}</td>
                                <td class="px-4 py-3 font-medium">{{ $a['kolom'] }}</td>
                                <td class="px-4 py-3">{{ $labelJenis[$a['jenis'] ?? ''] ?? ($a['jenis'] ?? '-') }}</td>
                                <td class="px-4 py-3 text-slate-700 max-w-md">{{ preg_replace('/^\[[^\]]+\]\s*/', '', (string) ($a['alasan'] ?? '')) }}</td>
                                <td class="px-4 py-3">
                                    <span class="rounded-full px-2.5 py-1 text-xs font-medium {{ $gaya[$s] ?? $gaya['pending'] }}">{{ $label[$s] ?? $s }}</span>
                                </td>
                                <td class="px-4 py-3 text-right whitespace-nowrap">
                                    @if ($s !== 'diperbaiki')
                                        <div class="inline-flex gap-2">
                                            @if ($s !== 'diterima')
                                                <form method="POST" action="{{ route('anomali.update', $a['id']) }}">
                                                    @csrf @method('PATCH')
                                                    <input type="hidden" name="status" value="diterima">
                                                    <button class="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">Terima</button>
                                                </form>
                                            @endif
                                            @if ($s !== 'ditolak')
                                                <form method="POST" action="{{ route('anomali.update', $a['id']) }}">
                                                    @csrf @method('PATCH')
                                                    <input type="hidden" name="status" value="ditolak">
                                                    <button class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Tolak</button>
                                                </form>
                                            @endif
                                            @if ($s !== 'pending')
                                                <form method="POST" action="{{ route('anomali.update', $a['id']) }}">
                                                    @csrf @method('PATCH')
                                                    <input type="hidden" name="status" value="pending">
                                                    <button class="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-ink">Batalkan</button>
                                                </form>
                                            @endif
                                        </div>
                                    @endif
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="6" class="px-4 py-10 text-center text-slate-600">Tidak ada anomali dengan pilihan ini.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <form method="POST" action="{{ route('anomali.terapkan', $id) }}"
                  onsubmit="return confirm('Baris yang ditolak akan dibuang dari data bersih. Lanjutkan?');"
                  class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5">
                @csrf
                <p class="max-w-xl text-sm text-slate-600">
                    {{ $hitung['ditolak'] }} baris ditolak akan dibuang dari data bersih. Hasilnya disimpan sebagai versi baru,
                    versi sebelumnya tetap ada.
                </p>
                <button type="submit" @disabled($hitung['ditolak'] === 0)
                        class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                    Terapkan hasil review
                </button>
            </form>
        </section>
@endsection
