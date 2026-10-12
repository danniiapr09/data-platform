@php
    $tab = [
        ['kunci' => 'data', 'nama' => 'Data', 'url' => route('datasets.show', $id)],
        ['kunci' => 'anomali', 'nama' => 'Review anomali', 'url' => route('anomali.index', $id)],
        ['kunci' => 'statistik', 'nama' => 'Ringkasan statistik', 'url' => route('statistik.index', $id)],
        ['kunci' => 'analisis', 'nama' => 'Analisis dan prediksi', 'url' => route('analisis.index', $id)],
    ];
@endphp
<div class="mb-6 border-b border-line">
    <nav class="-mb-px flex gap-6 overflow-x-auto text-sm" aria-label="Bagian dataset">
        @foreach ($tab as $t)
            <a href="{{ $t['url'] }}" @if ($aktif === $t['kunci']) aria-current="page" @endif
               class="whitespace-nowrap border-b-2 pb-3 font-medium {{ $aktif === $t['kunci'] ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-ink' }}">
                {{ $t['nama'] }}
            </a>
        @endforeach
    </nav>
</div>
