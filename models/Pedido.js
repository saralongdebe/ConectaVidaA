const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  city: { type: String, required: true },
  approximateLocation: { type: String, default: '' },
  requestDate: { type: String, default: '' },
  requestTime: { type: String, default: '' },
  phone: { type: String, required: true },
  additionalInfo: { type: String, default: '' },
  photo: { type: String, default: '' },
  status: { type: String, default: 'aberto' },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  helper: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rating: { type: Number, min: 1, max: 5, default: null },
  ratingComment: { type: String, default: '' },
  ehParaTerceiro: { type: Boolean, default: false },
  idOngSolicitante: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  nomeBeneficiarioFinal: { type: String, default: '' },
  idadeBeneficiarioFinal: { type: Number, min: 0, default: null },
  enderecoBeneficiarioFinal: { type: String, default: '' },
  telefoneBeneficiarioFinal: { type: String, default: '' },
  descricaoSituacaoBeneficiario: { type: String, default: '' },
  autorizacaoLgpd: { type: Boolean, default: false },
  temAcessoInternet: { type: Boolean, default: true }
});

module.exports = mongoose.model('Request', requestSchema);
