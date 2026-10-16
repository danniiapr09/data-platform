@extends('layouts.app')
@section('title', 'Dataset')

@section('content')
    <x-halaman-header
        judul="Dataset"
        deskripsi="Unggah data mentah, bersihkan, lalu lihat tren dan prediksinya."
    />

    @if ($offline)
        <x-notifikasi
            tipe="peringatan"
            pesan="Layanan data tidak bisa dihubungi. Pastikan Docker sudah menyala, lalu muat ulang halaman."
            class="mb-6"
        />
    @endif

    {{-- Area unggah --}}
    <form id="form-unggah" method="POST" action="{{ route('datasets.store') }}" enctype="multipart/form-data">
        @csrf
        <div class="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
                <label for="nama" class="mb-1 block text-sm font-medium">Nama dataset <span class="font-normal text-slate-500">(opsional)</span></label>
                <input id="nama" name="nama" type="text" maxlength="150" value="{{ old('nama') }}"
                       placeholder="Misalnya: Jumlah siswa 2019 sampai 2024"
                       class="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
            </div>
            <div>
                <label for="jenis" class="mb-1 block text-sm font-medium">Jenis data <span class="font-normal text-slate-500">(opsional)</span></label>
                <input id="jenis" name="jenis" type="text" maxlength="50" value="{{ old('jenis') }}"
                       placeholder="Misalnya: pendidikan"
                       class="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
            </div>
        </div>

        {{-- Zona seret file — id, class, dan JS tidak diubah --}}
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

        {{-- Tombol submit tetap manual (ada JS yang mengelola disabled-nya) --}}
        <div class="mt-4 flex justify-end">
            <button id="tombol" type="submit" disabled
                    class="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                Unggah dataset
            </button>
        </div>
    </form>

    {{-- Daftar dataset --}}
    <section class="mt-10">
        <h2 class="text-base font-semibold text-ink mb-3">Dataset yang sudah diunggah</h2>

        @if (count($datasets) === 0)
            <x-keadaan-kosong
                judul="Belum ada dataset."
                deskripsi="Unggah file pertama di atas untuk memulai."
            />
        @else
            <div class="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-line bg-slate-50/60">
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nama dataset</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tahap</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Diunggah</th>
                            <th class="px-5 py-3"><span class="sr-only">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-line">
                        @foreach ($datasets as $d)
                            @php
                                $did    = $d['id'] ?? $d['dataset_id'] ?? 0;
                                $status = $d['status'] ?? 'uploaded';
                                try {
                                    $waktu = \Carbon\Carbon::parse($d['uploaded_at'] ?? null)
                                        ->timezone('Asia/Jakarta')->format('d/m/Y H:i');
                                } catch (\Throwable $e) {
                                    $waktu = '-';
                                }
                            @endphp
                            <tr class="transition-colors duration-150 hover:bg-brand-50/60">
                                <td class="px-5 py-4">
                                    <a href="{{ route('datasets.show', $did) }}" class="font-semibold text-ink hover:underline">
                                        {{ $d['nama'] ?? 'Dataset #'.$did }}
                                    </a>
                                    <div class="text-xs text-slate-500 mt-0.5">Dataset #{{ $did }}</div>
                                </td>
                                <td class="px-5 py-4">
                                    <x-badge :status="$status" />
                                </td>
                                <td class="px-5 py-4 text-slate-600 hidden sm:table-cell tabular-nums">{{ $waktu }}</td>
                                <td class="px-5 py-4 text-right">
                                    <a href="{{ route('datasets.show', $did) }}"
                                       class="text-sm font-semibold text-brand-700 hover:underline">
                                        Buka
                                    </a>
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endif
    </section>

    {{-- JS drag-drop tidak diubah sama sekali --}}
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
