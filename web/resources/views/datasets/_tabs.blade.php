@php
    $tab = [
        ['kunci' => 'data', 'nama' => 'Data', 'url' => route('datasets.show', $id), 'ikon' => '<path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>'],
        ['kunci' => 'dashboard', 'nama' => 'Dashboard', 'url' => route('dashboard.index', $id), 'ikon' => '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'],
        ['kunci' => 'anomali', 'nama' => 'Review anomali', 'url' => route('anomali.index', $id), 'ikon' => '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>'],
        ['kunci' => 'edit', 'nama' => 'Edit data', 'url' => route('edit.index', $id), 'ikon' => '<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>'],
        ['kunci' => 'statistik', 'nama' => 'Ringkasan statistik', 'url' => route('statistik.index', $id), 'ikon' => '<path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'],
        ['kunci' => 'analisis', 'nama' => 'Analisis dan prediksi', 'url' => route('analisis.index', $id), 'ikon' => '<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>'],
        ['kunci' => 'riwayat', 'nama' => 'Riwayat dan unduhan', 'url' => route('riwayat.index', $id), 'ikon' => '<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>'],
    ];
@endphp
<div class="mb-6 border-b border-line">
    <nav class="-mb-px flex gap-2 overflow-x-auto pb-1 text-sm scrollbar-none" aria-label="Bagian dataset">
        @foreach ($tab as $t)
            @php $isAktif = $aktif === $t['kunci']; @endphp
            <a href="{{ $t['url'] }}" @if ($isAktif) aria-current="page" @endif
               class="group inline-flex items-center gap-2 whitespace-nowrap rounded-t-xl border-b-2 px-3.5 py-3 font-medium transition-all duration-150 {{ $isAktif ? 'border-brand-600 bg-brand-50/50 text-brand-700 font-semibold shadow-2xs' : 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-ink' }}">
                <svg class="h-4 w-4 shrink-0 transition-colors {{ $isAktif ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600' }}"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    {!! $t['ikon'] !!}
                </svg>
                <span>{{ $t['nama'] }}</span>
            </a>
        @endforeach
    </nav>
</div>
