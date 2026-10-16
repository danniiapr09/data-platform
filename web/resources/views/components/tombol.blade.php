@props([
    'varian'   => 'utama',   // 'utama', 'sekunder', 'bahaya', 'ghost', 'terang'
    'href'     => null,
    'tipe'     => 'button',
    'ukuran'   => 'md',      // 'sm', 'md', 'lg'
    'disabled' => false,
])

@php
    $kelasUkuran = match($ukuran) {
        'sm'    => 'px-3.5 py-1.5 text-xs min-h-[36px]',
        'lg'    => 'px-6 py-3 text-base min-h-[44px]',
        default => 'px-5 py-2.5 text-sm min-h-[40px]',
    };

    // Semua kelas varian ditulis statis — tidak ada interpolasi string.
    $kelasVarian = match($varian) {
        'sekunder' => 'border border-line bg-white text-ink hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-brand-600',
        'bahaya'   => 'bg-red-600 text-white hover:bg-red-700 shadow-sm focus-visible:outline-red-600',
        'ghost'    => 'text-brand-700 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-brand-600',
        // Varian terang: latar putih, teks brand gelap — untuk dipakai di atas hero berwarna gelap
        'terang'   => 'bg-white text-brand-700 hover:bg-brand-50 shadow-sm focus-visible:outline-white ring-1 ring-white/40',
        default    => 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm focus-visible:outline-brand-600',
    };

    $base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed $kelasUkuran $kelasVarian";
@endphp

@if ($href)
    <a href="{{ $href }}" {{ $attributes->merge(['class' => $base]) }}>
        {{ $slot }}
    </a>
@else
    <button type="{{ $tipe }}" {{ $disabled ? 'disabled' : '' }} {{ $attributes->merge(['class' => $base]) }}>
        {{ $slot }}
    </button>
@endif
