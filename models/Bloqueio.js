const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  helper: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  reason: {
    type: String,
    enum: ['Violação de regras', 'Falta de educação', 'Pedido falso'],
    required: true
  },
  status: { type: String, enum: ['pendente', 'analisado'], default: 'pendente' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Block', blockSchema);
