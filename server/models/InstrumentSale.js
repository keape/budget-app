const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InstrumentSaleSchema = new Schema(
  {
    userId:         { type: Schema.Types.ObjectId, ref: 'User',         required: true },
    savingsMonthId: { type: Schema.Types.ObjectId, ref: 'SavingsMonth', required: true },
    instrumentId:   { type: Schema.Types.ObjectId, ref: 'Instrument',   required: true },
    quantity:       { type: Number, required: true, min: 0 },
    priceAtSale:    { type: Number, required: true, min: 0 },
    proceeds:       { type: Number, required: true },   // quantity × priceAtSale
    costBasis:      { type: Number, required: true },   // quantity × avgCostPCM
    capitalGain:    { type: Number, required: true },   // proceeds − costBasis
  },
  { timestamps: true },
);

InstrumentSaleSchema.index({ userId: 1, savingsMonthId: 1 });
InstrumentSaleSchema.index({ userId: 1, instrumentId: 1 });

module.exports = mongoose.model('InstrumentSale', InstrumentSaleSchema);
