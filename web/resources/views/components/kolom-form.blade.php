@props([
    'label',
    'for' => null,
    'wajib' => false,
    'bantuan' => null,
    'error' => null,
])

<div {{ $attributes->merge(['class' => 'space-y-1.5']) }}>
    @if ($label)
        <label @if($for) for="{{ $for }}" @endif class="block text-sm font-semibold text-ink">
            {{ $label }}
            @if ($wajib)
                <span class="text-red-600 font-bold" aria-hidden="true">*</span>
                <span class="sr-only">(wajib diisi)</span>
            @else
                <span class="text-xs font-normal text-slate-500">(opsional)</span>
            @endif
        </label>
    @endif

    {{ $slot }}

    @if ($bantuan)
        <p class="text-xs text-slate-500">{{ $bantuan }}</p>
    @endif

    @if ($error)
        <p class="text-xs font-medium text-red-600" role="alert">{{ $error }}</p>
    @endif
</div>
