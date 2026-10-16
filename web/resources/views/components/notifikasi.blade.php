@props([
    'tipe' => 'info', // 'sukses', 'gagal', 'peringatan', 'info'
    'pesan' => null,
    'judul' => null,
])

@php
    $kelas = match($tipe) {
        'sukses' => 'border-emerald-200 bg-emerald-50 text-emerald-950',
        'gagal' => 'border-red-200 bg-red-50 text-red-950',
        'peringatan' => 'border-amber-200 bg-amber-50 text-amber-950',
        default => 'border-blue-200 bg-blue-50 text-blue-950',
    };

    $ikonWarna = match($tipe) {
        'sukses' => 'text-emerald-700',
        'gagal' => 'text-red-600',
        'peringatan' => 'text-amber-700',
        default => 'text-blue-700',
    };
@endphp

<div role="{{ in_array($tipe, ['gagal', 'peringatan']) ? 'alert' : 'status' }}"
     {{ $attributes->merge(['class' => "flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed shadow-sm $kelas"]) }}>
    <span class="mt-0.5 shrink-0 {{ $ikonWarna }}">
        @if ($tipe === 'sukses')
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
        @elseif ($tipe === 'gagal')
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
        @elseif ($tipe === 'peringatan')
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
        @else
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
        @endif
    </span>

    <div class="flex-1 min-w-0">
        @if ($judul)
            <div class="font-semibold mb-0.5">{{ $judul }}</div>
        @endif
        <div>{{ $pesan ?? $slot }}</div>
    </div>
</div>
