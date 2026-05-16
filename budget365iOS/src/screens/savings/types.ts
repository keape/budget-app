// ============================================================
// Interfacce condivise — Savings screen
// ============================================================

export interface InstrumentData {
  _id: string;
  ticker: string;
  name: string;
  type: string;
  currency?: string;
  exchange?: string;
  country?: string;
  lastPrice?: number;
}

export interface AllocationData {
  _id: string;
  instrumentId: InstrumentData;
  amount: number;
  quantity?: number;
  priceAtAllocation?: number;
  savingsMonthId: string;
}

export interface PlanAllocation {
  instrumentId: InstrumentData;
  targetPercentage: number;
}

export interface PlanData {
  _id: string;
  userId: string;
  allocations: PlanAllocation[];
}

export interface PortfolioItem {
  instrument: InstrumentData;
  totalAmount: number;
  totalQuantity: number;
  estimatedCurrentValue: number | null;
}

export interface SavingsMonthData {
  _id: string;
  anno: number;
  mese: number;
  income: number;
  expenses: number;
  savings: number;
  status: string;
}

export type ActiveTab = 'mese' | 'piano' | 'portfolio';

export interface FetchState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}
