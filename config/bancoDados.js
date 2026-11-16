const mongoose = require('mongoose');

async function conectarBancoDados() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/conectavida');
    console.log('MongoDB conectado com sucesso');
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error.message);
  }
}

module.exports = conectarBancoDados;
