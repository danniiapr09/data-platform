<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Platform Data')</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        /*
         * Catatan Identitas Visual:
         * Palet warna dan emblem bersifat sementara sampai panduan logo dan warna resmi Pusdatin diterima.
         * Semua shade brand-50 s.d. brand-900, paper, ink, dan line tetap dipertahankan agar kompatibel
         * dengan seluruh halaman yang ada.
         */
        tailwind.config = {
            theme: { extend: {
                fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'] },
                colors: {
                    brand: {
                        50:  '#F0F7F4',
                        100: '#DBEFE7',
                        200: '#B8DFD1',
                        300: '#89C7B4',
                        400: '#5BAE96',
                        500: '#34937B',
                        600: '#1E6B5C', // Brand utama
                        700: '#165548',
                        800: '#104037',
                        900: '#0B2C26',
                    },
                    paper: '#F8FAF9', // Kanvas lembut
                    ink:   '#111827', // Teks utama kontras tinggi (WCAG AAA)
                    line:  '#E2E8F0', // Border lembut
                },
                boxShadow: {
                    'card':      '0 1px 3px 0 rgba(11,44,38,0.05), 0 1px 2px -1px rgba(11,44,38,0.05)',
                    'card-hover':'0 4px 12px 0 rgba(11,44,38,0.10), 0 2px 4px -2px rgba(11,44,38,0.06)',
                },
            } },
        };
    </script>
    <style>
        *:focus-visible { outline: 2px solid #1E6B5C; outline-offset: 2px; border-radius: 6px; }
        dialog[open] {
            animation: dialog-masuk 180ms ease-out forwards;
        }
        @keyframes dialog-masuk {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
            dialog[open], .transisi-halus {
                animation: none !important;
                transition: none !important;
            }
        }
    </style>
</head>
<body class="bg-paper text-ink font-sans antialiased selection:bg-brand-100 selection:text-brand-900">
@php
    $nav = [
        [
            'rute'  => 'beranda',
            'nama'  => 'Beranda',
            'aktif' => request()->routeIs('beranda'),
            'ikon'  => '<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
        ],
        [
            'rute'  => 'datasets.index',
            'nama'  => 'Dataset',
            'aktif' => request()->is('datasets*'),
            'ikon'  => '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h10"/>',
        ],
    ];
@endphp
<div class="lg:flex min-h-screen">

    {{-- Sidebar Desktop (Layar Lebar) --}}
    <aside class="hidden lg:flex flex-col w-64 shrink-0 bg-brand-900 text-brand-100 p-5 sticky top-0 h-screen">
        {{-- Emblem Netral Sementara --}}
        <div class="flex items-center gap-3 mb-8 px-1">
            <span class="grid place-items-center h-9 w-9 rounded-xl bg-brand-700 text-white shadow-sm ring-1 ring-white/15 shrink-0">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                </svg>
            </span>
            <div class="min-w-0">
                <div class="font-bold text-white leading-tight truncate text-sm">Platform Data</div>
                <div class="text-xs text-brand-300 truncate">Pusdatin</div>
            </div>
        </div>

        {{-- Navigasi Menu Utama --}}
        <nav aria-label="Menu navigasi utama" class="flex-1 space-y-1 text-sm">
            @foreach ($nav as $n)
                <a href="{{ route($n['rute']) }}"
                   @if ($n['aktif']) aria-current="page" @endif
                   class="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors duration-150 {{ $n['aktif'] ? 'bg-white/10 text-white ring-1 ring-white/20 font-semibold' : 'text-brand-200 hover:bg-white/8 hover:text-white' }}">
                    <svg class="h-5 w-5 shrink-0 {{ $n['aktif'] ? 'text-brand-300' : 'text-brand-400' }}"
                         fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        {!! $n['ikon'] !!}
                    </svg>
                    <span>{{ $n['nama'] }}</span>
                </a>
            @endforeach
        </nav>

        {{-- Footer Sidebar --}}
        <div class="pt-5 border-t border-white/10 text-xs text-brand-400 px-1">
            Platform Pengolahan Data
        </div>
    </aside>

    {{-- Header & Drawer Mobile (Layar Kecil) --}}
    <header class="lg:hidden bg-brand-900 text-white sticky top-0 z-40 shadow-sm">
        <div class="flex items-center justify-between px-5 py-3.5">
            <div class="flex items-center gap-2.5">
                <span class="grid place-items-center h-8 w-8 rounded-lg bg-brand-700 text-white ring-1 ring-white/15 shrink-0">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                    </svg>
                </span>
                <span class="font-bold text-sm leading-tight">Platform Data Pusdatin</span>
            </div>
            <button type="button" id="menu-tombol" aria-expanded="false" aria-controls="menu-mobile" aria-label="Buka menu navigasi"
                    class="rounded-xl p-2.5 text-brand-200 hover:bg-white/10 hover:text-white min-h-[40px] min-w-[40px] flex items-center justify-center focus-visible:outline-white">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16"/>
                </svg>
            </button>
        </div>

        {{-- Mobile Nav Drawer --}}
        <nav id="menu-mobile" class="hidden border-t border-white/10 bg-brand-900 px-4 py-3 space-y-1 text-sm" aria-label="Navigasi seluler">
            @foreach ($nav as $n)
                <a href="{{ route($n['rute']) }}"
                   @if ($n['aktif']) aria-current="page" @endif
                   class="flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[40px] font-medium {{ $n['aktif'] ? 'bg-white/10 text-white font-semibold ring-1 ring-white/20' : 'text-brand-200 hover:bg-white/8 hover:text-white' }}">
                    <svg class="h-5 w-5 shrink-0 {{ $n['aktif'] ? 'text-brand-300' : 'text-brand-400' }}"
                         fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        {!! $n['ikon'] !!}
                    </svg>
                    <span>{{ $n['nama'] }}</span>
                </a>
            @endforeach
        </nav>
    </header>

    <script>
        (function() {
            const tombolMenu = document.getElementById('menu-tombol');
            const menuMobile = document.getElementById('menu-mobile');
            if (!tombolMenu || !menuMobile) return;

            function toggleMenu(buka) {
                const isBuka = typeof buka === 'boolean' ? buka : menuMobile.classList.contains('hidden');
                menuMobile.classList.toggle('hidden', !isBuka);
                tombolMenu.setAttribute('aria-expanded', isBuka ? 'true' : 'false');
                if (isBuka) {
                    const firstLink = menuMobile.querySelector('a');
                    if (firstLink) firstLink.focus();
                } else {
                    tombolMenu.focus();
                }
            }

            tombolMenu.addEventListener('click', () => toggleMenu());

            // Aksesibilitas keyboard: Tutup menu mobile dengan tombol Esc
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !menuMobile.classList.contains('hidden')) {
                    toggleMenu(false);
                }
            });
        })();
    </script>

    {{-- Area Konten Utama --}}
    <main class="flex-1 min-w-0 overflow-x-hidden">
        <div class="max-w-5xl mx-auto px-5 py-8 lg:px-10 lg:py-10">

            {{-- Pesan Notifikasi Terpusat --}}
            @if (session('sukses'))
                <x-notifikasi tipe="sukses" :pesan="session('sukses')" class="mb-6" />
            @endif
            @if (session('gagal'))
                <x-notifikasi tipe="gagal" :pesan="session('gagal')" class="mb-6" />
            @endif
            @if (session('peringatan'))
                <x-notifikasi tipe="peringatan" :pesan="session('peringatan')" class="mb-6" />
            @endif
            @if (session('info'))
                <x-notifikasi tipe="info" :pesan="session('info')" class="mb-6" />
            @endif

            @yield('content')
        </div>
    </main>
</div>
</body>
</html>
