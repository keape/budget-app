# Portfolio Rendimento (Return) — Design Spec

**Date:** 2026-03-26
**Scope:** `budget365iOS` — SavingsScreen, Portfolio tab only
**Backend changes:** None required

---

## Overview

Add return (rendimento) calculation to the Portfolio tab of SavingsScreen.
Each instrument row will show: invested cost, current value, and gain/loss (absolute + %).
The footer summary will show totals for all three values.

---

## Data

The `/api/savings/portfolio` endpoint already returns all required fields per item:

| Field | Meaning |
|---|---|
| `totalAmount` | Total cost paid (sum of all allocations) |
| `totalQuantity` | Total units held |
| `estimatedCurrentValue` | `totalQuantity × instrument.lastPrice` (null if unavailable) |

No backend changes needed.

---

## Per-Instrument Row Layout

**When `estimatedCurrentValue` is available:**
```
[BADGE] VWCE                      EUR
        Investito    €1.200,00
        Valore att.  €1.450,00
        Rendimento   +€250,00  +20,8%    ← colored
```

**When `estimatedCurrentValue` is null (no price or no quantity):**
```
[BADGE] AAPL                      USD
        Investito    €500,00
```
No return rows are shown. Quantity is omitted from this layout (it was previously shown as "Q: x.xxxx" — remove it in favour of the structured sub-rows).

### Return calculation
```
returnAbs = estimatedCurrentValue - totalAmount
returnPct = (returnAbs / totalAmount) * 100
```

### Color coding
- `returnAbs > 0` → green `#059669`
- `returnAbs < 0` → red `#DC2626`
- `returnAbs === 0` → gray `#6B7280`

### Return formatting
- Absolute: prefix `+` for positive, `-` for negative (formatted with `formatCurrency`)
- Percentage: `+20.8%` / `-5.2%` — one decimal place, same color as absolute

---

## Footer Summary

Replace the current single "Total portfolio value" row with three rows:

```
Totale investito      €3.500,00
Totale valore att.    €4.100,00
Rendimento totale     +€600,00  +17,1%    ← colored
```

### Calculation scope
Only items where `estimatedCurrentValue != null` contribute to "Totale valore att." and "Rendimento totale". Items without a current price are excluded from these totals (their cost is still included in "Totale investito").

### Totals
```
totalInvested         = sum of ALL items' totalAmount
pricedItems           = items where estimatedCurrentValue != null
totalCurrentValue     = sum of pricedItems' estimatedCurrentValue
pricedInvested        = sum of pricedItems' totalAmount
totalReturnAbs        = totalCurrentValue - pricedInvested
totalReturnPct        = (totalReturnAbs / pricedInvested) * 100
```

The "Totale investito" row always shows the full invested amount across all instruments.
"Totale valore att." and "Rendimento totale" rows are only shown if at least one item has a current value.

---

## Implementation Scope

Changes are **UI-only**, confined to `SavingsScreen.tsx`:

1. **`renderPortfolioTab`** — update each portfolio row to the new structured layout
2. **Footer summary** — replace the single total row with three rows
3. **Styles** — add new style entries for the sub-rows and return color variants
4. **Remove** `portfolioTotalValue` derived variable (replaced by three separate totals)
5. **No changes** to state, API calls, or any other tab

---

## Out of Scope

- Backend changes
- Historical return per month
- Unrealised vs realised distinction
- Currency conversion
