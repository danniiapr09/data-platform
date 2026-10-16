@props([
    'status', // integer 1=uploaded,2=cleaned,3=forecasted
])
@php
    $label = [1 => 'Diunggah', 2 => 'Dibersihkan', 3 => 'Sudah diprediksi'];
@endphp
<div class="flex items-center gap-3" aria-label="Status {{ $label[$status] ?? 'Tidak diketahui' }}">
    @for ($i = 1; $i <= 3; $i++)
        <span class="h-1.5 w-6 rounded-full {{ $i <= $status ? 'bg-brand-600' : 'bg-line' }}" aria-hidden="true"></span>
    @endfor
    <span class="text-sm font-medium text-brand-700">{{ $label[$status] ?? '' }}</span>
</div>
