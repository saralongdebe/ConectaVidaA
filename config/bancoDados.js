const mongoose = require('mongoose');

async function conectarBancoDados() {
  try {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!MONGO_URI) {
      throw new Error('Nenhuma variável de ambiente de conexão com MongoDB foi configurada. Defina MONGO_URI ou MONGODB_URI.');
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10000
      });
    }

    console.log('MongoDB conectado com sucesso!');
    console.log('Banco de dados:', mongoose.connection.name);
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error.message);
    throw error;
  }
}

module.exports = conectarBancoDados;
