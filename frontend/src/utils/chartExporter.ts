/**
 * Utilitas Ekspor Grafik Sisi Klien ke SVG dan PNG (Fase 5: F-34)
 *
 * Aturan Keamanan & Privasi:
 * - 100% dieksekusi di sisi klien tanpa permintaan jaringan keluar.
 * - Tidak memakai innerHTML atau dangerouslySetInnerHTML untuk menyisipkan data/teks.
 * - Seluruh teks (judul, subjudul, nama dataset, label data) dibuat melalui DOM API
 *   (`document.createElementNS` + `textContent`) dan fungsi `escapeXml` saat serialisasi,
 *   sehingga aman dari injeksi XML/XSS.
 * - Nama berkas dibersihkan (`[^a-zA-Z0-9_-]` -> `_`) dan dibatasi maksimal 80 karakter.
 * - Ukuran kanvas PNG dibatasi (maksimal 2400x1800 piksel) agar tidak menghabiskan memori,
 *   dan seluruh Object URL dibebaskan (`URL.revokeObjectURL`) segera setelah unduhan selesai.
 * - Font pada ekspor memakai tumpukan font cadangan generik (`'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`
 *   dan `'JetBrains Mono', ui-monospace, Consolas, monospace`) tanpa klaim font tertanam
 *   dan tanpa melakukan fetch jaringan terhadap berkas woff2.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_FILENAME_LENGTH = 80;
const MAX_CANVAS_WIDTH = 2400;
const MAX_CANVAS_HEIGHT = 1800;

/**
 * Escape karakter khusus XML pada string teks
 */
export function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Membersihkan dan membatasi panjang nama berkas unduhan grafik maksimal 80 karakter.
 * Format: {nama_dataset}_{jenis_grafik}.{ext}
 */
export function buildSafeChartFilename(
  datasetName: string | undefined | null,
  chartTypeSlug: string,
  ext: 'svg' | 'png'
): string {
  const cleanDataset = String(datasetName || 'dataset')
    .replace(/\.[^/.]+$/, '') // hapus ekstensi .csv/.xlsx jika ada
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'dataset';

  const cleanChart = String(chartTypeSlug || 'grafik')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'grafik';

  const suffix = `_${cleanChart}.${ext}`;
  const maxDatasetLen = Math.max(10, MAX_FILENAME_LENGTH - suffix.length);
  const truncatedDataset = cleanDataset.slice(0, maxDatasetLen).replace(/_+$/g, '');

  const full = `${truncatedDataset}${suffix}`;
  return full.slice(0, MAX_FILENAME_LENGTH);
}

/**
 * Membaca nilai variabel CSS dari root dokumen sesuai tema aktif (Light Mode / Obsidian Data Mode)
 */
function getResolvedThemeVariables(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const style = window.getComputedStyle(document.documentElement);
  const vars = [
    '--color-canvas',
    '--color-surface',
    '--color-header',
    '--color-border',
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-muted',
    '--color-brand-primary',
    '--color-brand-cyan',
    '--color-brand-violet',
    '--color-anomaly-success-text',
    '--color-anomaly-success-bg',
    '--color-anomaly-warning-text',
    '--color-anomaly-warning-bg',
    '--color-anomaly-danger-text',
    '--color-anomaly-danger-bg',
  ];

  const map: Record<string, string> = {};
  for (const v of vars) {
    const val = style.getPropertyValue(v).trim();
    if (val) {
      map[v] = val;
    }
  }
  return map;
}

/**
 * Mengganti referensi `var(--color-...)` pada atribut elemen SVG dengan nilai warna terkomputasi
 * agar berkas SVG/PNG mandiri tetap menampilkan warna tema aktif secara akurat.
 */
function resolveCssVarsInString(
  raw: string,
  varMap: Record<string, string>
): string {
  if (!raw || !raw.includes('var(')) return raw;
  return raw.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/g, (_, varName, fallback) => {
    return varMap[varName] || (fallback ? fallback.trim() : 'currentColor');
  });
}

function inlineResolvedStylesOnClone(
  rootSvg: SVGSVGElement,
  varMap: Record<string, string>
): void {
  const elements = [rootSvg, ...Array.from(rootSvg.querySelectorAll('*'))];
  const presentationAttrs = ['fill', 'stroke', 'color', 'stop-color', 'style'];

  for (const el of elements) {
    for (const attr of presentationAttrs) {
      const val = el.getAttribute(attr);
      if (val && val.includes('var(')) {
        el.setAttribute(attr, resolveCssVarsInString(val, varMap));
      }
    }
    if (el.tagName.toLowerCase() === 'text' || el.tagName.toLowerCase() === 'tspan') {
      const currentFont = el.getAttribute('font-family') || '';
      if (currentFont.toLowerCase().includes('mono')) {
        el.setAttribute(
          'font-family',
          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        );
      } else {
        el.setAttribute(
          'font-family',
          "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        );
      }
    }
  }
}

export interface ExportChartOptions {
  containerElement: HTMLElement | null;
  datasetName?: string | null;
  chartTypeSlug: string;
  title: string;
  subtitle?: string;
}

/**
 * Menyusun dokumen SVG mandiri lengkap dengan latar belakang tema, header judul/subjudul yang aman (DOM API),
 * dan isi grafik dari elemen `<svg>` di dalam `containerElement`.
 */
function buildStandaloneSvgElement(options: ExportChartOptions): {
  svgString: string;
  width: number;
  height: number;
  surfaceBg: string;
} | null {
  const { containerElement, title, subtitle, datasetName } = options;
  if (!containerElement) return null;

  // Cari elemen SVG utama (prioritaskan .recharts-surface atau svg dengan data-export-svg="true")
  const sourceSvg =
    containerElement.querySelector<SVGSVGElement>('svg[data-export-svg="true"]') ||
    containerElement.querySelector<SVGSVGElement>('svg.recharts-surface') ||
    containerElement.querySelector<SVGSVGElement>('svg');

  if (!sourceSvg) return null;

  const varMap = getResolvedThemeVariables();
  const surfaceBg = varMap['--color-surface'] || 'rgb(255, 255, 255)';
  const borderCol = varMap['--color-border'] || 'rgb(226, 232, 240)';
  const textPrimary = varMap['--color-text-primary'] || 'rgb(15, 23, 42)';
  const textSecondary = varMap['--color-text-secondary'] || 'rgb(71, 85, 105)';

  const rect = sourceSvg.getBoundingClientRect();
  const contentWidth = Math.max(480, Math.round(rect.width || Number(sourceSvg.getAttribute('width')) || 640));
  const contentHeight = Math.max(260, Math.round(rect.height || Number(sourceSvg.getAttribute('height')) || 340));

  const paddingX = 24;
  const headerHeight = 68;
  const footerHeight = 24;
  const totalWidth = contentWidth + paddingX * 2;
  const totalHeight = contentHeight + headerHeight + footerHeight;

  // Buat root SVG baru menggunakan createElementNS (tanpa innerHTML)
  const wrapperSvg = document.createElementNS(SVG_NS, 'svg');
  wrapperSvg.setAttribute('xmlns', SVG_NS);
  wrapperSvg.setAttribute('width', String(totalWidth));
  wrapperSvg.setAttribute('height', String(totalHeight));
  wrapperSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

  // Style blok untuk tabular-nums dan font cadangan generik
  const styleEl = document.createElementNS(SVG_NS, 'style');
  styleEl.textContent = `
    text, tspan {
      font-variant-numeric: tabular-nums;
    }
  `;
  wrapperSvg.appendChild(styleEl);

  // Latar belakang kartu sesuai tema aktif
  const bgRect = document.createElementNS(SVG_NS, 'rect');
  bgRect.setAttribute('x', '0.5');
  bgRect.setAttribute('y', '0.5');
  bgRect.setAttribute('width', String(totalWidth - 1));
  bgRect.setAttribute('height', String(totalHeight - 1));
  bgRect.setAttribute('rx', '12');
  bgRect.setAttribute('fill', surfaceBg);
  bgRect.setAttribute('stroke', borderCol);
  bgRect.setAttribute('stroke-width', '1');
  wrapperSvg.appendChild(bgRect);

  // Judul grafik (menggunakan textContent agar di-escape otomatis oleh XMLSerializer + escapeXml)
  const titleEl = document.createElementNS(SVG_NS, 'text');
  titleEl.setAttribute('x', String(paddingX));
  titleEl.setAttribute('y', '30');
  titleEl.setAttribute('fill', textPrimary);
  titleEl.setAttribute('font-size', '16');
  titleEl.setAttribute('font-weight', '700');
  titleEl.setAttribute(
    'font-family',
    "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
  );
  titleEl.textContent = escapeXml(title).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  wrapperSvg.appendChild(titleEl);

  // Subjudul sumber kolom + nama dataset
  const subtitleText = [subtitle, datasetName ? `Dataset: ${datasetName}` : null]
    .filter(Boolean)
    .join(' • ');

  if (subtitleText) {
    const subEl = document.createElementNS(SVG_NS, 'text');
    subEl.setAttribute('x', String(paddingX));
    subEl.setAttribute('y', '50');
    subEl.setAttribute('fill', textSecondary);
    subEl.setAttribute('font-size', '12');
    subEl.setAttribute('font-weight', '500');
    subEl.setAttribute(
      'font-family',
      "'JetBrains Mono', ui-monospace, Consolas, monospace"
    );
    subEl.textContent = escapeXml(subtitleText).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    wrapperSvg.appendChild(subEl);
  }

  // Kloning grafik SVG dan terapkan resolusi CSS variable
  const clonedChartSvg = sourceSvg.cloneNode(true) as SVGSVGElement;
  inlineResolvedStylesOnClone(clonedChartSvg, varMap);
  clonedChartSvg.setAttribute('x', String(paddingX));
  clonedChartSvg.setAttribute('y', String(headerHeight));
  clonedChartSvg.setAttribute('width', String(contentWidth));
  clonedChartSvg.setAttribute('height', String(contentHeight));

  wrapperSvg.appendChild(clonedChartSvg);

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(wrapperSvg);
  const svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;

  return {
    svgString,
    width: totalWidth,
    height: totalHeight,
    surfaceBg,
  };
}

/**
 * Memicu unduhan berkas Blob di browser dan membebaskan Object URL segera setelah selesai
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 250);
  }
}

/**
 * Ekspor grafik ke berkas vektor SVG (.svg) di sisi klien
 */
export function exportChartAsSvg(options: ExportChartOptions): boolean {
  const built = buildStandaloneSvgElement(options);
  if (!built) return false;

  const filename = buildSafeChartFilename(
    options.datasetName,
    options.chartTypeSlug,
    'svg'
  );
  const blob = new Blob([built.svgString], {
    type: 'image/svg+xml;charset=utf-8',
  });
  triggerBlobDownload(blob, filename);
  return true;
}

/**
 * Ekspor grafik ke berkas gambar PNG (.png) di sisi klien dengan pembatasan ukuran kanvas
 */
export async function exportChartAsPng(
  options: ExportChartOptions
): Promise<boolean> {
  const built = buildStandaloneSvgElement(options);
  if (!built) return false;

  const filename = buildSafeChartFilename(
    options.datasetName,
    options.chartTypeSlug,
    'png'
  );

  // Hitung faktor skala dengan batas memori kanvas maksimum (MAX_CANVAS_WIDTH x MAX_CANVAS_HEIGHT)
  const desiredScale = 2;
  const maxScaleX = MAX_CANVAS_WIDTH / built.width;
  const maxScaleY = MAX_CANVAS_HEIGHT / built.height;
  const safeScale = Math.max(1, Math.min(desiredScale, maxScaleX, maxScaleY));

  const canvasWidth = Math.round(built.width * safeScale);
  const canvasHeight = Math.round(built.height * safeScale);

  const svgBlob = new Blob([built.svgString], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(svgUrl);
          resolve(false);
          return;
        }
        ctx.fillStyle = built.surfaceBg;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        URL.revokeObjectURL(svgUrl);

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            resolve(false);
            return;
          }
          triggerBlobDownload(pngBlob, filename);
          resolve(true);
        }, 'image/png');
      } catch {
        URL.revokeObjectURL(svgUrl);
        resolve(false);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      resolve(false);
    };
    img.src = svgUrl;
  });
}
