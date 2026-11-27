import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AggregationFunction } from '@/types/analytics';

export interface Tab1MemoryState {
  selectedVersion?: 'raw' | 'clean';
  isAccordionOpen?: boolean;
  activeSubTab?: 'all' | 'preview' | 'history';
}

export interface Tab2MemoryState {
  filterJenis?: string;
  filterKolom?: string;
  filterStatus?: string;
  searchQuery?: string;
  pageSize?: number;
  currentPage?: number;
}

export interface Tab3MemoryState {
  selectedCategories?: string[];
  selectedNumerics?: string[];
  selectedTimeColumn?: string | null;
  manualTimeColumn?: string;
  aggregation?: AggregationFunction;
  hasInitialized?: boolean;
}

export interface Tab4MemoryState {
  selectedIndicator?: string;
  selectedTimeColumn?: string;
  selectedAggregation?: AggregationFunction;
  horizon?: number;
  testSizeInput?: string;
  hasCustomEdits?: boolean;
}

export interface WorkspaceTabMemoryState {
  tab1: Tab1MemoryState;
  tab2: Tab2MemoryState;
  tab3: Tab3MemoryState;
  tab4: Tab4MemoryState;
}

interface WorkspaceTabStateContextValue {
  state: WorkspaceTabMemoryState;
  updateTab1: (patch: Partial<Tab1MemoryState>) => void;
  updateTab2: (patch: Partial<Tab2MemoryState>) => void;
  updateTab3: (patch: Partial<Tab3MemoryState>) => void;
  updateTab4: (patch: Partial<Tab4MemoryState>) => void;
}

const EMPTY_STATE: WorkspaceTabMemoryState = {
  tab1: {},
  tab2: {},
  tab3: {},
  tab4: {},
};

const WorkspaceTabStateContext = createContext<WorkspaceTabStateContextValue | null>(
  null
);

/**
 * Penyimpanan state UI antar-tab (Tab 1-4) khusus di memori React (TANPA localStorage/sessionStorage).
 * Otomatis di-reset ketika datasetId berubah. Tidak menyimpan activeEditAnomalyId atau selectedAnomalyIds
 * demi keselamatan operasional.
 */
export const WorkspaceTabStateProvider: React.FC<{
  datasetId: string;
  children: React.ReactNode;
}> = ({ datasetId, children }) => {
  const [byDataset, setByDataset] = useState<
    Record<string, WorkspaceTabMemoryState>
  >({});

  // Bersihkan entri dataset lain agar memori tetap ringan
  useEffect(() => {
    setByDataset((prev) =>
      prev[datasetId] ? { [datasetId]: prev[datasetId] } : {}
    );
  }, [datasetId]);

  const current = byDataset[datasetId] || EMPTY_STATE;

  const updateTab1 = useCallback(
    (patch: Partial<Tab1MemoryState>) => {
      setByDataset((prev) => {
        const cur = prev[datasetId] || EMPTY_STATE;
        return {
          ...prev,
          [datasetId]: { ...cur, tab1: { ...cur.tab1, ...patch } },
        };
      });
    },
    [datasetId]
  );

  const updateTab2 = useCallback(
    (patch: Partial<Tab2MemoryState>) => {
      setByDataset((prev) => {
        const cur = prev[datasetId] || EMPTY_STATE;
        return {
          ...prev,
          [datasetId]: { ...cur, tab2: { ...cur.tab2, ...patch } },
        };
      });
    },
    [datasetId]
  );

  const updateTab3 = useCallback(
    (patch: Partial<Tab3MemoryState>) => {
      setByDataset((prev) => {
        const cur = prev[datasetId] || EMPTY_STATE;
        return {
          ...prev,
          [datasetId]: { ...cur, tab3: { ...cur.tab3, ...patch } },
        };
      });
    },
    [datasetId]
  );

  const updateTab4 = useCallback(
    (patch: Partial<Tab4MemoryState>) => {
      setByDataset((prev) => {
        const cur = prev[datasetId] || EMPTY_STATE;
        return {
          ...prev,
          [datasetId]: { ...cur, tab4: { ...cur.tab4, ...patch } },
        };
      });
    },
    [datasetId]
  );

  return (
    <WorkspaceTabStateContext.Provider
      value={{
        state: current,
        updateTab1,
        updateTab2,
        updateTab3,
        updateTab4,
      }}
    >
      {children}
    </WorkspaceTabStateContext.Provider>
  );
};

export function useWorkspaceTabState(): WorkspaceTabStateContextValue {
  const ctx = useContext(WorkspaceTabStateContext);
  if (!ctx) {
    return {
      state: EMPTY_STATE,
      updateTab1: () => {},
      updateTab2: () => {},
      updateTab3: () => {},
      updateTab4: () => {},
    };
  }
  return ctx;
}
