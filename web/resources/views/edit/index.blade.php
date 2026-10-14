@extends('layouts.app')
@section('title', 'Edit data')

@section('content')
    @php
        $nama = $dataset['nama'] ?? "Dataset #{$id}";
        $labelJenis = ['kosong' => 'Data kosong', 'outlier' => 'Nilai di luar kewajaran', 'format' => 'Format salah'];
    @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold">Edit data</h1>
    <p class="mt-1 mb-6 max-w-2xl text-slate-600">
        Isi data yang kosong atau perbaiki nilai yang salah. Tidak ada data yang dihapus, dan setiap perubahan tercatat di riwayat.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'edit'])

    @if ($belumBersih ?? false)
        <div class="rounded-xl border border-line bg-white px-6 py-12 text-center">
            <p class="text-slate-600">Data belum dibersihkan, jadi belum ada data yang bisa diedit.</p>
            <a href="{{ route('datasets.show', $id) }}"
               class="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Buka tab Data</a>
        </div>
    @else
        @php
            $pill = [
                ['k' => null, 't' => 'Semua', 'n' => $hitung['semua']],
                ['k' => 'kosong', 't' => 'Data kosong', 'n' => $hitung['kosong']],
                ['k' => 'outlier', 't' => 'Di luar kewajaran', 'n' => $hitung['outlier']],
                ['k' => 'format', 't' => 'Format salah', 'n' => $hitung['format']],
            ];
        @endphp

        <div class="mb-5 flex flex-wrap gap-2">
            @foreach ($pill as $p)
                @php $aktif = $jenis === $p['k']; @endphp
                <a href="{{ route('edit.index', array_filter(['id' => $id, 'jenis' => $p['k']])) }}"
                   @if ($aktif) aria-current="true" @endif
                   class="rounded-full border px-4 py-1.5 text-sm font-medium transition {{ $aktif ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-slate-600 hover:border-brand-600' }}">
                    {{ $p['t'] }} <span class="tabular-nums opacity-80">{{ $p['n'] }}</span>
                </a>
            @endforeach
        </div>

        @if ($terpotong)
            <div class="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Daftar ini menampilkan 200 anomali pertama. Simpan perubahan, lalu muat ulang untuk melihat sisanya.
            </div>
        @endif

        @if (count($sel))
            <form method="POST" action="{{ route('edit.simpan', $id) }}" class="rounded-xl border border-line bg-white">
                @csrf
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-slate-500">
                            <tr class="border-b border-line">
                                <th class="px-4 py-3 font-medium">Baris di file</th>
                                <th class="px-4 py-3 font-medium">Kolom</th>
                                <th class="px-4 py-3 font-medium">Masalah</th>
                                <th class="px-4 py-3 font-medium">Nilai baru</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-line">
                            @foreach ($sel as $c)
                                @php $k = $c['id']; @endphp
                                <tr class="hover:bg-brand-50/60">
                                    <td class="px-4 py-3 tabular-nums">{{ $c['baris_file'] }}</td>
                                    <td class="px-4 py-3 font-medium">{{ $c['kolom'] }}</td>
                                    <td class="px-4 py-3 text-slate-700">
                                        {{ implode('; ', array_unique($c['alasan'])) }}
                                    </td>
                                    <td class="px-4 py-3">
                                        <input type="hidden" name="edit[{{ $k }}][row_index]" value="{{ $c['row_index'] }}">
                                        <input type="hidden" name="edit[{{ $k }}][kolom]" value="{{ $c['kolom'] }}">
                                        <input type="text" name="edit[{{ $k }}][nilai]" inputmode="decimal"
                                               value="{{ old("edit.{$k}.nilai") }}"
                                               aria-label="Nilai baru untuk {{ $c['kolom'] }} di baris {{ $c['baris_file'] }}"
                                               placeholder="Isi nilai"
                                               class="w-36 rounded-lg border border-line px-3 py-1.5 text-sm tabular-nums">
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>

                <div class="flex flex-wrap items-end justify-between gap-4 border-t border-line p-5">
                    <div class="min-w-64 flex-1">
                        <label for="alasan" class="mb-1 block text-sm font-medium">Alasan perubahan</label>
                        <input id="alasan" name="alasan" type="text" maxlength="200"
                               value="{{ old('alasan', 'Melengkapi data yang kosong') }}"
                               class="w-full rounded-lg border border-line px-3 py-2 text-sm">
                        @error('alasan') <p class="mt-1 text-sm text-red-700" role="alert">{{ $message }}</p> @enderror
                        <p class="mt-1 text-xs text-slate-500">Tulis angka tanpa titik pemisah ribuan. Baris yang dibiarkan kosong tidak diubah.</p>
                    </div>
                    <button type="submit"
                            class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                        Simpan perubahan
                    </button>
                </div>
            </form>
        @else
            <div class="rounded-xl border border-line bg-white px-6 py-12 text-center text-slate-600">
                Tidak ada data yang perlu diisi atau diperbaiki.
            </div>
        @endif

        {{-- Riwayat edit --}}
        <section class="mt-6 rounded-xl border border-line bg-white p-5">
            <h2 class="font-semibold">Riwayat edit</h2>
            <p class="mt-1 text-sm text-slate-600">{{ $ringkasanEdit['deskripsi'] ?? 'Belum ada edit manual.' }}</p>

            @if (count($riwayatEdit))
                @php $kolomEdit = array_keys($riwayatEdit[0]); @endphp
                <div class="mt-4 max-h-80 overflow-auto rounded-lg border border-line">
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-slate-50 text-left text-slate-600">
                            <tr>
                                @foreach ($kolomEdit as $h)
                                    <th class="whitespace-nowrap px-4 py-2 font-semibold">{{ $h }}</th>
                                @endforeach
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-line">
                            @foreach ($riwayatEdit as $r)
                                <tr>
                                    @foreach ($kolomEdit as $h)
                                        @php $v = $r[$h] ?? null; @endphp
                                        <td class="whitespace-nowrap px-4 py-2">{{ is_scalar($v) ? $v : json_encode($v) }}</td>
                                    @endforeach
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </section>
    @endif
@endsection
