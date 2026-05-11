const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');
const SavingsMonth = require('../models/SavingsMonth');
const InstrumentAllocation = require('../models/InstrumentAllocation');
const InstrumentSale = require('../models/InstrumentSale');
const AllocationPlan = require('../models/AllocationPlan');
const Entrata = require('../models/Entrata');
const Spesa = require('../models/Spesa');
const router = express.Router();

// GET /api/savings/months
router.get('/months', authenticateToken, async (req, res) => {
  try {
    const months = await SavingsMonth.find({ userId: req.user.userId }).sort({ anno: -1, mese: -1 });
    return res.json({ success: true, data: months });
  } catch (err) {
    console.error('Error fetching savings months:', err);
    res.status(500).json({ success: false, error: 'Error fetching savings months' });
  }
});

// POST /api/savings/ensure-month
// Creates (or updates) a SavingsMonth for any given past month by computing income/expenses from transactions.
router.post('/ensure-month', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { anno, mese } = req.body;

    if (anno == null || mese == null) {
      return res.status(400).json({ success: false, error: 'anno and mese are required' });
    }

    const targetAnno = parseInt(anno, 10);
    const targetMese = parseInt(mese, 10);

    // Don't allow current or future months
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    if (targetAnno > currentYear || (targetAnno === currentYear && targetMese >= currentMonth)) {
      return res.status(400).json({ success: false, error: 'Cannot ensure a current or future month' });
    }

    // Compute income and expenses from transactions
    const startDate = new Date(targetAnno, targetMese, 1);
    const endDate = new Date(targetAnno, targetMese + 1, 1);

    const entrate = await Entrata.find({ userId, data: { $gte: startDate, $lt: endDate } });
    const income = entrate.reduce((sum, e) => sum + e.importo, 0);

    const spese = await Spesa.find({ userId, data: { $gte: startDate, $lt: endDate } });
    const expenses = spese.reduce((sum, s) => sum + Math.abs(s.importo), 0);

    const savings = income - expenses;

    // Always recompute and upsert — transactions may have changed since last run
    const existing = await SavingsMonth.findOne({ userId, anno: targetAnno, mese: targetMese });
    const savedMonth = await SavingsMonth.findOneAndUpdate(
      { userId, anno: targetAnno, mese: targetMese },
      { $set: { income, expenses, savings, status: 'closed', closedAt: existing ? existing.closedAt : new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return res.status(existing ? 200 : 201).json({ success: true, data: savedMonth, alreadyExists: !!existing });
  } catch (err) {
    console.error('Error in ensure-month:', err);
    res.status(500).json({ success: false, error: 'Error ensuring month' });
  }
});

// POST /api/savings/auto-close
router.post('/auto-close', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const prevMese = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevAnno = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    // Always recompute — transactions may have changed since last auto-close
    const existing = await SavingsMonth.findOne({ userId, anno: prevAnno, mese: prevMese });

    // Sum income
    const startDate = new Date(prevAnno, prevMese, 1);
    const endDate = new Date(prevAnno, prevMese + 1, 1);
    const entrate = await Entrata.find({ userId, data: { $gte: startDate, $lt: endDate } });
    const income = entrate.reduce((sum, e) => sum + e.importo, 0);

    // Sum expenses (importo is negative, use Math.abs)
    const spese = await Spesa.find({ userId, data: { $gte: startDate, $lt: endDate } });
    const expenses = spese.reduce((sum, s) => sum + Math.abs(s.importo), 0);

    const savings = income - expenses;

    // Upsert SavingsMonth — preserve original closedAt if already existed
    const savedMonth = await SavingsMonth.findOneAndUpdate(
      { userId, anno: prevAnno, mese: prevMese },
      { $set: { income, expenses, savings, status: 'closed', closedAt: existing ? existing.closedAt : new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const alreadyClosed = !!existing;

    // If savings < 0, find conto_corrente instrument in user's plan and record allocation
    if (savings < 0) {
      try {
        const plan = await AllocationPlan.findOne({ userId }).populate('allocations.instrumentId');
        if (plan) {
          const contoEntry = plan.allocations.find(
            a => a.instrumentId && a.instrumentId.type === 'conto_corrente'
          );
          if (contoEntry) {
            await InstrumentAllocation.create({
              userId,
              savingsMonthId: savedMonth._id,
              instrumentId: contoEntry.instrumentId._id,
              amount: savings // negative
            });
          }
        }
      } catch (planErr) {
        // Skip silently if no plan or no conto_corrente instrument
        console.warn('Could not auto-allocate negative savings to conto_corrente:', planErr.message);
      }
    }

    return res.json({ success: true, data: savedMonth, alreadyClosed });
  } catch (err) {
    console.error('Error in auto-close:', err);
    res.status(500).json({ success: false, error: 'Error closing month' });
  }
});

// GET /api/savings/months/:id/allocations
router.get('/months/:id/allocations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const month = await SavingsMonth.findOne({ _id: req.params.id, userId });
    if (!month) {
      return res.status(404).json({ success: false, error: 'Savings month not found' });
    }
    const allocations = await InstrumentAllocation.find({ userId, savingsMonthId: req.params.id }).populate('instrumentId');
    return res.json({ success: true, data: allocations });
  } catch (err) {
    console.error('Error fetching allocations:', err);
    res.status(500).json({ success: false, error: 'Error fetching allocations' });
  }
});

// POST /api/savings/months/:id/allocations
router.post('/months/:id/allocations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const id = req.params.id;
    const { instrumentId, amount, quantity, priceAtAllocation } = req.body;

    // Validate required fields
    if (!instrumentId || amount == null) {
      return res.status(400).json({ success: false, error: 'instrumentId and amount are required' });
    }

    const month = await SavingsMonth.findOne({ _id: id, userId });
    if (!month) {
      return res.status(404).json({ success: false, error: 'Savings month not found' });
    }

    const created = await InstrumentAllocation.create({
      userId,
      savingsMonthId: id,
      instrumentId,
      amount,
      quantity,
      priceAtAllocation
    });

    const allocation = await created.populate('instrumentId');
    return res.status(201).json({ success: true, data: allocation });
  } catch (err) {
    console.error('Error creating allocation:', err);
    res.status(500).json({ success: false, error: 'Error creating allocation' });
  }
});

// DELETE /api/savings/months/:id/allocations/:allId
router.delete('/months/:id/allocations/:allId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deleted = await InstrumentAllocation.findOneAndDelete({
      _id: req.params.allId,
      userId,
      savingsMonthId: req.params.id
    });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Allocation not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting allocation:', err);
    res.status(500).json({ success: false, error: 'Error deleting allocation' });
  }
});

// GET /api/savings/plan
router.get('/plan', authenticateToken, async (req, res) => {
  try {
    const plan = await AllocationPlan.findOne({ userId: req.user.userId }).populate('allocations.instrumentId');
    if (!plan) {
      return res.json({ success: true, data: null });
    }
    return res.json({ success: true, data: plan });
  } catch (err) {
    console.error('Error fetching allocation plan:', err);
    res.status(500).json({ success: false, error: 'Error fetching allocation plan' });
  }
});

// PUT /api/savings/plan
router.put('/plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { allocations } = req.body;

    if (!Array.isArray(allocations)) {
      return res.status(400).json({ success: false, error: 'allocations must be an array' });
    }

    for (const alloc of allocations) {
      if (alloc.targetPercentage == null || typeof alloc.targetPercentage !== 'number' || alloc.targetPercentage < 0 || alloc.targetPercentage > 100) {
        return res.status(400).json({ success: false, error: 'targetPercentage must be a number between 0 and 100' });
      }
      if (alloc.targetAmount != null && (typeof alloc.targetAmount !== 'number' || alloc.targetAmount < 0)) {
        return res.status(400).json({ success: false, error: 'targetAmount must be a non-negative number' });
      }
    }

    const total = allocations.reduce((sum, a) => sum + (a.targetPercentage || 0), 0);
    const warning = total < 100 ? `Total allocation is ${total}% (partial plan)` : undefined;

    const plan = await AllocationPlan.findOneAndUpdate(
      { userId },
      { $set: { allocations } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await plan.populate('allocations.instrumentId');

    const response = { success: true, data: plan };
    if (warning) response.warning = warning;
    return res.json(response);
  } catch (err) {
    console.error('Error updating allocation plan:', err);
    res.status(500).json({ success: false, error: 'Error updating allocation plan' });
  }
});

// PUT /api/savings/plan/monthly-target
// Body: { anno, mese, targetSavings }  — targetSavings: null removes the entry
router.put('/plan/monthly-target', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { anno, mese, targetSavings } = req.body;

    if (!Number.isInteger(anno) || !Number.isInteger(mese) || mese < 0 || mese > 11) {
      return res.status(400).json({ success: false, error: 'anno and mese (0–11) are required integers' });
    }
    if (targetSavings !== null && (typeof targetSavings !== 'number' || targetSavings < 0)) {
      return res.status(400).json({ success: false, error: 'targetSavings must be a non-negative number or null' });
    }

    let plan;
    if (targetSavings === null) {
      // Remove the entry for this month
      plan = await AllocationPlan.findOneAndUpdate(
        { userId },
        { $pull: { monthlyTargets: { anno, mese } } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      // Upsert: remove old entry then push new one (atomic via two ops)
      await AllocationPlan.findOneAndUpdate(
        { userId },
        { $pull: { monthlyTargets: { anno, mese } } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      plan = await AllocationPlan.findOneAndUpdate(
        { userId },
        { $push: { monthlyTargets: { anno, mese, targetSavings } } },
        { new: true }
      );
    }

    await plan.populate('allocations.instrumentId');
    return res.json({ success: true, data: plan });
  } catch (err) {
    console.error('Error updating monthly target:', err);
    res.status(500).json({ success: false, error: 'Error updating monthly target' });
  }
});

// GET /api/savings/year-summary?year=YYYY
router.get('/year-summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const year = parseInt(req.query.year, 10);
    if (!year) return res.status(400).json({ success: false, error: 'year is required' });

    const months = await SavingsMonth.find({ userId, anno: year });
    const totalSavings = months.reduce((s, m) => s + (m.savings || 0), 0);
    const totalIncome = months.reduce((s, m) => s + (m.income || 0), 0);
    const totalExpenses = months.reduce((s, m) => s + (m.expenses || 0), 0);
    const monthIds = months.map(m => m._id);

    const byInstrument = await InstrumentAllocation.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), savingsMonthId: { $in: monthIds } } },
      { $group: { _id: '$instrumentId', totalAmount: { $sum: '$amount' } } },
      { $lookup: { from: 'instruments', localField: '_id', foreignField: '_id', as: 'instrument' } },
      { $unwind: '$instrument' },
    ]);

    return res.json({
      success: true,
      data: {
        totalSavings,
        totalIncome,
        totalExpenses,
        monthCount: months.length,
        byInstrument: byInstrument.map(b => ({
          instrumentId: b._id,
          instrument: b.instrument,
          totalAmount: b.totalAmount,
        })),
      },
    });
  } catch (err) {
    console.error('Error fetching year summary:', err);
    res.status(500).json({ success: false, error: 'Error fetching year summary' });
  }
});

// GET /api/savings/months/:id/sales
router.get('/months/:id/sales', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const month = await SavingsMonth.findOne({ _id: req.params.id, userId });
    if (!month) {
      return res.status(404).json({ success: false, error: 'Savings month not found' });
    }
    const sales = await InstrumentSale.find({ userId, savingsMonthId: req.params.id })
      .populate('instrumentId')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: sales });
  } catch (err) {
    console.error('Error fetching sales:', err);
    res.status(500).json({ success: false, error: 'Error fetching sales' });
  }
});

// POST /api/savings/months/:id/sales
router.post('/months/:id/sales', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { instrumentId, quantity, priceAtSale } = req.body;

    if (!instrumentId || quantity == null || priceAtSale == null) {
      return res.status(400).json({ success: false, error: 'instrumentId, quantity and priceAtSale are required' });
    }
    if (quantity <= 0 || priceAtSale <= 0) {
      return res.status(400).json({ success: false, error: 'quantity and priceAtSale must be positive' });
    }

    const month = await SavingsMonth.findOne({ _id: req.params.id, userId });
    if (!month) {
      return res.status(404).json({ success: false, error: 'Savings month not found' });
    }

    const instObjId = new mongoose.Types.ObjectId(instrumentId);
    const userObjId = new mongoose.Types.ObjectId(userId);

    // PCM: compute total bought and total already sold for this instrument
    const [boughtAgg] = await InstrumentAllocation.aggregate([
      { $match: { userId: userObjId, instrumentId: instObjId } },
      { $group: { _id: null, totalQty: { $sum: { $ifNull: ['$quantity', 0] } }, totalAmt: { $sum: '$amount' } } },
    ]);
    const [soldAgg] = await InstrumentSale.aggregate([
      { $match: { userId: userObjId, instrumentId: instObjId } },
      { $group: { _id: null, totalQty: { $sum: '$quantity' } } },
    ]);

    const totalQtyBought = boughtAgg?.totalQty ?? 0;
    const totalAmtBought = boughtAgg?.totalAmt ?? 0;
    const totalQtySold   = soldAgg?.totalQty ?? 0;
    const currentQty     = totalQtyBought - totalQtySold;

    if (quantity > currentQty + 1e-9) {
      return res.status(400).json({ success: false, error: `Quantità insufficiente. Disponibile: ${currentQty}` });
    }

    const avgCostPerShare = totalQtyBought > 0 ? totalAmtBought / totalQtyBought : 0;
    const proceeds    = quantity * priceAtSale;
    const costBasis   = quantity * avgCostPerShare;
    const capitalGain = proceeds - costBasis;

    const created = await InstrumentSale.create({
      userId,
      savingsMonthId: req.params.id,
      instrumentId,
      quantity,
      priceAtSale,
      proceeds,
      costBasis,
      capitalGain,
    });
    const sale = await created.populate('instrumentId');
    return res.status(201).json({ success: true, data: sale });
  } catch (err) {
    console.error('Error creating sale:', err);
    res.status(500).json({ success: false, error: 'Error creating sale' });
  }
});

// DELETE /api/savings/months/:id/sales/:saleId
router.delete('/months/:id/sales/:saleId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deleted = await InstrumentSale.findOneAndDelete({
      _id: req.params.saleId,
      userId,
      savingsMonthId: req.params.id,
    });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Sale not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting sale:', err);
    res.status(500).json({ success: false, error: 'Error deleting sale' });
  }
});

// GET /api/savings/portfolio?anno=&mese=
router.get('/portfolio', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { anno, mese } = req.query;
    const userObjId = new mongoose.Types.ObjectId(userId);

    let monthIds = null;

    if (anno != null && mese != null) {
      const targetAnno = Number(anno);
      const targetMese = Number(mese);
      const months = await SavingsMonth.find({
        userId,
        $or: [
          { anno: { $lt: targetAnno } },
          { anno: targetAnno, mese: { $lte: targetMese } },
        ],
      }).select('_id');
      if (months.length === 0) {
        return res.json({ success: true, data: [] });
      }
      monthIds = months.map(m => m._id);
    }

    const buyMatchStage = { userId: userObjId };
    if (monthIds) buyMatchStage.savingsMonthId = { $in: monthIds };

    const sellMatchStage = { userId: userObjId };
    if (monthIds) sellMatchStage.savingsMonthId = { $in: monthIds };

    const [buyResults, sellResults] = await Promise.all([
      InstrumentAllocation.aggregate([
        { $match: buyMatchStage },
        {
          $group: {
            _id: '$instrumentId',
            totalAmount:   { $sum: '$amount' },
            totalQuantity: { $sum: { $ifNull: ['$quantity', 0] } },
          },
        },
        { $lookup: { from: 'instruments', localField: '_id', foreignField: '_id', as: 'instrument' } },
        { $unwind: '$instrument' },
      ]),
      InstrumentSale.aggregate([
        { $match: sellMatchStage },
        {
          $group: {
            _id:                '$instrumentId',
            totalQuantitySold:  { $sum: '$quantity' },
            totalRealizedGain:  { $sum: '$capitalGain' },
          },
        },
      ]),
    ]);

    const sellMap = new Map(sellResults.map(s => [s._id.toString(), s]));

    const data = buyResults.map(r => {
      const sell = sellMap.get(r._id.toString());
      const totalQuantitySold  = sell?.totalQuantitySold ?? 0;
      const realizedGain       = sell?.totalRealizedGain ?? 0;
      const currentQuantity    = r.totalQuantity - totalQuantitySold;
      const avgCostPerShare    = r.totalQuantity > 0 ? r.totalAmount / r.totalQuantity : 0;
      const remainingCostBasis = currentQuantity * avgCostPerShare;

      let estimatedCurrentValue = null;
      let unrealizedGain = null;
      if (currentQuantity > 0 && r.instrument.lastPrice != null) {
        estimatedCurrentValue = currentQuantity * r.instrument.lastPrice;
        unrealizedGain = estimatedCurrentValue - remainingCostBasis;
      }

      return {
        instrument:          r.instrument,
        totalAmount:         r.totalAmount,
        totalQuantity:       r.totalQuantity,
        totalQuantitySold,
        currentQuantity,
        remainingCostBasis,
        estimatedCurrentValue,
        unrealizedGain,
        realizedGain,
      };
    }).filter(item => item.currentQuantity > 1e-9 || item.realizedGain !== 0);

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    res.status(500).json({ success: false, error: 'Error fetching portfolio' });
  }
});

module.exports = router;
