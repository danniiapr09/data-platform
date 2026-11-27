import React, { useState } from 'react';
import { Grid } from 'lucide-react';
import { ChartCardShell } from './ChartCardShell';
import { FullscreenChartModal } from './FullscreenChartModal';
import { EdaCorrelationPair } from '@/types/analytics';
import { formatNumberId } from '@/utils/formatters';

export interface CorrelationMatrixCardProps {
  datasetName?: string | null;
  selectedNumericColumns: string[];
  correlationMatrix: Record<string, Record<string, number | null>>;
  topPairs: EdaCorrelationPair[];
  isLoading: boolean;
  isFetching?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

/**
 * Kartu Matriks Korelasi Numerik Interaktif (Fase 5: F-21 & Penyesuaian Wajib butir e):
 * - Dibangun sebagai SVG agar dapat diekspor langsung ke PNG dan SVG di sisi klien.
 * - Menggunakan skala satu rona dari token utama (`var(--color-brand-primary)` untuk korelasi positif
 *   dan `var(--color-brand-violet)` untuk korelasi negatif) melalui `fillOpacity`.
 * - Setiap sel menampilkan angka korelasi (`JetBrains Mono`, `tabular-nums`, format Indonesia)
 *   dengan warna teks yang menjaga kontras (putih pada sel beropasitas tinggi, teks utama pada opasitas rendah)
 *   serta penanda jelas `-` untuk sel `null`.
 * - Dibungkus `overflow-x-auto` untuk matriks lebar.
 */
export const CorrelationMatrixCard: React.FC<CorrelationMatrixCardProps> = ({
  datasetName,
  selectedNumericColumns,
  correlationMatrix,
  topPairs,
  isLoading,
  isFetching,
  errorMessage,
  onRetry,
}) => {
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  // Filter kolom yang ada di matriks korelasi
  const matrixCols = selectedNumericColumns.filter(
    (col) => correlationMatrix[col] !== undefined
  );

  // Batasi maksimal 15x15 di tampilan agar tetap terbaca
  const MAX_MATRIX_COLS = 15;
  const displayedCols = matrixCols.slice(0, MAX_MATRIX_COLS);
  const isTruncated = matrixCols.length > MAX_MATRIX_COLS;
  const truncationNote = isTruncated
    ? `Menampilkan ${formatNumberId(MAX_MATRIX_COLS, 0)} teratas dari ${formatNumberId(
        matrixCols.length,
        0
      )} kolom numerik terpilih`
    : null;

  // Pasangan korelasi teratas yang melibatkan kolom terpilih
  const relevantPairs = topPairs.filter(
    (p) =>
      selectedNumericColumns.includes(p.kolom_a) &&
      selectedNumericColumns.includes(p.kolom_b)
  );

  const renderSvgMatrix = (cellSize: number, labelWidth: number) => {
    const n = displayedCols.length;
    if (n < 2) return null;

    const topHeaderHeight = 104;
    const legendHeight = 48;
    const matrixWidth = labelWidth + n * cellSize + 84;
    const minLegendWidth = labelWidth + 520;
    const svgWidth = Math.max(matrixWidth, minLegendWidth);
    const svgHeight = topHeaderHeight + n * cellSize + legendHeight;

    return (
      <div className="overflow-x-auto pb-2">
        <svg
          data-export-svg="true"
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={`Matriks korelasi Pearson untuk ${n} kolom numerik`}
          className="mx-auto"
        >
          {/* Label Kolom Atas */}
          {displayedCols.map((col, colIdx) => {
            const cx = labelWidth + colIdx * cellSize + cellSize / 2;
            const shortName =
              col.length > 16 ? `${col.slice(0, 14)}..` : col;
            return (
              <text
                key={`header-${col}`}
                x={cx}
                y={topHeaderHeight - 12}
                textAnchor="start"
                transform={`rotate(-30, ${cx}, ${topHeaderHeight - 12})`}
                fill="var(--color-text-secondary)"
                fontSize="12"
                fontWeight="600"
                fontFamily="'JetBrains Mono', monospace"
              >
                {shortName}
              </text>
            );
          })}

          {/* Baris & Sel Matriks */}
          {displayedCols.map((rowCol, rowIdx) => {
            const y = topHeaderHeight + rowIdx * cellSize;
            const shortRowName =
              rowCol.length > 20 ? `${rowCol.slice(0, 18)}..` : rowCol;

            return (
              <g key={`row-${rowCol}`}>
                {/* Label Baris Kiri */}
                <text
                  x={labelWidth - 10}
                  y={y + cellSize / 2 + 4}
                  textAnchor="end"
                  fill="var(--color-text-primary)"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {shortRowName}
                </text>

                {/* Sel Korelasi */}
                {displayedCols.map((colCol, colIdx) => {
                  const x = labelWidth + colIdx * cellSize;
                  const val = correlationMatrix[rowCol]?.[colCol] ?? null;
                  const isNull = val === null || Number.isNaN(val);
                  const absVal = isNull ? 0 : Math.min(1, Math.abs(val));

                  // Skala satu rona dari token utama (Royal Blue/Sky untuk >= 0, Violet untuk < 0)
                  const isPositive = !isNull && val >= 0;
                  const fillToken = isNull
                    ? 'var(--color-header)'
                    : isPositive
                    ? 'var(--color-brand-primary)'
                    : 'var(--color-brand-violet)';

                  // Pemetaan opasitas yang melompati zona mati kontras (0,60-0,81) untuk sel primary
                  // sehingga rasio kontras teks selalu >= 4,5:1 di Light & Dark Mode:
                  // - Violet (negatif): selalu memakai var(--color-text-primary) (>= 4,69:1 s/d opasitas 0,90)
                  // - Primary (positif): absVal < 0,65 -> opasitas 0,14..0,58 + text-primary (>= 4,90:1);
                  //                      absVal >= 0,65 -> opasitas 0,82..0,96 + surface (>= 4,63:1)
                  let fillOpacity = 1;
                  let textFill = 'var(--color-text-primary)';
                  if (!isNull) {
                    if (isPositive) {
                      if (absVal < 0.65) {
                        fillOpacity = Number((0.14 + (absVal / 0.65) * 0.44).toFixed(2));
                        textFill = 'var(--color-text-primary)';
                      } else {
                        fillOpacity = Number((0.82 + ((absVal - 0.65) / 0.35) * 0.14).toFixed(2));
                        textFill = 'var(--color-surface)';
                      }
                    } else {
                      fillOpacity = Number((0.12 + absVal * 0.78).toFixed(2));
                      textFill = 'var(--color-text-primary)';
                    }
                  }

                  const formattedVal = isNull
                    ? 'null'
                    : formatNumberId(val, 2);

                  return (
                    <g key={`cell-${rowCol}-${colCol}`}>
                      <title>
                        {`${rowCol} × ${colCol}: ${
                          isNull
                            ? 'Tidak tersedia (null)'
                            : formatNumberId(val, 4)
                        }`}
                      </title>
                      <rect
                        x={x + 2}
                        y={y + 2}
                        width={cellSize - 4}
                        height={cellSize - 4}
                        rx="6"
                        fill={fillToken}
                        fillOpacity={fillOpacity}
                        stroke="var(--color-border)"
                        strokeWidth="1"
                        strokeDasharray={isNull ? '3 3' : undefined}
                      />
                      <text
                        x={x + cellSize / 2}
                        y={y + cellSize / 2 + 4}
                        textAnchor="middle"
                        fill={textFill}
                        fontSize="12"
                        fontWeight="600"
                        fontFamily="'JetBrains Mono', monospace"
                      >
                        {formattedVal}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Legenda Minimum (-1,00) sampai Maksimum (+1,00) & Penanda Sel Null */}
          <g
            transform={`translate(${labelWidth}, ${
              topHeaderHeight + n * cellSize + 18
            })`}
          >
            <rect
              x="0"
              y="0"
              width="16"
              height="14"
              rx="3"
              fill="var(--color-brand-violet)"
              fillOpacity="0.85"
            />
            <text
              x="22"
              y="11"
              fill="var(--color-text-secondary)"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
            >
              -1,00 (Negatif)
            </text>

            <rect
              x="125"
              y="0"
              width="16"
              height="14"
              rx="3"
              fill="var(--color-brand-primary)"
              fillOpacity="0.15"
              stroke="var(--color-border)"
            />
            <text
              x="147"
              y="11"
              fill="var(--color-text-secondary)"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
            >
              0,00 (Lemah)
            </text>

            <rect
              x="235"
              y="0"
              width="16"
              height="14"
              rx="3"
              fill="var(--color-brand-primary)"
              fillOpacity="0.9"
            />
            <text
              x="257"
              y="11"
              fill="var(--color-text-secondary)"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
            >
              +1,00 (Positif)
            </text>

            <rect
              x="360"
              y="0"
              width="16"
              height="14"
              rx="3"
              fill="var(--color-header)"
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <text
              x="382"
              y="11"
              fill="var(--color-text-secondary)"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
            >
              null (Data Kosong/Konstan)
            </text>
          </g>
        </svg>
      </div>
    );
  };

  return (
    <>
      <ChartCardShell
        title="Matriks Korelasi Numerik Interaktif"
        subtitle={`Korelasi Pearson antar ${formatNumberId(
          displayedCols.length,
          0
        )} variabel angka`}
        chartTypeSlug="matriks_korelasi"
        datasetName={datasetName}
        icon={<Grid className="w-5 h-5" />}
        ariaSummary={`Matriks korelasi linier Pearson antara ${displayedCols.join(
          ', '
        )}.`}
        truncationNote={truncationNote}
        isLoading={isLoading}
        isFetching={isFetching}
        errorMessage={errorMessage}
        onRetry={onRetry}
        isConditionUnmet={displayedCols.length < 2}
        conditionExplanation="Centang minimal 2 kolom numerik [123] di panel kiri untuk menghitung matriks korelasi."
        onOpenFullscreen={() => setIsFullscreenOpen(true)}
      >
        <div className="space-y-4">
          {renderSvgMatrix(64, 155)}

          {/* Daftar 5 Pasangan Korelasi Teratas dari Backend */}
          {relevantPairs.length > 0 && (
            <div className="pt-3 border-t border-border-light dark:border-border-dark">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mb-2">
                Pasangan Korelasi Terkuat
              </h4>
              <div className="flex flex-wrap gap-2">
                {relevantPairs.map((pair) => (
                  <span
                    key={`${pair.kolom_a}-${pair.kolom_b}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark tabular-numbers"
                  >
                    <span>
                      {pair.kolom_a} ↔ {pair.kolom_b}:
                    </span>
                    <strong className="text-brand-primary-light dark:text-brand-primary-dark">
                      {formatNumberId(pair.korelasi, 3)}
                    </strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </ChartCardShell>

      <FullscreenChartModal
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        title="Matriks Korelasi Numerik Interaktif"
        subtitle={`Korelasi Pearson antar ${formatNumberId(
          displayedCols.length,
          0
        )} variabel angka`}
        chartTypeSlug="matriks_korelasi"
        datasetName={datasetName}
        truncationNote={truncationNote}
      >
        {renderSvgMatrix(78, 180)}
      </FullscreenChartModal>
    </>
  );
};
