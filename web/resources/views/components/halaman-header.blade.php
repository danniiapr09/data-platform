@props([
    'judul',
    'deskripsi' => null,
    'gradien'   => false,   // true = panel hero bergradien brand, merentang penuh lebar konten
])
{{--
    Props:
      judul    : string – judul halaman (wajib)
      deskripsi: string – sub-judul / keterangan (opsional)
      gradien  : bool   – tampilkan sebagai hero bergradien (Beranda); halaman lain biarkan false
    Slot default: aksi (tombol) ditampilkan di sisi kanan / bawah judul
--}}
@if ($gradien)
    {{--
        Margin negatif disesuaikan persis dengan padding wrapper layout:
        px-5 py-8 lg:px-10 lg:py-10  → -mx-5 -mt-8 mb-8 lg:-mx-10 lg:-mt-10
        Lebar overflow dikendalikan oleh overflow-x-hidden pada <main>.
    --}}
    <div class="-mx-5 -mt-8 mb-8 lg:-mx-10 lg:-mt-10 bg-gradient-to-br from-brand-600 to-brand-800 px-5 pt-8 pb-7 lg:px-10 lg:pt-10 lg:pb-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-white lg:text-3xl">{{ $judul }}</h1>
                @if ($deskripsi)
                    <p class="mt-1 text-sm text-brand-100">{{ $deskripsi }}</p>
                @endif
            </div>
            @if ($slot->isNotEmpty())
                <div class="flex items-center gap-2 shrink-0">
                    {{ $slot }}
                </div>
            @endif
        </div>
    </div>
@else
    <div {{ $attributes->merge(['class' => 'mb-8 flex flex-wrap items-start justify-between gap-4']) }}>
        <div>
            <h1 class="text-2xl font-bold text-ink">{{ $judul }}</h1>
            @if ($deskripsi)
                <p class="mt-1 text-sm text-slate-600">{{ $deskripsi }}</p>
            @endif
        </div>
        @if ($slot->isNotEmpty())
            <div class="flex items-center gap-2 shrink-0">
                {{ $slot }}
            </div>
        @endif
    </div>
@endif
