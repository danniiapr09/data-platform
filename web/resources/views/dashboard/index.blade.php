@extends('layouts.app')
@section('title', 'Dashboard')

@section('content')
    @php $nama = $dataset['nama'] ?? "Dataset #{$id}"; @endphp

    <nav class="text-sm text-slate-500 mb-4" aria-label="Navigasi halaman">
        <a href="{{ route('datasets.index') }}" class="hover:underline text-brand-700">Dataset</a>
        <span aria-hidden="true">/</span>
        <a href="{{ route('datasets.show', $id) }}" class="hover:underline text-brand-700">{{ $nama }}</a>
    </nav>

    <h1 class="text-2xl font-bold">Dashboard</h1>
    <p class="mt-1 mb-6 max-w-2xl text-slate-600">
        Bandingkan data antar kelompok dan periode. Ubah filter untuk melihat dari sudut pandang lain.
    </p>

    @include('datasets._tabs', ['id' => $id, 'aktif' => 'dashboard'])

    @if ($belumBersih ?? false)
        <div class="rounded-xl border border-line bg-white px-6 py-12 text-center">
            <p class="text-slate-600">Data belum dibersihkan, jadi dashboard belum bisa dibuat.</p>
            <a href="{{ route('datasets.show', $id) }}"
               class="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Buka tab Data</a>
        </div>
    @elseif ($galat)
        <div role="alert" class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">{{ $galat }}</div>
    @elseif (count($kandidat) === 0)
        <div class="rounded-xl border border-line bg-white px-6 py-12 text-center text-slate-600">
            Tidak ada kolom angka yang bisa ditampilkan di dashboard.
        </div>
    @elseif (count($payload['periode']) === 0)
        <div class="rounded-xl border border-line bg-white px-6 py-12 text-center text-slate-600">
            Belum ada data per periode. Pastikan dataset punya kolom waktu, misalnya tahun atau tanggal.
        </div>
    @else
        <div id="galat-js" role="alert" class="mb-4 hidden rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"></div>
        <div id="info-grafik" role="alert" class="mb-4 hidden rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Pustaka grafik tidak berhasil dimuat, jadi diagram belum tampil. Kartu ringkasan, deskripsi, dan tabel tetap bisa dipakai.
            Periksa berkas <code class="rounded bg-white px-1">web/public/js/chart.umd.js</code> (ukurannya harus lebih dari 100 KB), lalu muat ulang halaman.
        </div>

        {{-- Filter dari server --}}
        <form method="GET" action="{{ route('dashboard.index', $id) }}" class="mb-4 rounded-xl border border-line bg-white p-5">
            <div class="flex flex-wrap items-end gap-4">
                <div>
                    <label for="nilai" class="mb-1 block text-sm font-medium">Data yang dilihat</label>
                    <select id="nilai" name="nilai" onchange="this.form.submit()"
                            class="min-w-44 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                        @foreach ($kandidat as $k)
                            <option value="{{ $k }}" @selected($k === $nilai)>{{ $k }}</option>
                        @endforeach
                    </select>
                </div>
                <div>
                    <label for="agg" class="mb-1 block text-sm font-medium">Hitung sebagai</label>
                    <select id="agg" name="agg" onchange="this.form.submit()"
                            class="rounded-lg border border-line bg-white px-3 py-2 text-sm">
                        @foreach ($aggPilihan as $k => $label)
                            <option value="{{ $k }}" @selected($k === $agg)>{{ $label }}</option>
                        @endforeach
                    </select>
                </div>
                @if (count($kategori))
                    <div>
                        <label for="kelompok" class="mb-1 block text-sm font-medium">Bandingkan per</label>
                        <select id="kelompok" name="kelompok" onchange="this.form.submit()"
                                class="min-w-44 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                            <option value="">Tanpa pembanding</option>
                            @foreach ($kategori as $k)
                                <option value="{{ $k }}" @selected($k === $kelompok)>{{ $k }}</option>
                            @endforeach
                        </select>
                    </div>
                @endif
                <noscript><button class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Tampilkan</button></noscript>
            </div>
        </form>

        {{-- Filter tampilan (langsung) --}}
        <div class="mb-6 rounded-xl border border-line bg-white p-5">
            <div class="flex flex-wrap items-end gap-4">
                <div>
                    <label for="f-dari" class="mb-1 block text-sm font-medium">Dari periode</label>
                    <select id="f-dari" class="rounded-lg border border-line bg-white px-3 py-2 text-sm"></select>
                </div>
                <div>
                    <label for="f-sampai" class="mb-1 block text-sm font-medium">Sampai periode</label>
                    <select id="f-sampai" class="rounded-lg border border-line bg-white px-3 py-2 text-sm"></select>
                </div>
                <div>
                    <label for="f-sorot" class="mb-1 block text-sm font-medium">Periode yang disorot</label>
                    <select id="f-sorot" class="rounded-lg border border-line bg-white px-3 py-2 text-sm"></select>
                </div>
                <fieldset>
                    <legend class="mb-1 text-sm font-medium">Jenis grafik</legend>
                    <div class="flex rounded-lg border border-line bg-white p-0.5 text-sm">
                        <label>
                            <input type="radio" name="jenis" value="bar" class="peer sr-only" checked>
                            <span class="block cursor-pointer rounded-md px-3 py-1.5 text-slate-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600">Batang</span>
                        </label>
                        <label>
                            <input type="radio" name="jenis" value="line" class="peer sr-only">
                            <span class="block cursor-pointer rounded-md px-3 py-1.5 text-slate-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600">Garis</span>
                        </label>
                    </div>
                </fieldset>
                <label class="flex items-center gap-2 pb-2 text-sm">
                    <input id="f-tumpuk" type="checkbox" class="h-4 w-4 rounded border-line accent-brand-600 disabled:opacity-40">
                    <span>Batang bertumpuk</span>
                </label>
                <button type="button" id="reset" class="pb-2 text-sm font-medium text-brand-700 hover:underline">Atur ulang tampilan</button>
            </div>

            <div id="baris-kelompok" class="mt-4 border-t border-line pt-4">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <span class="text-sm font-medium">Kelompok yang ditampilkan ({{ $kelompok }})</span>
                        <span id="jumlah-pilih" class="ml-2 text-sm text-slate-500"></span>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-sm">
                        <label for="cari" class="sr-only">Cari kelompok</label>
                        <input id="cari" type="search" placeholder="Cari kelompok"
                               class="w-44 rounded-lg border border-line px-3 py-1.5 text-sm">
                        <button type="button" id="teratas" class="font-medium text-brand-700 hover:underline">6 teratas</button>
                        <button type="button" id="semua" class="font-medium text-brand-700 hover:underline">Pilih semua</button>
                        <button type="button" id="kosong" class="font-medium text-brand-700 hover:underline">Kosongkan</button>
                    </div>
                </div>
                <div id="chips" class="flex max-h-40 flex-wrap gap-2 overflow-y-auto"></div>
            </div>
        </div>

        {{-- Kartu ringkas --}}
        <div id="kartu" class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></div>

        {{-- Grafik --}}
        <div class="grid gap-6 lg:grid-cols-2">
            <section class="min-w-0 rounded-xl border border-line bg-white p-5 shadow-sm lg:col-span-2">
                <div class="flex items-start justify-between gap-3">
                    <h2 class="font-semibold">Perkembangan per periode</h2>
                    <button type="button" data-unduh="c-periode" class="text-sm font-medium text-brand-700 hover:underline">Unduh gambar</button>
                </div>
                <div class="relative mt-4 h-72"><canvas id="c-periode" role="img" aria-label="Grafik perkembangan per periode"></canvas></div>
                <p id="d-periode" class="mt-4 border-t border-line pt-3 text-sm text-slate-600"></p>
            </section>

            <section id="k-banding" class="min-w-0 rounded-xl border border-line bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <h2 class="font-semibold">Perbandingan antar kelompok</h2>
                    <button type="button" data-unduh="c-banding" class="text-sm font-medium text-brand-700 hover:underline">Unduh gambar</button>
                </div>
                <div id="w-banding" class="relative mt-4"><canvas id="c-banding" role="img" aria-label="Grafik perbandingan antar kelompok"></canvas></div>
                <p id="d-banding" class="mt-4 border-t border-line pt-3 text-sm text-slate-600"></p>
            </section>

            <section id="k-komposisi" class="min-w-0 rounded-xl border border-line bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <h2 class="font-semibold">Komposisi kelompok</h2>
                    <button type="button" data-unduh="c-komposisi" class="text-sm font-medium text-brand-700 hover:underline">Unduh gambar</button>
                </div>
                <div id="komposisi-isi">
                    <div class="relative mt-4 h-72"><canvas id="c-komposisi" role="img" aria-label="Grafik komposisi kelompok"></canvas></div>
                </div>
                <p id="komposisi-info" class="mt-4 hidden text-sm text-slate-600">Komposisi hanya tampil untuk hitungan Total, karena bagian dari rata-rata atau median tidak bisa dijumlahkan.</p>
                <p id="d-komposisi" class="mt-4 border-t border-line pt-3 text-sm text-slate-600"></p>
            </section>

            <section class="min-w-0 rounded-xl border border-line bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <h2 class="font-semibold">Pertumbuhan per periode (%)</h2>
                    <button type="button" data-unduh="c-tumbuh" class="text-sm font-medium text-brand-700 hover:underline">Unduh gambar</button>
                </div>
                <div class="relative mt-4 h-72"><canvas id="c-tumbuh" role="img" aria-label="Grafik pertumbuhan per periode"></canvas></div>
                <p id="d-tumbuh" class="mt-4 border-t border-line pt-3 text-sm text-slate-600"></p>
            </section>

            <section id="k-sebaran" class="min-w-0 rounded-xl border border-line bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <h2 class="font-semibold">Sebaran nilai</h2>
                    <button type="button" data-unduh="c-sebaran" class="text-sm font-medium text-brand-700 hover:underline">Unduh gambar</button>
                </div>
                <div class="relative mt-4 h-72"><canvas id="c-sebaran" role="img" aria-label="Grafik sebaran nilai"></canvas></div>
                <p id="d-sebaran" class="mt-4 border-t border-line pt-3 text-sm text-slate-600"></p>
            </section>
        </div>

        {{-- Tabel rincian --}}
        <section class="mt-6 rounded-xl border border-line bg-white shadow-sm">
            <h2 class="border-b border-line px-5 py-4 font-semibold">Tabel rincian</h2>
            <div class="max-h-96 overflow-auto"><table id="tabel" class="w-full text-sm"></table></div>
        </section>

        <script src="{{ asset('js/chart.umd.js') }}"></script>
        <script>
            if (typeof Chart === 'undefined') {
                document.write('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>');
            }
        </script>
        <script>
            const D = {{ \Illuminate\Support\Js::from($payload) }};
        </script>
        @verbatim
        <script>
        (() => {
            const el = id => document.getElementById(id);
            const ada = v => v !== null && v !== undefined;
            const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            const fmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
            const pct = v => ada(v) ? (v > 0 ? '+' : '') + fmt.format(v) + '%' : '-';

            function tampilGalat(e) {
                console.error(e);
                const b = el('galat-js');
                b.textContent = 'Terjadi kesalahan saat menampilkan dashboard: ' + (e && e.message ? e.message : e);
                b.classList.remove('hidden');
            }

            const adaChart = typeof Chart !== 'undefined';
            if (!adaChart) el('info-grafik').classList.remove('hidden');
            else {
                Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif';
                Chart.defaults.color = '#475569';
                Chart.register({
                    id: 'putih',
                    beforeDraw: c => {
                        const x = c.ctx;
                        x.save(); x.globalCompositeOperation = 'destination-over';
                        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore();
                    },
                });
            }

            const P = ['#1E6B5C', '#D9A441', '#3B82A0', '#B5543A', '#7A5C99', '#6FA35B', '#C2688B', '#5B6770', '#2F4F6F', '#A07C2E'];
            const arahLabel = { 'naik': 'naik', 'turun': 'turun', 'stabil': 'stabil', 'data kurang': 'belum cukup data' };

            const adaKel = !!D.kelompok && D.seri.length > 0;
            const n = D.periode.length;
            const grafik = {};

            const warnaIdx = i => i < P.length ? P[i] : 'hsl(' + ((i * 47) % 360) + ' 52% 44%)';
            const warna = nama => { const i = D.seri.findIndex(s => s.nama === nama); return warnaIdx(i < 0 ? 0 : i); };
            const nilaiAkhir = s => { for (let i = n - 1; i >= 0; i--) if (ada(s.nilai[i])) return s.nilai[i]; return -Infinity; };
            const teratas = k => [...D.seri].sort((a, b) => nilaiAkhir(b) - nilaiAkhir(a)).slice(0, k).map(s => s.nama);

            const S = { dari: 0, sampai: n - 1, sorot: n - 1, jenis: 'bar', tumpuk: false, pilih: new Set(teratas(6)) };

            const seriAktif = () => adaKel
                ? D.seri.filter(s => S.pilih.has(s.nama))
                : [{ nama: D.nilai, nilai: D.total.nilai, tumbuh: D.total.tumbuh, arah: D.total.arah }];
            const ix = () => D.periode.map((_, i) => i).filter(i => i >= S.dari && i <= S.sampai);
            const barisSorot = () => seriAktif()
                .map(s => ({ n: s.nama, v: s.nilai[S.sorot] }))
                .filter(x => ada(x.v))
                .sort((a, b) => b.v - a.v);
            const bangun = (id, cfg) => {
                if (!adaChart) return;
                if (grafik[id]) grafik[id].destroy();
                grafik[id] = new Chart(el(id), cfg);
            };
            const sumbuY = (tumpuk, persen) => ({
                stacked: tumpuk,
                grid: { color: '#E8EEEC' },
                ticks: { callback: v => fmt.format(v) + (persen ? '%' : '') },
            });

            function kartu() {
                const p = D.periode[S.sorot];
                const tot = D.total.nilai[S.sorot];
                const tum = D.total.tumbuh[S.sorot];
                const b = barisSorot();
                const isi = [{
                    t: 'Keseluruhan, ' + p,
                    v: ada(tot) ? fmt.format(tot) : '-',
                    k: ada(tum) ? pct(tum) + ' dari periode sebelumnya' : 'Belum ada pembanding periode sebelumnya',
                    utama: true,
                }];
                if (adaKel && b.length) {
                    isi.push({ t: 'Tertinggi, ' + p, v: b[0].n, k: fmt.format(b[0].v) });
                    if (b.length > 1) isi.push({ t: 'Terendah, ' + p, v: b[b.length - 1].n, k: fmt.format(b[b.length - 1].v) });
                }
                isi.push({ t: 'Periode dalam tampilan', v: String(ix().length), k: D.periode[S.dari] + ' sampai ' + D.periode[S.sampai] });
                el('kartu').innerHTML = isi.map(c =>
                    '<div class="rounded-xl border p-4 ' + (c.utama ? 'border-brand-900 bg-brand-900 text-white' : 'border-line bg-white') + '">' +
                    '<div class="text-sm ' + (c.utama ? 'text-brand-100' : 'text-slate-500') + '">' + esc(c.t) + '</div>' +
                    '<div class="mt-1 truncate text-xl font-bold tabular-nums">' + esc(c.v) + '</div>' +
                    '<div class="mt-0.5 text-sm ' + (c.utama ? 'text-brand-100' : 'text-slate-600') + '">' + esc(c.k) + '</div></div>'
                ).join('');
            }

            function gambarPeriode() {
                const idx = ix(), seri = seriAktif();
                const garis = S.jenis === 'line';
                const tumpuk = S.tumpuk && !garis && D.agg === 'sum';
                bangun('c-periode', {
                    type: S.jenis,
                    data: {
                        labels: idx.map(i => D.periode[i]),
                        datasets: seri.map(s => ({
                            label: s.nama,
                            data: idx.map(i => s.nilai[i]),
                            backgroundColor: adaKel ? warna(s.nama) : P[0],
                            borderColor: adaKel ? warna(s.nama) : P[0],
                            borderRadius: garis ? 0 : 4,
                            borderWidth: garis ? 2 : 0,
                            tension: 0.3,
                            pointRadius: 3,
                        })),
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: seri.length > 1, labels: { usePointStyle: true } },
                            tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmt.format(c.parsed.y) } },
                        },
                        scales: { x: { stacked: tumpuk, grid: { display: false } }, y: sumbuY(tumpuk, false) },
                    },
                });

                if (!seri.length) { el('d-periode').textContent = 'Pilih minimal satu kelompok untuk menampilkan grafik.'; return; }
                let maks = null;
                seri.forEach(s => idx.forEach(i => {
                    const v = s.nilai[i];
                    if (ada(v) && (maks === null || v > maks.v)) maks = { v, p: D.periode[i], n: s.nama };
                }));
                let teks = D.aggLabel + ' ' + D.nilai + ' per periode, dari ' + D.periode[S.dari] + ' sampai ' + D.periode[S.sampai] + '.';
                if (maks) teks += ' Nilai tertinggi ' + fmt.format(maks.v) + ' pada ' + maks.p + (adaKel ? ' (' + maks.n + ')' : '') + '.';
                if (seri.length <= 6) teks += ' Arah tren selama seluruh periode: ' + seri.map(s => s.nama + ' ' + (arahLabel[s.arah] || s.arah)).join(', ') + '.';
                el('d-periode').textContent = teks;
            }

            function gambarBanding() {
                const b = barisSorot(), p = D.periode[S.sorot];
                el('w-banding').style.height = Math.max(220, b.length * 36 + 70) + 'px';
                bangun('c-banding', {
                    type: 'bar',
                    data: {
                        labels: b.map(x => x.n),
                        datasets: [{ data: b.map(x => x.v), backgroundColor: b.map(x => warna(x.n)), borderRadius: 4 }],
                    },
                    options: {
                        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt.format(c.parsed.x) } } },
                        scales: { x: { grid: { color: '#E8EEEC' }, ticks: { callback: v => fmt.format(v) } }, y: { grid: { display: false } } },
                    },
                });
                if (!b.length) el('d-banding').textContent = 'Tidak ada data untuk kelompok yang dipilih pada ' + p + '.';
                else if (b.length === 1) el('d-banding').textContent = 'Pada ' + p + ', hanya ' + b[0].n + ' yang ditampilkan (' + fmt.format(b[0].v) + ').';
                else el('d-banding').textContent = 'Pada ' + p + ', ' + b[0].n + ' paling tinggi (' + fmt.format(b[0].v) + ') dan ' + b[b.length - 1].n + ' paling rendah (' + fmt.format(b[b.length - 1].v) + ').';
            }

            function gambarKomposisi() {
                const boleh = D.agg === 'sum';
                el('komposisi-isi').classList.toggle('hidden', !boleh);
                el('komposisi-info').classList.toggle('hidden', boleh);
                el('d-komposisi').classList.toggle('hidden', !boleh);
                if (!boleh) return;
                const b = barisSorot(), p = D.periode[S.sorot];
                const tot = b.reduce((a, x) => a + x.v, 0);
                bangun('c-komposisi', {
                    type: 'doughnut',
                    data: {
                        labels: b.map(x => x.n),
                        datasets: [{ data: b.map(x => x.v), backgroundColor: b.map(x => warna(x.n)), borderWidth: 2, borderColor: '#fff' }],
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, cutout: '62%',
                        plugins: {
                            legend: { position: 'bottom', labels: { usePointStyle: true } },
                            tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + fmt.format(c.parsed) + (tot > 0 ? ' (' + fmt.format(c.parsed / tot * 100) + '%)' : '') } },
                        },
                    },
                });
                if (b.length && tot > 0) {
                    el('d-komposisi').textContent = 'Pada ' + p + ', ' + b[0].n + ' menyumbang ' + fmt.format(b[0].v / tot * 100) + '% dari total kelompok yang dipilih.';
                } else {
                    el('d-komposisi').textContent = 'Tidak ada data untuk kelompok yang dipilih pada ' + p + '.';
                }
            }

            function gambarTumbuh() {
                const idx = ix().filter(i => i > 0), seri = seriAktif();
                const tunggal = seri.length === 1;
                bangun('c-tumbuh', {
                    type: 'bar',
                    data: {
                        labels: idx.map(i => D.periode[i]),
                        datasets: seri.map(s => ({
                            label: s.nama,
                            data: idx.map(i => s.tumbuh[i]),
                            backgroundColor: tunggal
                                ? idx.map(i => (s.tumbuh[i] ?? 0) >= 0 ? '#1E6B5C' : '#B5543A')
                                : (adaKel ? warna(s.nama) : P[0]),
                            borderRadius: 4,
                        })),
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { display: seri.length > 1, labels: { usePointStyle: true } },
                            tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + pct(c.parsed.y) } },
                        },
                        scales: { x: { grid: { display: false } }, y: sumbuY(false, true) },
                    },
                });
                let tinggi = null, rendah = null;
                seri.forEach(s => idx.forEach(i => {
                    const v = s.tumbuh[i];
                    if (!ada(v)) return;
                    if (tinggi === null || v > tinggi.v) tinggi = { v, p: D.periode[i], n: s.nama };
                    if (rendah === null || v < rendah.v) rendah = { v, p: D.periode[i], n: s.nama };
                }));
                el('d-tumbuh').textContent = tinggi
                    ? 'Pertumbuhan tertinggi ' + pct(tinggi.v) + ' pada ' + tinggi.p + (adaKel ? ' (' + tinggi.n + ')' : '') +
                      ', terendah ' + pct(rendah.v) + ' pada ' + rendah.p + (adaKel ? ' (' + rendah.n + ')' : '') +
                      '. Periode pertama tidak punya pembanding.'
                    : 'Belum ada data pertumbuhan pada rentang ini.';
            }

            function gambarSebaran() {
                const b = D.bins;
                if (!b.length) { el('k-sebaran').classList.add('hidden'); return; }
                bangun('c-sebaran', {
                    type: 'bar',
                    data: {
                        labels: b.map(x => fmt.format(x.dari) + ' sampai ' + fmt.format(x.sampai)),
                        datasets: [{ data: b.map(x => x.jumlah), backgroundColor: P[0], borderRadius: 3, categoryPercentage: 1, barPercentage: 0.92 }],
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.parsed.y + ' baris' } } },
                        scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#E8EEEC' } }, x: { grid: { display: false } } },
                    },
                });
                const p = b.reduce((m, x) => x.jumlah > m.jumlah ? x : m, b[0]);
                el('d-sebaran').textContent = 'Paling banyak data ada di rentang ' + fmt.format(p.dari) + ' sampai ' + fmt.format(p.sampai) +
                    ' (' + p.jumlah + ' baris). Sebaran dihitung dari seluruh data, jadi tidak terpengaruh filter periode dan kelompok.';
            }

            function tabel() {
                const idx = ix(), seri = seriAktif();
                const kepala = ['Periode'].concat(seri.map(s => s.nama), adaKel ? ['Keseluruhan'] : []);
                const baris = idx.map(i => [D.periode[i]].concat(seri.map(s => s.nilai[i]), adaKel ? [D.total.nilai[i]] : []));
                el('tabel').innerHTML =
                    '<thead class="sticky top-0 bg-slate-50 text-left text-slate-600"><tr>' +
                    kepala.map((h, k) => '<th class="whitespace-nowrap border-b border-line px-4 py-2.5 font-semibold' + (k ? ' text-right' : '') + '">' + esc(h) + '</th>').join('') +
                    '</tr></thead><tbody class="divide-y divide-line tabular-nums">' +
                    baris.map(r => '<tr class="hover:bg-brand-50/60">' + r.map((c, k) =>
                        '<td class="whitespace-nowrap px-4 py-2' + (k ? ' text-right' : ' font-medium') + '">' +
                        (k ? (ada(c) ? fmt.format(c) : '-') : esc(c)) + '</td>').join('') + '</tr>').join('') +
                    '</tbody>';
            }

            function segarkan() {
                try {
                    const nonaktif = S.jenis === 'line' || D.agg !== 'sum';
                    el('f-tumpuk').disabled = nonaktif;
                    if (nonaktif) { S.tumpuk = false; el('f-tumpuk').checked = false; }
                    if (adaKel) el('jumlah-pilih').textContent = S.pilih.size + ' dari ' + D.seri.length + ' dipilih';
                    kartu();
                    gambarPeriode();
                    if (adaKel) { gambarBanding(); gambarKomposisi(); }
                    gambarTumbuh();
                    tabel();
                } catch (e) { tampilGalat(e); }
            }

            function isiPilihan() {
                ['f-dari', 'f-sampai', 'f-sorot'].forEach(id => {
                    el(id).innerHTML = D.periode.map((p, i) => '<option value="' + i + '">' + esc(p) + '</option>').join('');
                });
                el('f-dari').value = S.dari; el('f-sampai').value = S.sampai; el('f-sorot').value = S.sorot;
            }

            function sinkronChip() {
                el('chips').querySelectorAll('input').forEach(c => { c.checked = S.pilih.has(c.dataset.grup); });
            }

            function bangunChip() {
                if (!adaKel) {
                    el('baris-kelompok').classList.add('hidden');
                    el('k-banding').classList.add('hidden');
                    el('k-komposisi').classList.add('hidden');
                    return;
                }
                el('chips').innerHTML = D.seri.map(s =>
                    '<label class="cursor-pointer" data-cari="' + esc(s.nama.toLowerCase()) + '">' +
                    '<input type="checkbox" class="peer sr-only" data-grup="' + esc(s.nama) + '">' +
                    '<span class="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm text-slate-500 transition peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600">' +
                    '<span class="h-2.5 w-2.5 rounded-full" style="background:' + warna(s.nama) + '"></span>' + esc(s.nama) + '</span></label>'
                ).join('');
                sinkronChip();
                el('chips').querySelectorAll('input').forEach(c => c.addEventListener('change', () => {
                    if (c.checked) S.pilih.add(c.dataset.grup); else S.pilih.delete(c.dataset.grup);
                    segarkan();
                }));
            }

            el('f-dari').addEventListener('change', e => {
                S.dari = +e.target.value;
                if (S.sampai < S.dari) { S.sampai = S.dari; el('f-sampai').value = S.sampai; }
                segarkan();
            });
            el('f-sampai').addEventListener('change', e => {
                S.sampai = +e.target.value;
                if (S.dari > S.sampai) { S.dari = S.sampai; el('f-dari').value = S.dari; }
                segarkan();
            });
            el('f-sorot').addEventListener('change', e => { S.sorot = +e.target.value; segarkan(); });
            document.querySelectorAll('input[name=jenis]').forEach(r => r.addEventListener('change', () => {
                S.jenis = document.querySelector('input[name=jenis]:checked').value;
                segarkan();
            }));
            el('f-tumpuk').addEventListener('change', e => { S.tumpuk = e.target.checked; segarkan(); });
            el('teratas').addEventListener('click', () => { S.pilih = new Set(teratas(6)); sinkronChip(); segarkan(); });
            el('semua').addEventListener('click', () => { D.seri.forEach(s => S.pilih.add(s.nama)); sinkronChip(); segarkan(); });
            el('kosong').addEventListener('click', () => { S.pilih.clear(); sinkronChip(); segarkan(); });
            el('cari').addEventListener('input', e => {
                const q = e.target.value.trim().toLowerCase();
                el('chips').querySelectorAll('label').forEach(l => l.classList.toggle('hidden', q !== '' && !l.dataset.cari.includes(q)));
            });
            el('reset').addEventListener('click', () => {
                S.dari = 0; S.sampai = n - 1; S.sorot = n - 1; S.jenis = 'bar'; S.tumpuk = false;
                S.pilih = new Set(teratas(6));
                document.querySelector('input[name=jenis][value=bar]').checked = true;
                el('f-tumpuk').checked = false;
                el('cari').value = '';
                el('chips').querySelectorAll('label').forEach(l => l.classList.remove('hidden'));
                isiPilihan(); sinkronChip(); segarkan();
            });
            document.querySelectorAll('[data-unduh]').forEach(b => b.addEventListener('click', () => {
                const ch = grafik[b.dataset.unduh];
                if (!ch) return;
                const a = document.createElement('a');
                a.href = ch.toBase64Image();
                a.download = b.dataset.unduh + '.png';
                a.click();
            }));

            try {
                isiPilihan();
                bangunChip();
                gambarSebaran();
            } catch (e) { tampilGalat(e); }
            segarkan();
        })();
        </script>
        @endverbatim
    @endif
@endsection
