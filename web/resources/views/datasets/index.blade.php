@extends('layouts.app')
@section('title', 'Dataset')

@section('content')
    <div class="mb-8">
        <h1 class="text-2xl font-bold">Dataset</h1>
        <p class="mt-1 text-slate-600 max-w-xl">
            Unggah data mentah, bersihkan, lalu lihat tren dan prediksinya.
        </p>
    </div>

    @if ($offline)
        <div role="alert" class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Layanan data tidak bisa dihubungi. Pastikan Docker sudah menyala, lalu muat ulang halaman.
        </div>
    @endif

    {{-- Area unggah --}}
    <form id="form-unggah" method="POST" action="{{ route('datasets.store') }}" enctype="multipart/form-data">
        @csrf
        <input id="file" type="file" name="file" accept=".csv,.xlsx,.xls" class="peer sr-only">
        <label id="zona" for="file"
               class="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-white px-6 py-10 text-center cursor-pointer transition hover:border-brand-600 hover:bg-brand-50 peer-focus-visible:border-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600">
            <svg class="h-9 w-9 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
            </svg>
            <span id="nama-file" class="font-semibold">Seret file ke sini atau pilih dari komputer</span>
            <span class="text-sm text-slate-500">CSV atau Excel (.xlsx), maksimal 10 MB</span>
        </label>

        @error('file')
            <p class="mt-3 text-sm text-red-700" role="alert">{{ $message }}</p>
        @enderror

        <div class="mt-4 flex justify-end">
            <button id="tombol" type="submit" disabled
                    class="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                Unggah dataset
            </button>
        </div>
    </form>

    {{-- Daftar dataset --}}
    <section class="mt-10">
        <h2 class="text-lg font-semibold mb-3">Dataset yang sudah diunggah</h2>

        @if (count($datasets) === 0)
            <div class="rounded-xl border border-line bg-white px-6 py-10 text-center text-slate-600">
                Belum ada dataset. Unggah file pertama di atas untuk memulai.
            </div>
        @else
            <div class="overflow-x-auto rounded-xl border border-line bg-white">
                <table class="w-full text-sm">
                    <thead class="text-left text-slate-500">
                        <tr class="border-b border-line">
                            <th class="px-5 py-3 font-medium">Nama dataset</th>
                            <th class="px-5 py-3 font-medium">Tahap</th>
                            <th class="px-5 py-3 font-medium hidden sm:table-cell">Diunggah</th>
                            <th class="px-5 py-3"><span class="sr-only">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-line">
                        @foreach ($datasets as $d)
                            @php
                                $did = $d['id'] ?? $d['dataset_id'] ?? 0;
                                $urut = ['uploaded' => 1, 'cleaned' => 2, 'forecasted' => 3];
                                $label = [1 => 'Diunggah', 2 => 'Dibersihkan', 3 => 'Sudah diprediksi'];
                                $n = $urut[$d['status'] ?? 'uploaded'] ?? 1;
                                try {
                                    $waktu = \Carbon\Carbon::parse($d['uploaded_at'] ?? null)
                                        ->timezone('Asia/Jakarta')->format('d/m/Y H:i');
                                } catch (\Throwable $e) {
                                    $waktu = '-';
                                }
                            @endphp
                            <tr class="hover:bg-brand-50/60">
                                <td class="px-5 py-3.5">
                                    <a href="{{ route('datasets.show', $did) }}" class="font-semibold text-ink hover:underline">
                                        {{ $d['nama'] ?? 'Dataset #'.$did }}
                                    </a>
                                    <div class="text-xs text-slate-500">Dataset #{{ $did }}</div>
                                </td>
                                <td class="px-5 py-3.5">
                                    <div class="flex items-center gap-3">
                                        <div class="flex gap-1" aria-hidden="true">
                                            @for ($i = 1; $i <= 3; $i++)
                                                <span class="h-1.5 w-6 rounded-full {{ $i <= $n ? 'bg-brand-600' : 'bg-line' }}"></span>
                                            @endfor
                                        </div>
                                        <span class="font-medium text-brand-700">{{ $label[$n] }}</span>
                                    </div>
                                </td>
                                <td class="px-5 py-3.5 text-slate-600 hidden sm:table-cell tabular-nums">{{ $waktu }}</td>
                                <td class="px-5 py-3.5 text-right">
                                    <a href="{{ route('datasets.show', $did) }}" class="font-medium text-brand-700 hover:underline">Buka</a>
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endif
    </section>

    <script>
        const input = document.getElementById('file');
        const zona = document.getElementById('zona');
        const nama = document.getElementById('nama-file');
        const tombol = document.getElementById('tombol');
        const form = document.getElementById('form-unggah');
        const aktif = ['border-brand-600', 'bg-brand-50'];

        function pilih() {
            if (input.files.length) {
                nama.textContent = input.files[0].name;
                tombol.disabled = false;
            }
        }
        input.addEventListener('change', pilih);
        ['dragenter', 'dragover'].forEach(e => zona.addEventListener(e, ev => {
            ev.preventDefault(); zona.classList.add(...aktif);
        }));
        ['dragleave', 'drop'].forEach(e => zona.addEventListener(e, ev => {
            ev.preventDefault(); zona.classList.remove(...aktif);
        }));
        zona.addEventListener('drop', ev => {
            if (ev.dataTransfer.files.length) { input.files = ev.dataTransfer.files; pilih(); }
        });
        form.addEventListener('submit', () => {
            tombol.disabled = true;
            tombol.textContent = 'Mengunggah…';
        });
    </script>
@endsection
