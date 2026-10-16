@props([
    'judul',
    'deskripsi' => null,
    'ikon' => null,
])
{{--
    Komponen keadaan kosong / empty-state.
    Props:
      judul      : string – kalimat singkat (wajib)
      deskripsi  : string – penjelasan tambahan (opsional)
      ikon       : HTML SVG (opsional) – ikon dekoratif
    Slot default : aksi (tombol CTA) (opsional)
--}}
<div {{ $attributes->merge(['class' => 'flex flex-col items-center justify-center rounded-xl border border-line bg-white py-12 px-6 text-center']) }}>
    @if($ikon)
        <div class="mb-4 text-brand-400" aria-hidden="true">
            {{ $ikon }}
        </div>
    @else
        {{-- Ikon default: dokumen kosong --}}
        <div class="mb-4 text-slate-300" aria-hidden="true">
            <svg class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
            </svg>
        </div>
    @endif
    <p class="text-base font-semibold text-ink">{{ $judul }}</p>
    @if($deskripsi)
        <p class="mt-1 max-w-xs text-sm text-slate-600">{{ $deskripsi }}</p>
    @endif
    @if($slot->isNotEmpty())
        <div class="mt-4">{{ $slot }}</div>
    @endif
</div>
