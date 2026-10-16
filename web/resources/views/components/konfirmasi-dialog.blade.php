@props([
    'id',
    'judul',
    'varian' => 'amber', // 'amber' atau 'merah'
    'teksKonfirmasi' => 'Ya, lanjutkan',
    'teksBatal' => 'Batal',
    'action',
    'deskripsi' => null,
])

@php
    $warnaIkon = $varian === 'merah' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200';
    $warnaTombol = $varian === 'merah' 
        ? 'bg-red-600 hover:bg-red-700 text-white focus-visible:outline-red-600' 
        : 'bg-amber-600 hover:bg-amber-700 text-white focus-visible:outline-amber-600';
@endphp

<dialog id="{{ $id }}"
        aria-labelledby="{{ $id }}-judul"
        aria-describedby="{{ $id }}-deskripsi"
        class="fixed inset-0 m-auto w-full max-w-lg rounded-2xl border border-line bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm open:flex open:flex-col transition-all duration-200 max-sm:m-0 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-b-none">
    
    <div class="p-6">
        <div class="flex items-start gap-4">
            <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl border {{ $warnaIkon }}">
                @if ($varian === 'merah')
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                @else
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                @endif
            </span>
            <div class="flex-1">
                <h3 id="{{ $id }}-judul" class="text-lg font-bold text-ink">{{ $judul }}</h3>
                @if ($deskripsi)
                    <p id="{{ $id }}-deskripsi" class="mt-1 text-sm text-slate-600">{{ $deskripsi }}</p>
                @endif
            </div>
        </div>

        <div class="mt-4 text-sm text-slate-700">
            {{ $slot }}
        </div>
    </div>

    <form method="POST" action="{{ $action }}" class="border-t border-line bg-slate-50 px-6 py-4 flex flex-wrap-reverse items-center justify-end gap-3"
          onsubmit="const b = this.querySelector('button[type=submit]'); if (b) { b.disabled = true; b.textContent = 'Memproses…'; }">
        @csrf
        {{ $hiddenFields ?? '' }}

        <button type="button"
                data-batal
                class="min-h-[40px] rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-ink focus-visible:outline-brand-600">
            {{ $teksBatal }}
        </button>

        <button type="submit"
                class="min-h-[40px] rounded-lg px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 {{ $warnaTombol }}">
            {{ $teksKonfirmasi }}
        </button>
    </form>
</dialog>

<script>
    (function() {
        const dialog = document.getElementById(@json($id));
        if (!dialog) return;

        let pemicu = null;

        // Buka dialog dan simpan elemen pemicu untuk dikembalikan fokusnya saat tutup
        window['bukaDialog_' + @json($id)] = function(el) {
            pemicu = el || document.activeElement;
            if (typeof dialog.showModal === 'function') {
                dialog.showModal();
                const tombolBatal = dialog.querySelector('[data-batal]');
                if (tombolBatal) tombolBatal.focus();
            } else {
                // Fallback jika browser sangat lama
                dialog.setAttribute('open', '');
            }
        };

        window['tutupDialog_' + @json($id)] = function() {
            if (typeof dialog.close === 'function') {
                dialog.close();
            } else {
                dialog.removeAttribute('open');
            }
            if (pemicu && typeof pemicu.focus === 'function') {
                pemicu.focus();
            }
        };

        const btnBatal = dialog.querySelector('[data-batal]');
        if (btnBatal) {
            btnBatal.addEventListener('click', () => window['tutupDialog_' + @json($id)]());
        }

        // Tutup saat klik backdrop
        dialog.addEventListener('click', (e) => {
            const rect = dialog.getBoundingClientRect();
            const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
                && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
            if (!isInDialog) {
                window['tutupDialog_' + @json($id)]();
            }
        });

        dialog.addEventListener('close', () => {
            if (pemicu && typeof pemicu.focus === 'function') {
                pemicu.focus();
            }
        });
    })();
</script>
