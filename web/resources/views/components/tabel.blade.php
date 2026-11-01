@props([
    'judul' => null,
    'keterangan' => null,
])

<div {{ $attributes->merge(['class' => 'rounded-2xl border border-line bg-white shadow-card overflow-hidden']) }}>
    @if ($judul || isset($aksi))
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
                @if ($judul)
                    <h2 class="text-base font-bold text-ink">{{ $judul }}</h2>
                @endif
                @if ($keterangan)
                    <p class="mt-0.5 text-xs text-slate-500">{{ $keterangan }}</p>
                @endif
            </div>
            @isset($aksi)
                <div class="flex items-center gap-2">
                    {{ $aksi }}
                </div>
            @endisset
        </div>
    @endif

    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            {{ $slot }}
        </table>
    </div>
</div>
