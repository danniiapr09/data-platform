@props([
    'judul' => null,
    'subjudul' => null,
    'padding' => 'normal', // 'normal', 'padat', 'tanpa-padding'
])

@php
    $kelasPad = match($padding) {
        'padat' => 'p-4',
        'tanpa-padding' => 'p-0',
        default => 'p-5 sm:p-6',
    };
@endphp

<div {{ $attributes->merge(['class' => 'rounded-2xl border border-line bg-white shadow-card transition duration-150']) }}>
    @if ($judul || isset($aksi))
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <div>
                @if ($judul)
                    <h2 class="text-base font-bold text-ink">{{ $judul }}</h2>
                @endif
                @if ($subjudul)
                    <p class="mt-0.5 text-xs text-slate-500">{{ $subjudul }}</p>
                @endif
            </div>
            @isset($aksi)
                <div class="flex items-center gap-2">
                    {{ $aksi }}
                </div>
            @endisset
        </div>
    @endif

    <div class="{{ $kelasPad }}">
        {{ $slot }}
    </div>
</div>
