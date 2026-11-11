@extends('layouts.app')
@section('title', 'Analisis dan prediksi')

@section('content')
    @php
        $nama = $dataset['nama'] ?? "Dataset #{$id}";
    @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold">Analisis dan prediksi</h1>
    <p class="mt-1 mb-6 max-w-2xl text-slate-600">
        Lihat perkembangan data dari waktu ke waktu, lalu perkirakan periode berikutnya.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'analisis'])

    @if ($belumBersih ?? false)
        <div class="rounded-xl border border-line bg-white px-6 py-12 text-center">
            <p class="text-slate-600">Data belum dibersihkan, jadi belum bisa dianalisis.</p>
            <a href="{{ route('datasets.show', $id) }}"
               class="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                Buka tab Data
            </a>
        </div>
    @else
        @php
            $fmt = fn ($v) => $v === null ? '-' : number_format($v, abs($v) >= 100 ? 0 : 2, ',', '.');
            $arah = ['naik' => 'naik', 'turun' => 'turun', 'stabil' => 'stabil', 'data kurang' => 'belum cukup data untuk dinilai'];
            $namaModel = [
                'naive' => 'Nilai terakhir (naive)',
                'moving_average' => 'Rata-rata bergerak',
                'drift' => 'Drift',
                'linear_trend' => 'Tren linear',
            ];
            $namaAgg = [
                'sum' => 'Total (sum)',
                'mean' => 'Rata-rata (mean)',
                'median' => 'Median',
                'min' => 'Nilai minimum (min)',
                'max' => 'Nilai maksimum (max)',
            ];
        @endphp

        {{-- Pilihan indikator --}}
        <form method="GET" action="{{ route('analisis.index', $id) }}" id="form-pilih"
              class="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-line bg-white p-5">
            <div>
                <label for="nilai" class="mb-1 block text-sm font-medium">Data yang dianalisis</label>
                <select id="nilai" name="nilai" onchange="this.form.submit()"
                        class="min-w-48 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                    @foreach ($kandidat as $k)
                        <option value="{{ $k }}" @selected($k === $nilai)>{{$k }}</option>
                    @endforeach
                </select>
            </div>
            <div>
                <label for="agg" class="mb-1 block text-sm font-medium">Hitung sebagai</label>
                <select id="agg" name="agg" onchange="this.form.submit()"
                        class="rounded-lg border border-line bg-white px-3 py-2 text-sm">
                    <option value="sum" @selected($agg === 'sum')>Total per periode</option>
                    <option value="mean" @selected($agg === 'mean')>Rata-rata per periode</option>
                    <option value="median" @selected($agg === 'median')>Nilai tengah (median) per periode</option>
                    <option value="min" @selected($agg === 'min')>Nilai terkecil (minimum) per periode</option>
                    <option value="max" @selected($agg === 'max')>Nilai terbesar (maksimum) per periode</option>
                </select>
            </div>
            @if (count($kategori))
                <div>
                    <label for="kelompok" class="mb-1 block text-sm font-medium">Bandingkan per</label>
                    <select id="kelompok" name="kelompok" onchange="this.form.submit()"
                            class="min-w-44 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                        <option value="">Tidak dibandingkan</option>
                        @foreach ($kategori as $k)
                            <option value="{{ $k }}" @selected($k === $kelompok)>{{$k }}</option>
                        @endforeach
                    </select>
                </div>
            @endif
            <noscript><button class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Tampilkan</button></noscript>
        </form>

        {{-- Banner jika ada prediksi tersimpan untuk indikator lain --}}
        @if ($prediksiTersimpanLain)
            <div class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
                <div>
                    Tersedia prediksi tersimpan untuk data <strong>{{ $prediksiTersimpanLain['indikator'] }}</strong>
                    @if (! empty($prediksiTersimpanLain['dibuat']))
                        (dibuat {{ \Carbon\Carbon::parse($prediksiTersimpanLain['dibuat'])->locale('id')->isoFormat('D MMMM Y, HH:mm') }})
                    @endif.
                </div>
                <a href="{{ route('analisis.index', ['id' => $id, 'nilai' => $prediksiTersimpanLain['indikator'], 'agg' => $agg]) }}"
                   class="inline-block rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                    Tampilkan prediksi tersimpan
                </a>
            </div>
        @endif

        @if (count($kandidat) === 0)
            <div class="rounded-xl border border-line bg-white px-6 py-12 text-center text-slate-600">
                Tidak ada kolom angka yang bisa dianalisis di dataset ini.
            </div>
        @elseif ($galat)
            <div role="alert" class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">{{ $galat }}</div>
        @elseif ($tren)
            @php
                $slope =$tren['total']['slope_per_periode'] ?? null;
                $a =$tren['total']['arah'] ?? 'data kurang';
            @endphp

            {{-- Grafik --}}
            <section class="rounded-xl border border-line bg-white p-5">
                <h2 class="font-semibold">Perkembangan {{ $nilai }}</h2>
                <p class="mt-1 text-sm text-slate-600">
                    Secara keseluruhan datanya {{ $arah[$a] ?? $a }}@if ($slope !== null &&$a !== 'data kurang'),
                    dengan perubahan rata-rata {{ $fmt($slope) }} per periode @endif.
                </p>
                <div class="mt-4 h-80">
                    <canvas id="grafik" role="img" aria-label="Grafik perkembangan {{ $nilai }}"></canvas>
                </div>
                @if ($grafikKelompok)
                    <ul class="mt-4 flex flex-wrap gap-2 text-sm">
                        @foreach ($grafikKelompok['seri'] as $s)
                            <li class="rounded-full border border-line bg-slate-50 px-3 py-1">
                                {{ $s['nama'] }}: <span class="font-medium">{{ $arah[$s['arah']] ?? $s['arah'] }}</span>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </section>

            {{-- Buat prediksi --}}
            <section class="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-card">
                <h2 class="text-base font-bold text-ink">Prediksi</h2>
                @if ($kelompok)
                    <p class="mt-1 text-xs text-slate-500">Prediksi dibuat untuk total keseluruhan data, bukan dipisahkan per {{ $kelompok }}.</p>
                @endif

                {{-- Peringatan Prediksi Tersimpan (A6) --}}
                @if ($forecastTersimpanAktif)
                    <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 flex items-start gap-3">
                        <svg class="h-5 w-5 text-amber-700 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <div>
                            <div class="font-bold">Peringatan: Satu Prediksi Aktif per Dataset</div>
                            <p class="mt-0.5 leading-relaxed">
                                Sistem hanya menyimpan satu hasil prediksi aktif per dataset. Saat ini tersimpan prediksi untuk indikator <strong>{{ $forecastTersimpanAktif['indikator'] ?? '-' }}</strong>@if(!empty($forecastTersimpanAktif['dibuat'])) (dibuat {{ \Carbon\Carbon::parse($forecastTersimpanAktif['dibuat'])->locale('id')->isoFormat('D MMMM Y, HH:mm') }})@endif.
                                Menjalankan prediksi baru akan <strong>menggantikan</strong> data ramalan yang tersimpan sebelumnya.
                            </p>
                            @if (! empty($forecastTersimpanAktif['agg']))
                                <p class="mt-1 text-amber-900">
                                    Metode agregasi tersimpan: <strong>{{ $namaAgg[$forecastTersimpanAktif['agg']] ?? $forecastTersimpanAktif['agg'] }}</strong>.
                                </p>
                            @else
                                <p class="mt-1 text-amber-800 italic">
                                    Metode agregasi: - (agregasi tidak tersimpan pada data prediksi lama, sehingga grafik memadukan ramalan dengan rumus hitungan yang sedang Anda pilih).
                                </p>
                            @endif
                        </div>
                    </div>
                @endif

                <form method="POST" action="{{ route('analisis.prediksi', $id) }}"
                      onsubmit="const b=this.querySelector('button'); b.disabled=true; b.textContent='Membuat prediksi…';"
                      class="mt-4 flex flex-wrap items-end gap-4">
                    @csrf
                    <input type="hidden" name="nilai" value="{{ $nilai }}">
                    <input type="hidden" name="agg" value="{{ $agg }}">
                    <input type="hidden" name="kelompok" value="{{ $kelompok }}">
                    <div>
                        <label for="horizon" class="mb-1 block text-sm font-semibold text-ink">Jumlah periode ke depan</label>
                        <input id="horizon" name="horizon" type="number" min="1" max="12"
                               value="{{ old('horizon', $prediksi ? count($prediksi['prediksi']) : 3) }}"
                               class="w-32 rounded-xl border border-line bg-white px-3.5 py-2 text-sm tabular-nums focus-visible:outline-brand-600">
                        @error('horizon') <p class="mt-1 text-xs font-semibold text-red-600" role="alert">{{ $message }}</p> @enderror
                    </div>
                    <button type="submit"
                            class="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-700 disabled:opacity-50">
                        {{ $prediksi ? 'Buat ulang prediksi' : 'Buat prediksi' }}
                    </button>
                </form>

                @if ($prediksi)
                    @php
                        $dariBackend = $prediksi['dari_backend'] ?? false;
                        $adaKisaran = ! empty($grafik['adaKisaran']);
                    @endphp

                    @if ($dariBackend)
                        <div class="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-xs text-slate-600">
                            <p class="font-medium text-slate-800">Menampilkan hasil prediksi lengkap dari laporan tersimpan</p>
                            <p class="mt-1">
                                Dibuat pada: <strong>{{ ! empty($prediksi['dibuat']) ? \Carbon\Carbon::parse($prediksi['dibuat'])->locale('id')->isoFormat('D MMMM Y, HH:mm') : '-' }}</strong>.
                                Jika data diubah atau dibersihkan ulang sesudah tanggal ini, buat prediksi ulang.
                            </p>
                            @if (! empty($prediksi['agg']))
                                <p class="mt-1 text-slate-700">
                                    Metode agregasi yang digunakan: <strong>{{ $namaAgg[$prediksi['agg']] ?? $prediksi['agg'] }}</strong>.
                                </p>
                            @else
                                <p class="mt-1 text-slate-500 italic">
                                    Metode agregasi: - (agregasi tidak tersimpan pada data prediksi lama).
                                </p>
                            @endif
                        </div>
                    @endif

                    <div class="mt-6 grid gap-6 lg:grid-cols-2">
                        <div>
                            <h3 class="mb-2 text-sm font-semibold">Hasil perkiraan</h3>
                            <div class="overflow-hidden rounded-lg border border-line">
                                <table class="w-full text-sm">
                                    <thead class="bg-slate-50 text-left text-slate-600">
                                        <tr>
                                            <th class="px-4 py-2 font-semibold">Periode</th>
                                            <th class="px-4 py-2 font-semibold text-right">Perkiraan</th>
                                            @if ($adaKisaran)
                                                <th class="px-4 py-2 font-semibold text-right">Kisaran</th>
                                            @endif
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-line tabular-nums">
                                        @foreach ($prediksi['prediksi'] as $p)
                                            <tr>
                                                <td class="px-4 py-2">{{ (string) $p['periode'] }}</td>
                                                <td class="px-4 py-2 text-right font-semibold">{{ $p['nilai'] !== null ? $fmt($p['nilai']) : '-' }}</td>
                                                @if ($adaKisaran)
                                                    <td class="px-4 py-2 text-right text-slate-500">
                                                        {{ ($p['bawah'] !== null && $p['atas'] !== null) ? $fmt($p['bawah']).' sampai '.$fmt($p['atas']) : '-' }}
                                                    </td>
                                                @endif
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h3 class="mb-2 text-sm font-semibold">Model dan evaluasi</h3>
                            @if (! empty($prediksi['evaluasi']))
                                <p class="mb-2 text-sm text-slate-600">
                                    Model terpilih: <strong class="font-semibold">{{ $namaModel[$prediksi['model_terbaik']] ?? $prediksi['model_terbaik'] }}</strong>,
                                    karena paling kecil kesalahannya pada {{ $prediksi['periode_uji'] ?? 'beberapa' }} periode terakhir.
                                </p>
                                <div class="overflow-hidden rounded-lg border border-line">
                                    <table class="w-full text-sm">
                                        <thead class="bg-slate-50 text-left text-slate-600">
                                            <tr>
                                                <th class="px-4 py-2 font-semibold">Model</th>
                                                <th class="px-4 py-2 font-semibold text-right" title="Mean Absolute Error">Rata-rata selisih (MAE)</th>
                                                <th class="px-4 py-2 font-semibold text-right" title="Mean Absolute Percentage Error">Persentase selisih (MAPE)</th>
                                                <th class="px-4 py-2 font-semibold text-right" title="Root Mean Squared Error">RMSE</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-line tabular-nums">
                                            @foreach ($prediksi['evaluasi'] as $e)
                                                <tr class="{{ $loop->first ? 'bg-brand-50 font-semibold' : '' }}">
                                                    <td class="px-4 py-2">{{ $namaModel[$e['model']] ?? $e['model'] }}</td>
                                                    <td class="px-4 py-2 text-right">{{ $e['mae'] !== null ? $fmt($e['mae']) : '-' }}</td>
                                                    <td class="px-4 py-2 text-right">{{ $e['mape'] === null ? '-' : $fmt($e['mape']).'%' }}</td>
                                                    <td class="px-4 py-2 text-right">{{ ($e['rmse'] ?? null) !== null ? $fmt($e['rmse']) : '-' }}</td>
                                                </tr>
                                            @endforeach
                                        </tbody>
                                    </table>
                                </div>
                                <p class="mt-2 text-xs text-slate-500">Rata-rata selisih (MAE), persentase selisih (MAPE), dan RMSE mengukur penyimpangan hasil ramalan terhadap data asli. Semakin kecil nilainya, semakin akurat peramalannya.</p>
                            @else
                                <div class="rounded-lg border border-line p-4 text-sm text-slate-600">
                                    <p class="mb-2">
                                        Model terpilih: <strong class="font-semibold text-slate-800">{{ $namaModel[$prediksi['model_terbaik']] ?? ucwords(str_replace('_', ' ', $prediksi['model_terbaik'])) }}</strong>
                                    </p>
                                    <div class="flex flex-wrap gap-6 text-sm">
                                        <div>
                                            <span class="text-slate-500">Rata-rata selisih (MAE):</span>
                                            <span class="font-semibold text-slate-800">{{ $prediksi['mae'] !== null ? $fmt($prediksi['mae']) : '-' }}</span>
                                        </div>
                                        <div>
                                            <span class="text-slate-500">Persentase selisih (MAPE):</span>
                                            <span class="font-semibold text-slate-800">{{ $prediksi['mape'] !== null ? $fmt($prediksi['mape']).'%' : '-' }}</span>
                                        </div>
                                        <div>
                                            <span class="text-slate-500">RMSE:</span>
                                            <span class="font-semibold text-slate-800">{{ ($prediksi['rmse'] ?? null) !== null ? $fmt($prediksi['rmse']) : '-' }}</span>
                                        </div>
                                    </div>
                                </div>
                            @endif
                        </div>
                    </div>

                    @if (! empty($prediksi['catatan']))
                        <div class="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p class="mb-1 font-semibold">Perlu diperhatikan</p>
                            <ul class="list-disc space-y-1 pl-5">
                                @foreach ($prediksi['catatan'] as $c)
                                    <li>{{ $c }}</li>
                                @endforeach
                            </ul>
                        </div>
                    @endif
                @endif
            </section>

            <script src="{{ asset('js/chart.umd.js') }}"></script>
            <script>
                const g = @json($grafik);
                const k = @json($grafikKelompok);
                const angka = new Intl.NumberFormat('id-ID');
                const sumbu = {
                    y: { grid: { color: '#E8EEEC' }, ticks: { callback: v => angka.format(v) } },
                    x: { grid: { display: false } },
                };
                if (k) {
                    const warna = ['#1E6B5C', '#B7791F', '#2B6CB0', '#9B2C2C', '#6B46C1', '#2C7A7B', '#975A16', '#4A5568'];
                    new Chart(document.getElementById('grafik'), {
                        type: 'line',
                        data: {
                            labels: k.labels,
                            datasets: k.seri.map((s, i) => ({
                                label: s.nama, data: s.data,
                                borderColor: warna[i % warna.length], backgroundColor: warna[i % warna.length],
                                tension: 0.25, pointRadius: 3,
                            })),
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: { labels: { usePointStyle: true } },
                                tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${angka.format(c.parsed.y)}` } },
                            },
                            scales: sumbu,
                        },
                    });
                } else {
                    const datasets = [];
                    if (g.adaKisaran) {
                        datasets.push(
                            { label: 'Batas bawah', data: g.bawah, borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, fill: false },
                            { label: 'Kisaran perkiraan', data: g.atas, borderColor: 'transparent', backgroundColor: 'rgba(30,107,92,0.14)', pointRadius: 0, fill: '-1' }
                        );
                    }
                    datasets.push(
                        { label: 'Data sebenarnya', data: g.aktual, borderColor: '#16231F', backgroundColor: '#16231F', tension: 0.25, pointRadius: 3 },
                        { label: 'Prediksi', data: g.garis, borderColor: '#1E6B5C', backgroundColor: '#1E6B5C', borderDash: [6, 5], tension: 0.25, pointRadius: 3 }
                    );

                    new Chart(document.getElementById('grafik'), {
                        type: 'line',
                        data: {
                            labels: g.labels,
                            datasets: datasets,
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: { labels: { filter: i => i.text !== 'Batas bawah', usePointStyle: true } },
                                tooltip: {
                                    filter: i => ['Data sebenarnya', 'Prediksi'].includes(i.dataset.label),
                                    callbacks: { label: c => ` ${c.dataset.label}: ${angka.format(c.parsed.y)}` },
                                },
                            },
                            scales: sumbu,
                        },
                    });
                }
            </script>
        @endif
    @endif
@endsection
