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

        <form method="POST" action="{{ route('datasets.clean', $id) }}"
              onsubmit="this.querySelector('button').disabled = true; this.querySelector('button').textContent = 'Membersihkan…';">
            @csrf
            <button type="submit"
                    class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {{ $bersih ? 'Bersihkan ulang' : 'Bersihkan data' }}
            </button>
        </form>
    </div>

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
    @if (session('laporan'))
        @php $r = session('laporan'); @endphp
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
