@props([
    'nilai',                    // integer / string angka yang ditampilkan besar
    'label',                    // teks label di bawah angka
    'varian' => 'brand',        // 'brand' | 'hijau' | 'abu'
    'ikonPath' => null,         // path SVG (stroke-linecap round)
])
{{--
    Kartu metrik: angka besar + ikon dalam lingkaran + label kecil.
    Varian menentukan warna ikon dan lingkaran. Semua kelas ditulis statis.

    varian='brand'  → lingkaran brand-100, ikon brand-600
    varian='hijau'  → lingkaran emerald-100, ikon emerald-600
    varian='abu'    → lingkaran slate-100, ikon slate-500
--}}
@php
    // Peta kelas statis — TIDAK ada interpolasi string
    $kelasLingkaran = match($varian) {
        'hijau' => 'bg-emerald-100',
        'abu'   => 'bg-slate-100',
        default => 'bg-brand-100',
    };
    $kelasIkon = match($varian) {
        'hijau' => 'text-emerald-600',
        'abu'   => 'text-slate-500',
        default => 'text-brand-600',
    };
@endphp

<div {{ $attributes->merge(['class' => 'flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-card']) }}>
    @if ($ikonPath)
        <div class="shrink-0 grid place-items-center h-12 w-12 rounded-xl {{ $kelasLingkaran }}" aria-hidden="true">
            <svg class="h-6 w-6 {{ $kelasIkon }}" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="{{ $ikonPath }}"/>
            </svg>
        </div>
    @endif
    <div class="min-w-0">
        <div class="text-3xl font-bold text-ink tabular-nums leading-none">{{ $nilai }}</div>
        <div class="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{{ $label }}</div>
    </div>
</div>
