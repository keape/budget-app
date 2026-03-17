const mongoose = require('mongoose');

const allocationPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  allocations: [
    {
      _id: false,
      instrumentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Instrument',
        required: true
      },
      targetPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      }
    }
  ]
});

module.exports = mongoose.model('AllocationPlan', allocationPlanSchema);
