const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = Number(process.env.PORT || 3000);
const ENDERECO = process.env.HOST || '0.0.0.0';

const tiposMime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const redirecionamentosLegados = {
  '/notifications.html': '/notificacoes.html',
  '/dashboard.html': '/painel.html',
  '/feed.html': '/mural.html',
  '/login.html': '/entrar.html',
  '/chat.html': '/conversas.html'
};

function servirArquivo(resposta, caminhoArquivo) {
  const caminhoCompleto = path.join(__dirname, caminhoArquivo);
  fs.readFile(caminhoCompleto, (erro, dados) => {
    if (erro) {
      resposta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      resposta.end('Arquivo não encontrado');
      return;
    }

    const extensao = path.extname(caminhoCompleto);
    const tipoConteudo = tiposMime[extensao] || 'application/octet-stream';
    resposta.writeHead(200, { 'Content-Type': tipoConteudo });
    resposta.end(dados);
  });
}

const servidor = http.createServer((requisicao, resposta) => {
  const urlSolicitada = new URL(requisicao.url, 'http://localhost');
  const caminhoSolicitado = urlSolicitada.pathname;
  const caminhoLegado = redirecionamentosLegados[caminhoSolicitado];

  if (caminhoLegado) {
    resposta.writeHead(301, { Location: `${caminhoLegado}${urlSolicitada.search}` });
    resposta.end();
    return;
  }

  const enderecoSolicitado = caminhoSolicitado === '/' ? '/index.html' : caminhoSolicitado;

  if (enderecoSolicitado.includes('..')) {
    resposta.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    resposta.end('Caminho inválido');
    return;
  }

  if (enderecoSolicitado.startsWith('/public/')) {
    servirArquivo(resposta, enderecoSolicitado);
    return;
  }

  if (enderecoSolicitado.endsWith('.html')) {
    servirArquivo(resposta, enderecoSolicitado);
    return;
  }

  servirArquivo(resposta, enderecoSolicitado);
});

servidor.listen(PORTA, ENDERECO, () => {
  console.log(`Servidor rodando em http://${ENDERECO}:${PORTA}`);
});
