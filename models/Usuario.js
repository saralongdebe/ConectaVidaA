const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  city: { type: String, required: true },
  phone: { type: String, required: true },
  userType: { type: String, enum: ['solicitante', 'voluntario'], required: true, default: 'solicitante' },
  tipo: { type: String, enum: ['ONG', 'pessoa_comum'], default: 'pessoa_comum' },
  nomeInstituicao: { type: String, default: '' },
  cnpj: { type: String, default: '' },
  nomeResponsavel: { type: String, default: '' },
  telefoneInstituicao: { type: String, default: '' },
  bairroAtuacao: { type: String, default: '' },
  photo: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  resetToken: { type: String, default: null },
  resetTokenExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
