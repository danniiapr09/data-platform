@props([
    'status' => 'uploaded',
    'label' => null,
    'ukuran' => 'md', // 'sm', 'md'
])

@php
    $teks = $label ?? match($status) {
        'uploaded' => 'Diunggah',
        'cleaned' => 'Dibersihkan',
        'forecasted' => 'Diprediksi',
        'pending' => 'Menunggu review',
        'diterima' => 'Diterima',
        'ditolak' => 'Ditolak',
        'diperbaiki' => 'Diperbaiki',
        default => ucfirst($status),
    };

    $gaya = match($status) {
        'uploaded' => 'bg-slate-100 text-slate-800 border-slate-200',
        'cleaned' => 'bg-brand-50 text-brand-800 border-brand-200',
        'forecasted' => 'bg-emerald-50 text-emerald-800 border-emerald-200',
        'pending' => 'bg-amber-50 text-amber-900 border-amber-200',
        'diterima' => 'bg-emerald-50 text-emerald-800 border-emerald-200',
        'ditolak' => 'bg-red-50 text-red-900 border-red-200',
        'diperbaiki' => 'bg-blue-50 text-blue-900 border-blue-200',
        default => 'bg-slate-50 text-slate-700 border-slate-200',
    };

    $dot = match($status) {
        'uploaded' => 'bg-slate-500',
        'cleaned' => 'bg-brand-600',
        'forecasted' => 'bg-emerald-600',
        'pending' => 'bg-amber-500',
        'diterima' => 'bg-emerald-600',
        'ditolak' => 'bg-red-600',
        'diperbaiki' => 'bg-blue-600',
        default => 'bg-slate-400',
    };

    $pad = $ukuran === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
@endphp

<span {{ $attributes->merge(['class' => "inline-flex items-center gap-1.5 rounded-full border shadow-2xs font-medium $pad $gaya"]) }}>
    <span class="h-1.5 w-1.5 rounded-full {{ $dot }}" aria-hidden="true"></span>
    <span>{{ $teks }}</span>
</span>
