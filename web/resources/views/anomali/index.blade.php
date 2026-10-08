@extends('layouts.app')
@section('title', 'Review anomali')

@section('content')
    @php
        $nama = $dataset['nama'] ?? "Dataset #{$id}";
        $label = ['pending' => 'Menunggu review', 'diterima' => 'Diterima', 'ditolak' => 'Ditolak'];
        $gaya = ['pending' => 'bg-amber-50 text-amber-800', 'diterima' => 'bg-brand-50 text-brand-700', 'ditolak' => 'bg-red-50 text-red-700'];
        $total = array_sum($hitung);
        $pill = [
            ['k' => null, 't' => 'Semua', 'n' => $total],
            ['k' => 'pending', 't' => 'Menunggu', 'n' => $hitung['pending']],
            ['k' => 'diterima', 't' => 'Diterima', 'n' => $hitung['diterima']],
            ['k' => 'ditolak', 't' => 'Ditolak', 'n' => $hitung['ditolak']],
        ];
    @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold">Review anomali</h1>
    <p class="mt-1 mb-6 max-w-2xl text-slate-600">
        Periksa data yang mencurigakan. Pilih <strong class="font-semibold">Terima</strong> kalau datanya benar,
        atau <strong class="font-semibold">Tolak</strong> kalau datanya salah dan perlu dibuang.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'anomali'])

    @if ($total === 0)
        <div class="rounded-xl border border-line bg-white px-6 py-12 text-center text-slate-600">
            Belum ada anomali. Kalau data belum dibersihkan, jalankan <strong class="font-semibold">Bersihkan data</strong> di tab Data.
        </div>
    @else
        <div class="mb-5 flex flex-wrap gap-2">
            @foreach ($pill as $p)
                @php $aktif = $filter === $p['k']; @endphp
                <a href="{{ route('anomali.index', array_filter(['id' => $id, 'status' => $p['k']])) }}"
                   @if ($aktif) aria-current="true" @endif
                   class="rounded-full border px-4 py-1.5 text-sm font-medium transition
                          {{ $aktif ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-slate-600 hover:border-brand-600' }}">
                    {{ $p['t'] }} <span class="tabular-nums opacity-80">{{ $p['n'] }}</span>
                </a>
            @endforeach
        </div>

        <div class="overflow-x-auto rounded-xl border border-line bg-white">
            <table class="w-full text-sm">
                <thead class="text-left text-slate-500">
                    <tr class="border-b border-line">
                        <th class="px-4 py-3 font-medium">No. baris</th>
                        <th class="px-4 py-3 font-medium">Kolom</th>
                        <th class="px-4 py-3 font-medium">Alasan</th>
                        <th class="px-4 py-3 font-medium">Status</th>
                        <th class="px-4 py-3"><span class="sr-only">Aksi</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-line">
                    @forelse ($anomali as $a)
                        @php $s = $a['status'] ?? 'pending'; @endphp
                        <tr class="hover:bg-brand-50/60">
                            <td class="px-4 py-3 tabular-nums">{{ $a['row_index'] }}</td>
                            <td class="px-4 py-3 font-medium">{{ $a['kolom'] }}</td>
                            <td class="px-4 py-3 text-slate-700 max-w-md">{{ $a['alasan'] }}</td>
                            <td class="px-4 py-3">
                                <span class="rounded-full px-2.5 py-1 text-xs font-medium {{ $gaya[$s] ?? $gaya['pending'] }}">
                                    {{ $label[$s] ?? $s }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
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
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="px-4 py-10 text-center text-slate-600">Tidak ada anomali dengan status ini.</td></tr>
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
    @endif
@endsection
