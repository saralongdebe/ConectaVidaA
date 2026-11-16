
const mongoose = require('mongoose');

async function conectarBancoDados() {
  try {
    const MONGO_URI = process.env.MONGO_URI;

    if (!MONGO_URI) {
      throw new Error('A variável MONGO_URI não foi configurada.');
    }

    await mongoose.connect(MONGO_URI);

    console.log('MongoDB conectado com sucesso!');
    console.log('Banco de dados:', mongoose.connection.name);

  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error.message);
    throw error;
  }
}

module.exports = conectarBancoDados;
