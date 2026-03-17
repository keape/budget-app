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

    // Query MongoDB for cached results
    const cached = await Instrument.find({
      $or: [
        { ticker: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ]
    }).limit(10);

    // Use cache if we have >=3 results and all are fresh
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
      return res.json({ success: true, data: results });
    } catch (yahooErr) {
      console.error('Yahoo Finance search error, returning cached results:', yahooErr.message);
      return res.json({ success: true, data: cached });
    }
  } catch (err) {
    console.error('Error in instruments search:', err);
    res.status(500).json({ success: false, error: 'Error searching instruments' });
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
