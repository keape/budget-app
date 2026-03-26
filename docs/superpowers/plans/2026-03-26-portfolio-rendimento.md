# Portfolio Rendimento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add return (rendimento) display to the Portfolio tab — showing invested cost, current value, and gain/loss (absolute + %) per instrument and in the summary footer.

**Architecture:** UI-only change confined to `SavingsScreen.tsx`. Replace the derived `portfolioTotalValue` variable with three separate totals. Rewrite each portfolio row to show structured sub-rows (Invested / Curr. value / Return). Replace the single footer row with a three-row summary card. Add new styles; remove obsolete ones.

**Tech Stack:** React Native 0.80.2, TypeScript, StyleSheet

---

## File Map

| File | Change |
|---|---|
| `budget365iOS/src/screens/SavingsScreen.tsx` | Replace derived totals (~line 601), rewrite `renderPortfolioTab` (~line 1051), update styles (~line 1805) |

No other files are modified. No backend changes.

**Task order note:** Styles must be updated (Task 2) before the row and footer rewrites (Tasks 3–4) so that TypeScript can resolve the new style keys at compile time.

---

### Task 1: Replace `portfolioTotalValue` with three derived totals

**Files:**
- Modify: `budget365iOS/src/screens/SavingsScreen.tsx:601-605`

- [ ] **Step 1: Replace the `portfolioTotalValue` block**

Find and replace this block (around line 601):
```typescript
  const portfolioTotalValue = portfolio.reduce(
    (sum: number, item: PortfolioItem) =>
      sum + (item.estimatedCurrentValue ?? item.totalAmount ?? 0),
    0,
  );
```

With:
```typescript
  const portfolioTotalInvested = portfolio.reduce(
    (sum: number, item: PortfolioItem) => sum + (item.totalAmount ?? 0),
    0,
  );

  const pricedItems = portfolio.filter(
    (item: PortfolioItem) => item.estimatedCurrentValue != null,
  );
  const portfolioTotalCurrentValue = pricedItems.reduce(
    (sum: number, item: PortfolioItem) => sum + (item.estimatedCurrentValue as number),
    0,
  );
  const portfolioTotalPricedInvested = pricedItems.reduce(
    (sum: number, item: PortfolioItem) => sum + (item.totalAmount ?? 0),
    0,
  );
  const portfolioTotalReturnAbs = portfolioTotalCurrentValue - portfolioTotalPricedInvested;
  const portfolioTotalReturnPct =
    portfolioTotalPricedInvested > 0
      ? (portfolioTotalReturnAbs / portfolioTotalPricedInvested) * 100
      : null;
```

- [ ] **Step 2: Add return formatting helpers**

Right after the `formatCurrency` helper (around line 593), add:
```typescript
  const formatReturnAbs = (abs: number): string => {
    if (!showBalance) return '****';
    const sign = abs >= 0 ? '+' : '-';
    return `${sign}${currency}${Math.abs(abs).toFixed(2)}`;
  };

  const formatReturnPct = (pct: number): string => {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /Users/keape/Documents/budget365/budget365iOS && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
cd /Users/keape/Documents/budget365
git add budget365iOS/src/screens/SavingsScreen.tsx
git commit -m "feat(savings): derive portfolio return totals and add format helpers"
```

---

### Task 2: Update styles

**Files:**
- Modify: `budget365iOS/src/screens/SavingsScreen.tsx` — styles section (~lines 1805–1865)

- [ ] **Step 1: Replace the portfolio styles block**

Find the entire `// Portfolio row` styles block:
```typescript
  // Portfolio row
  portfolioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  portfolioInfo: {
    flex: 1,
    marginRight: 8,
  },
  portfolioName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  portfolioMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  portfolioValues: {
    alignItems: 'flex-end',
  },
  portfolioAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  portfolioEstValue: {
    fontSize: 12,
    marginTop: 2,
  },
  portfolioTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  portfolioTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  portfolioTotalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
```

Replace with:
```typescript
  // Portfolio row
  portfolioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  portfolioInfo: {
    flex: 1,
    marginRight: 8,
  },
  portfolioName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  portfolioMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  portfolioDetail: {
    alignItems: 'flex-end',
  },
  portfolioDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  portfolioDetailLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginRight: 6,
    width: 62,
    textAlign: 'right',
  },
  portfolioDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    minWidth: 80,
    textAlign: 'right',
  },
  portfolioSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  portfolioSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  portfolioSummaryReturnRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  portfolioSummaryLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  portfolioSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  portfolioSummaryReturnValue: {
    fontSize: 15,
    fontWeight: '700',
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/keape/Documents/budget365/budget365iOS && npx tsc --noEmit 2>&1 | head -30
```
Expected: no new errors (old code still references old style keys — they will be resolved in Task 3).

- [ ] **Step 3: Commit**

```bash
cd /Users/keape/Documents/budget365
git add budget365iOS/src/screens/SavingsScreen.tsx
git commit -m "feat(savings): update portfolio styles for rendimento layout"
```

---

### Task 3: Rewrite the portfolio instrument row

**Files:**
- Modify: `budget365iOS/src/screens/SavingsScreen.tsx` — the `.map()` inside `renderPortfolioTab` (~lines 1069–1116)

- [ ] **Step 1: Replace the portfolio row render block**

Find this entire block:
```typescript
          {portfolio.map((item: PortfolioItem, idx: number) => {
            const ticker = item.instrument?.ticker ?? '?';
            const name = item.instrument?.name ?? ticker;
            const itemCurrency = item.instrument?.currency ?? '';
            const totalAmount: number = item.totalAmount ?? 0;
            const totalQuantity: number = item.totalQuantity ?? 0;
            const estValue: number | null = item.estimatedCurrentValue ?? null;

            return (
              <View
                key={idx}
                style={[styles.portfolioRow, isDarkMode && { backgroundColor: '#1F2937' }]}
              >
                <TickerBadge ticker={ticker} />
                <View style={styles.portfolioInfo}>
                  <Text
                    style={[styles.portfolioName, isDarkMode && { color: '#F9FAFB' }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {itemCurrency ? (
                    <Text style={[styles.portfolioMeta, isDarkMode && { color: '#9CA3AF' }]}>
                      {itemCurrency}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.portfolioValues}>
                  <Text style={[styles.portfolioAmount, isDarkMode && { color: '#F9FAFB' }]}>
                    {formatCurrency(totalAmount)}
                  </Text>
                  {totalQuantity > 0 && (
                    <Text style={[styles.portfolioMeta, isDarkMode && { color: '#9CA3AF' }]}>
                      Q: {totalQuantity.toFixed(4)}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.portfolioEstValue,
                      { color: estValue != null ? '#4F46E5' : '#9CA3AF' },
                    ]}
                  >
                    Current value:{' '}
                    {estValue != null ? formatCurrency(estValue) : 'N/A'}
                  </Text>
                </View>
              </View>
            );
          })}
```

Replace with:
```typescript
          {portfolio.map((item: PortfolioItem, idx: number) => {
            const ticker = item.instrument?.ticker ?? '?';
            const name = item.instrument?.name ?? ticker;
            const itemCurrency = item.instrument?.currency ?? '';
            const totalAmount: number = item.totalAmount ?? 0;
            const estValue: number | null = item.estimatedCurrentValue ?? null;
            const returnAbs = estValue != null ? estValue - totalAmount : null;
            const returnPct =
              returnAbs != null && totalAmount > 0
                ? (returnAbs / totalAmount) * 100
                : null;
            const returnColor =
              returnAbs == null
                ? '#9CA3AF'
                : returnAbs > 0
                ? '#059669'
                : returnAbs < 0
                ? '#DC2626'
                : '#6B7280';

            return (
              <View
                key={idx}
                style={[styles.portfolioRow, isDarkMode && { backgroundColor: '#1F2937' }]}
              >
                <TickerBadge ticker={ticker} />
                <View style={styles.portfolioInfo}>
                  <Text
                    style={[styles.portfolioName, isDarkMode && { color: '#F9FAFB' }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {itemCurrency ? (
                    <Text style={[styles.portfolioMeta, isDarkMode && { color: '#9CA3AF' }]}>
                      {itemCurrency}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.portfolioDetail}>
                  <View style={styles.portfolioDetailRow}>
                    <Text style={[styles.portfolioDetailLabel, isDarkMode && { color: '#9CA3AF' }]}>
                      Invested
                    </Text>
                    <Text style={[styles.portfolioDetailValue, isDarkMode && { color: '#F9FAFB' }]}>
                      {formatCurrency(totalAmount)}
                    </Text>
                  </View>
                  {estValue != null && returnAbs != null && returnPct != null && (
                    <>
                      <View style={styles.portfolioDetailRow}>
                        <Text style={[styles.portfolioDetailLabel, isDarkMode && { color: '#9CA3AF' }]}>
                          Curr. value
                        </Text>
                        <Text style={[styles.portfolioDetailValue, isDarkMode && { color: '#F9FAFB' }]}>
                          {formatCurrency(estValue)}
                        </Text>
                      </View>
                      <View style={styles.portfolioDetailRow}>
                        <Text style={[styles.portfolioDetailLabel, isDarkMode && { color: '#9CA3AF' }]}>
                          Return
                        </Text>
                        <Text style={[styles.portfolioDetailValue, { color: returnColor }]}>
                          {formatReturnAbs(returnAbs)}{'  '}{formatReturnPct(returnPct)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            );
          })}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/keape/Documents/budget365/budget365iOS && npx tsc --noEmit 2>&1 | head -30
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/keape/Documents/budget365
git add budget365iOS/src/screens/SavingsScreen.tsx
git commit -m "feat(savings): rewrite portfolio instrument row with structured sub-rows"
```

---

### Task 4: Rewrite the footer summary

**Files:**
- Modify: `budget365iOS/src/screens/SavingsScreen.tsx` — the `{/* Total Portfolio Value */}` block (~lines 1119–1129)

- [ ] **Step 1: Replace the footer block**

Find:
```typescript
          {/* Total Portfolio Value */}
          <View
            style={[styles.portfolioTotalRow, isDarkMode && { backgroundColor: '#1F2937' }]}
          >
            <Text style={[styles.portfolioTotalLabel, isDarkMode && { color: '#9CA3AF' }]}>
              Total portfolio value:
            </Text>
            <Text style={[styles.portfolioTotalValue, { color: '#4F46E5' }]}>
              {formatCurrency(portfolioTotalValue)}
            </Text>
          </View>
```

Replace with:
```typescript
          {/* Portfolio Summary */}
          <View
            style={[styles.portfolioSummaryCard, isDarkMode && { backgroundColor: '#1F2937' }]}
          >
            <View style={styles.portfolioSummaryRow}>
              <Text style={[styles.portfolioSummaryLabel, isDarkMode && { color: '#9CA3AF' }]}>
                Total invested
              </Text>
              <Text style={[styles.portfolioSummaryValue, isDarkMode && { color: '#F9FAFB' }]}>
                {formatCurrency(portfolioTotalInvested)}
              </Text>
            </View>
            {pricedItems.length > 0 && (
              <>
                <View style={styles.portfolioSummaryRow}>
                  <Text style={[styles.portfolioSummaryLabel, isDarkMode && { color: '#9CA3AF' }]}>
                    Total curr. value
                  </Text>
                  <Text style={[styles.portfolioSummaryValue, isDarkMode && { color: '#F9FAFB' }]}>
                    {formatCurrency(portfolioTotalCurrentValue)}
                  </Text>
                </View>
                <View style={[styles.portfolioSummaryRow, styles.portfolioSummaryReturnRow]}>
                  <Text style={[styles.portfolioSummaryLabel, isDarkMode && { color: '#9CA3AF' }]}>
                    Total return
                  </Text>
                  <Text
                    style={[
                      styles.portfolioSummaryReturnValue,
                      {
                        color:
                          portfolioTotalReturnAbs > 0
                            ? '#059669'
                            : portfolioTotalReturnAbs < 0
                            ? '#DC2626'
                            : '#6B7280',
                      },
                    ]}
                  >
                    {formatReturnAbs(portfolioTotalReturnAbs)}
                    {'  '}
                    {portfolioTotalReturnPct != null
                      ? formatReturnPct(portfolioTotalReturnPct)
                      : ''}
                  </Text>
                </View>
              </>
            )}
          </View>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/keape/Documents/budget365/budget365iOS && npx tsc --noEmit 2>&1 | head -30
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/keape/Documents/budget365
git add budget365iOS/src/screens/SavingsScreen.tsx
git commit -m "feat(savings): rewrite portfolio footer with three-row summary"
```

---

### Task 5: Visual verification in simulator

- [ ] **Step 1: Start Metro bundler** (if not already running)

```bash
(cd /Users/keape/Documents/budget365/budget365iOS && node start-metro.js 2>&1 | tee /tmp/metro_v2.log &)
```
Poll until ready:
```bash
curl -s http://localhost:8081/status
```
Expected: `packager-status:running`

- [ ] **Step 2: Build and launch in simulator**

Use XcodeBuildMCP:
1. `session_set_defaults`: workspace=`ios/Budget365.xcworkspace`, scheme=`Budget365`, simulatorId=`C9EE30F5-94BF-4BBA-80B8-7C2A25429CBE`
2. `boot_sim`
3. `build_run_sim`

- [ ] **Step 3: Navigate to Portfolio tab and take screenshot**

Navigate: Savings → Portfolio tab.
Take screenshot via `mcp__XcodeBuildMCP__screenshot`.

Verify:
- Each instrument row shows "Invested", "Curr. value", "Return" sub-rows (when price is available)
- Instruments without a current price show only "Invested"
- Return values are green (positive) or red (negative)
- Footer shows "Total invested", "Total curr. value", "Total return" (three rows)
- "Total curr. value" and "Total return" rows are hidden when no instrument has a price

- [ ] **Step 4: Verify dark mode**

Toggle dark mode in Settings, return to Portfolio tab, take screenshot.
Verify labels and values are readable in dark mode.
