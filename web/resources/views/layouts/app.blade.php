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
        tailwind.config = {
            theme: { extend: {
                fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
                colors: {
                    brand: { 50: '#EDF5F2', 100: '#D3E8E1', 200: '#A8D0C4', 600: '#1E6B5C',
                             700: '#165548', 800: '#0F3F36', 900: '#0A2B25' },
                    paper: '#F5F7F6', ink: '#16231F', line: '#DBE3E0',
                },
            } },
        };
    </script>
    <style>
        *:focus-visible { outline: 2px solid #1E6B5C; outline-offset: 2px; border-radius: 4px; }
    </style>
</head>
<body class="bg-paper text-ink font-sans antialiased">
@php
    $nav = [
        ['rute' => 'beranda', 'nama' => 'Beranda', 'aktif' => request()->routeIs('beranda'), 'ikon' => 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10'],
        ['rute' => 'datasets.index', 'nama' => 'Dataset', 'aktif' => request()->is('datasets*'), 'ikon' => 'M4 6h16M4 12h16M4 18h10'],
    ];
@endphp
<div class="lg:flex min-h-screen">

    {{-- Sidebar (desktop) --}}
    <aside class="hidden lg:flex flex-col w-64 shrink-0 bg-brand-900 text-brand-100 p-6 sticky top-0 h-screen">
        <div class="flex items-center gap-3 mb-10">
            <span class="grid place-items-center h-10 w-10 rounded-xl bg-brand-600 text-white">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="4" y="12" width="3" height="7" rx="1"/>
                    <rect x="10.5" y="7" width="3" height="12" rx="1"/>
                    <rect x="17" y="3" width="3" height="16" rx="1"/>
                </svg>
            </span>
            <div>
                <div class="font-bold text-white leading-tight">Platform Data</div>
                <div class="text-xs text-brand-200">Pengolahan data instansi</div>
            </div>
        </div>

        <nav class="space-y-1 text-sm font-medium">
            @foreach ($nav as $n)
                <a href="{{ route($n['rute']) }}" @if ($n['aktif']) aria-current="page" @endif
                   class="flex items-center gap-3 rounded-lg px-3 py-2.5 {{ $n['aktif'] ? 'bg-brand-800 text-white' : 'hover:bg-brand-800/60' }}">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="{{ $n['ikon'] }}"/>
                    </svg>
                    {{ $n['nama'] }}
                </a>
            @endforeach
        </nav>
    </aside>

    {{-- Header (mobile) --}}
    <header class="lg:hidden bg-brand-900 text-white">
        <div class="flex items-center justify-between px-5 py-4">
            <span class="font-bold">Platform Data</span>
            <button type="button" id="menu-tombol" aria-expanded="false" aria-controls="menu-mobile" aria-label="Buka menu"
                    class="rounded-lg p-2 hover:bg-brand-800">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16"/>
                </svg>
            </button>
        </div>
        <nav id="menu-mobile" class="hidden border-t border-brand-800 px-3 py-2 text-sm font-medium">
            @foreach ($nav as $n)
                <a href="{{ route($n['rute']) }}"
                   class="block rounded-lg px-3 py-2.5 {{ $n['aktif'] ? 'bg-brand-800' : 'hover:bg-brand-800/60' }}">{{ $n['nama'] }}</a>
            @endforeach
        </nav>
    </header>
    <script>
        const tombolMenu = document.getElementById('menu-tombol');
        tombolMenu.addEventListener('click', () => {
            const buka = document.getElementById('menu-mobile').classList.toggle('hidden') === false;
            tombolMenu.setAttribute('aria-expanded', buka);
        });
    </script>

    <main class="flex-1 min-w-0">
        <div class="max-w-5xl mx-auto px-5 py-8 lg:px-10 lg:py-10">

            @if (session('sukses'))
                <div role="status" class="mb-6 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                    {{ session('sukses') }}
                </div>
            @endif
            @if (session('gagal'))
                <div role="alert" class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {{ session('gagal') }}
                </div>
            @endif

            @yield('content')
        </div>
    </main>
</div>
</body>
</html>
