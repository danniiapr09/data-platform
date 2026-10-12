@extends('layouts.app')
@section('title', 'Ringkasan statistik')

@section('content')
    @php $nama = $dataset['nama'] ?? "Dataset #{$id}"; @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold">Ringkasan statistik</h1>
    <p class="mt-1 mb-6 max-w-2xl text-slate-600">Gambaran isi data: nilai tengah, sebaran, dan hubungan antar kolom.</p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'statistik'])

    @if ($belumBersih ?? false)
        <div class="rounded-xl border border-line bg-white px-6 py-12 text-center">
            <p class="text-slate-600">Data belum dibersihkan, jadi belum bisa diringkas.</p>
            <a href="{{ route('datasets.show', $id) }}"
               class="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Buka tab Data</a>
        </div>
    @else
        @php
            $fmt = fn ($v) => $v === null ? '-' : number_format($v, abs($v) >= 100 ? 0 : 2, ',', '.');
            $numerik = $eda['ringkasan']['numerik'] ?? [];
            $kategorikal = $eda['ringkasan']['kategorikal'] ?? [];
            $pasangan = $eda['korelasi']['pasangan_teratas'] ?? [];
            $bins = $dist['bins'] ?? [];
            $puncak = collect($bins)->sortByDesc('jumlah')->first();
        @endphp

        <p class="mb-6 text-sm text-slate-600">
            Data berisi {{ number_format($eda['jumlah_baris'] ?? 0, 0, ',', '.') }} baris@if (! empty($eda['kolom_waktu'])), dengan kolom waktu <strong class="font-semibold">{{ $eda['kolom_waktu'] }}</strong>@endif.
        </p>

        {{-- Statistik kolom angka --}}
        <section class="mb-6 rounded-xl border border-line bg-white">
            <h2 class="border-b border-line px-5 py-4 font-semibold">Kolom angka</h2>
            @if (count($numerik))
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-slate-500">
                            <tr class="border-b border-line">
                                <th class="px-4 py-3 font-medium">Kolom</th>
                                <th class="px-4 py-3 font-medium text-right">Terisi</th>
                                <th class="px-4 py-3 font-medium text-right">Kosong</th>
                                <th class="px-4 py-3 font-medium text-right">Rata-rata</th>
                                <th class="px-4 py-3 font-medium text-right">Median</th>
                                <th class="px-4 py-3 font-medium text-right">Terkecil</th>
                                <th class="px-4 py-3 font-medium text-right">Terbesar</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-line tabular-nums">
                            @foreach ($numerik as $k => $s)
                                <tr class="hover:bg-brand-50/60">
                                    <td class="px-4 py-3 font-medium">{{ $k }}</td>
                                    <td class="px-4 py-3 text-right">{{ $fmt($s['jumlah'] ?? null) }}</td>
                                    <td class="px-4 py-3 text-right">
                                        @if (($s['kosong'] ?? 0) > 0)
                                            <span class="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">{{ $s['kosong'] }}</span>
                                        @else
                                            0
                                        @endif
                                    </td>
                                    <td class="px-4 py-3 text-right">{{ $fmt($s['rata_rata'] ?? null) }}</td>
                                    <td class="px-4 py-3 text-right">{{ $fmt($s['median'] ?? null) }}</td>
                                    <td class="px-4 py-3 text-right">{{ $fmt($s['min'] ?? null) }}</td>
                                    <td class="px-4 py-3 text-right">{{ $fmt($s['max'] ?? null) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @else
                <p class="px-5 py-8 text-center text-slate-600">Tidak ada kolom angka di dataset ini.</p>
            @endif
        </section>

        {{-- Sebaran --}}
        @if ($kolom && count($bins))
            <section class="mb-6 rounded-xl border border-line bg-white p-5">
                <div class="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 class="font-semibold">Sebaran {{ $kolom }}</h2>
                        @if ($puncak)
                            <p class="mt-1 text-sm text-slate-600">
                                Paling banyak data ada di rentang {{ $fmt($puncak['dari']) }} sampai {{ $fmt($puncak['sampai']) }}
                                ({{ $puncak['jumlah'] }} baris).
                            </p>
                        @endif
                    </div>
                    <form method="GET" action="{{ route('statistik.index', $id) }}">
                        <label for="kolom" class="mb-1 block text-sm font-medium">Kolom</label>
                        <select id="kolom" name="kolom" onchange="this.form.submit()"
                                class="min-w-44 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                            @foreach ($kandidat as $k)
                                <option value="{{ $k }}" @selected($k === $kolom)>{{ $k }}</option>
                            @endforeach
                        </select>
                    </form>
                </div>
                <div class="mt-4 h-64"><canvas id="histogram" role="img" aria-label="Sebaran {{ $kolom }}"></canvas></div>
            </section>
        @endif

        {{-- Hubungan antar kolom --}}
        <section class="mb-6 rounded-xl border border-line bg-white p-5">
            <h2 class="font-semibold">Hubungan antar kolom</h2>
            @if (count($pasangan))
                <p class="mt-1 mb-4 text-sm text-slate-600">Makin dekat ke 1, makin searah. Makin dekat ke -1, makin berlawanan arah.</p>
                <div class="space-y-3">
                    @foreach ($pasangan as $p)
                        <div>
                            <div class="mb-1 flex justify-between text-sm">
                                <span>{{ $p['kolom_a'] }} dan {{ $p['kolom_b'] }}</span>
                                <span class="font-semibold tabular-nums">{{ number_format($p['korelasi'], 2, ',', '.') }}</span>
                            </div>
                            <div class="h-2 rounded-full bg-line" aria-hidden="true">
                                <div class="h-2 rounded-full {{ $p['korelasi'] >= 0 ? 'bg-brand-600' : 'bg-amber-500' }}"
                                     style="width: {{ min(100, abs($p['korelasi']) * 100) }}%"></div>
                            </div>
                        </div>
                    @endforeach
                </div>
            @else
                <p class="mt-2 text-sm text-slate-600">Butuh minimal dua kolom angka untuk melihat hubungan antar kolom.</p>
            @endif
        </section>

        {{-- Kolom teks --}}
        @if (count($kategorikal))
            <section class="rounded-xl border border-line bg-white">
                <h2 class="border-b border-line px-5 py-4 font-semibold">Kolom teks</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-slate-500">
                            <tr class="border-b border-line">
                                <th class="px-4 py-3 font-medium">Kolom</th>
                                <th class="px-4 py-3 font-medium text-right">Jumlah nilai berbeda</th>
                                <th class="px-4 py-3 font-medium text-right">Kosong</th>
                                <th class="px-4 py-3 font-medium">Paling sering muncul</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-line">
                            @foreach ($kategorikal as $k => $s)
                                <tr class="hover:bg-brand-50/60">
                                    <td class="px-4 py-3 font-medium">{{ $k }}</td>
                                    <td class="px-4 py-3 text-right tabular-nums">{{ $s['unik'] ?? '-' }}</td>
                                    <td class="px-4 py-3 text-right tabular-nums">{{ $s['kosong'] ?? 0 }}</td>
                                    <td class="px-4 py-3 text-slate-700">
                                        {{ collect($s['teratas'] ?? [])->map(fn ($t) => $t['nilai'].' ('.$t['jumlah'].')')->implode(', ') }}
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </section>
        @endif

        @if ($kolom && count($bins))
            <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
            <script>
                const bins = @json($bins);
                const angka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
                new Chart(document.getElementById('histogram'), {
                    type: 'bar',
                    data: {
                        labels: bins.map(b => `${angka.format(b.dari)} sampai ${angka.format(b.sampai)}`),
                        datasets: [{ label: 'Jumlah baris', data: bins.map(b => b.jumlah), backgroundColor: '#1E6B5C', borderRadius: 4 }],
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#E8EEEC' } }, x: { grid: { display: false } } },
                    },
                });
            </script>
        @endif
@endsection
