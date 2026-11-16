const test = require('node:test');
const assert = require('node:assert/strict');
const { filtrarPedidos, marcarNotificacaoComoLida, criarConversa, obterConversasDoUsuario, enviarMensagem } = require('../estadoAplicativo');
const Usuario = require('../models/Usuario');

test('filtra pedidos por texto e cidade', () => {
  const requests = [
    { id: '1', title: 'Ajuda com supermercado', city: 'São Paulo', category: 'Alimentação', description: 'Preciso buscar mantimentos' },
    { id: '2', title: 'Transporte para consulta', city: 'Campinas', category: 'Saúde', description: 'Preciso de transporte' }
  ];

  const result = filtrarPedidos(requests, 'supermercado');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('não expõe pedidos concluídos na lista disponível para ajudantes', () => {
  const requests = [
    { id: '1', title: 'Ajuda com mercado', status: 'aberto', city: 'São Paulo', category: 'Alimentação', description: 'Preciso comprar mantimentos' },
    { id: '2', title: 'Entrega de remédio', status: 'concluido', city: 'Campinas', category: 'Saúde', description: 'Pedido finalizado' }
  ];

  const result = filtrarPedidos(requests, '');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('marca uma notificação como lida', () => {
  const notifications = [
    { id: 'n1', title: 'Novo pedido', read: false },
    { id: 'n2', title: 'Voluntário aceito', read: false }
  ];

  const result = marcarNotificacaoComoLida(notifications, 'n1');
  assert.equal(result[0].read, true);
  assert.equal(result[1].read, false);
});

test('cria e envia uma conversa entre solicitante e ajudante', () => {
  const requester = { _id: 'user-1', name: 'Maria' };
  const helper = { _id: 'user-2', name: 'João' };

  const thread = criarConversa('request-abc', requester, helper);
  assert.equal(thread.requestId, 'request-abc');
  assert.equal(thread.requesterId, 'user-1');
  assert.equal(thread.helperId, 'user-2');

  const saved = enviarMensagem('request-abc', 'user-1', 'Maria', 'Bom dia, consigo receber ajuda?');
  assert.equal(saved.messages.length, 1);

  const threadsForRequester = obterConversasDoUsuario('user-1');
  assert.equal(threadsForRequester.length, 1);
});

test('usuário sem tipo definido usa solicitante como padrão', () => {
  const user = new Usuario({
    name: 'Ana',
    email: 'ana@email.com',
    password: 'senha123',
    city: 'São Paulo',
    phone: '11999999999'
  });

  assert.equal(user.userType, 'solicitante');
});
