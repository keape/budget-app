const express = require('express');
const Instrument = require('../models/Instrument');
const router = express.Router();

const YAHOO_USER_AGENT = 'Mozilla/5.0 (compatible)';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isStale(lastUpdated) {
  if (!lastUpdated) return true;
  return Date.now() - new Date(lastUpdated).getTime() > CACHE_TTL_MS;
}

function mapQuoteType(quoteType) {
  switch (quoteType) {
    case 'EQUITY': return 'azioni';
    case 'ETF':
    case 'MUTUALFUND': return 'etf_fondi';
    case 'BOND': return 'obbligazioni';
    default: return 'altro';
  }
}

// GET /api/instruments/search?q=
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ success: true, data: [] });
    }

    // Enforce max query length to prevent ReDoS
    if (q.length > 50) {
      return res.status(400).json({ success: false, error: 'Query too long' });
    }

    // Escape regex metacharacters to prevent ReDoS
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Query MongoDB for cached results
    const cached = await Instrument.find({
      $or: [
        { ticker: { $regex: escapedQ, $options: 'i' } },
        { name: { $regex: escapedQ, $options: 'i' } }
      ]
    }).limit(10);

    // Require at least 3 cached results to avoid serving a too-sparse local cache
    // (e.g. a DB with only 1-2 seeded instruments should still hit Yahoo for richer results)
    const allFresh = cached.length >= 3 && cached.every(inst => !isStale(inst.lastUpdated));
    if (allFresh) {
      return res.json({ success: true, data: cached });
    }

    // Fetch from Yahoo Finance
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
      const response = await fetch(url, {
        headers: { 'User-Agent': YAHOO_USER_AGENT }
      });
      const json = await response.json();
      const quotes = (json.quotes || []);

      const upsertPromises = quotes.map(async (quote) => {
        const ticker = quote.symbol;
        if (!ticker) return null;

        const mappedData = {
          ticker: ticker.toUpperCase(),
          name: quote.longname || quote.shortname || ticker,
          type: mapQuoteType(quote.quoteType),
          currency: quote.currency,
          exchange: quote.exchange,
          country: quote.country || '',
          lastUpdated: new Date()
        };

        if (quote.regularMarketPrice != null) {
          mappedData.lastPrice = quote.regularMarketPrice;
        }

        return Instrument.findOneAndUpdate(
          { ticker: ticker.toUpperCase() },
          { $set: mappedData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      });

      const results = (await Promise.all(upsertPromises)).filter(Boolean);

      // Merge cached and Yahoo results, deduplicating by ticker
      const allTickers = new Set();
      const combined = [];
      for (const inst of [...results, ...cached]) {
        if (inst && !allTickers.has(inst.ticker)) {
          allTickers.add(inst.ticker);
          combined.push(inst);
        }
      }
      return res.json({ success: true, data: combined });
    } catch (yahooErr) {
      console.error('Yahoo Finance search error, returning cached results:', yahooErr.message);
      return res.json({ success: true, data: cached });
    }
  } catch (err) {
    console.error('Error in instruments search:', err);
    res.status(500).json({ success: false, error: 'Error searching instruments' });
  }
});

// GET /api/instruments/:ticker/price
// Always returns a fresh price (cache TTL: 15 min). Fetches from Yahoo Finance if stale/missing.
const PRICE_CACHE_TTL_MS = 15 * 60 * 1000;

function isPriceStale(instrument) {
  if (instrument.lastPrice == null) return true;
  if (!instrument.priceUpdatedAt) return true;
  return Date.now() - new Date(instrument.priceUpdatedAt).getTime() > PRICE_CACHE_TTL_MS;
}

router.get('/:ticker/price', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const instrument = await Instrument.findOne({ ticker });

    if (!instrument) {
      return res.status(404).json({ success: false, error: 'Instrument not found' });
    }

    if (!isPriceStale(instrument)) {
      return res.json({ success: true, data: { price: instrument.lastPrice, currency: instrument.currency } });
    }

    // Fetch fresh price from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`;
    const response = await fetch(url, { headers: { 'User-Agent': YAHOO_USER_AGENT } });
    const json = await response.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const currency = meta?.currency;

    if (price != null) {
      instrument.lastPrice = price;
      instrument.priceUpdatedAt = new Date();
      if (currency) instrument.currency = currency;
      await instrument.save();
      return res.json({ success: true, data: { price, currency } });
    }

    // Return stale price if available
    if (instrument.lastPrice != null) {
      return res.json({ success: true, data: { price: instrument.lastPrice, currency: instrument.currency } });
    }

    return res.status(404).json({ success: false, error: 'Price not available for this instrument' });
  } catch (err) {
    console.error('Error fetching instrument price:', err);
    res.status(500).json({ success: false, error: 'Error fetching price' });
  }
});

// GET /api/instruments/:ticker
router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const instrument = await Instrument.findOne({ ticker });

    if (!instrument) {
      return res.status(404).json({ success: false, error: 'Instrument not found' });
    }

    // Refresh price if stale
    if (isStale(instrument.lastUpdated)) {
      try {
        const url = `https://query8.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`;
        const response = await fetch(url, {
          headers: { 'User-Agent': YAHOO_USER_AGENT }
        });
        const json = await response.json();
        const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price != null) {
          instrument.lastPrice = price;
          instrument.lastUpdated = new Date();
          await instrument.save();
        }
      } catch (yahooErr) {
        console.error('Yahoo Finance price fetch error:', yahooErr.message);
        // Return stale data without error
      }
    }

    return res.json({ success: true, data: instrument });
  } catch (err) {
    console.error('Error fetching instrument:', err);
    res.status(500).json({ success: false, error: 'Error fetching instrument' });
  }
});

module.exports = router;
