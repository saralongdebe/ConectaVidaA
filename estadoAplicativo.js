const notificacoes = [
  { id: 'n1', title: 'Pedido recebido', message: 'Seu pedido foi publicado com sucesso.', read: false },
  { id: 'n2', title: 'Nova mensagem', message: 'A equipe respondeu ao seu pedido.', read: false }
];

const conversasChat = [
  { contact: 'Equipe', lastMessage: 'Olá! Como podemos ajudar hoje?' }
];

const conversasDePedidos = [];

function filtrarPedidos(pedidos, busca = '') {
  const pedidosVisiveis = pedidos.filter((pedido) => {
    const situacao = (pedido.status || '').toLowerCase();
    return situacao !== 'concluido' && situacao !== 'concluída';
  });

  if (!busca) return pedidosVisiveis;
  const buscaNormalizada = busca.toLowerCase().trim();
  return pedidosVisiveis.filter((pedido) => {
    const textoPesquisavel = `${pedido.title} ${pedido.description} ${pedido.city} ${pedido.category}`.toLowerCase();
    return textoPesquisavel.includes(buscaNormalizada);
  });
}

function obterNotificacoes() {
  return notificacoes;
}

function marcarNotificacaoComoLida(listaDeNotificacoes, idNotificacao) {
  return listaDeNotificacoes.map((notificacao) =>
    notificacao.id === idNotificacao ? { ...notificacao, read: true } : notificacao
  );
}

function obterConversas() {
  return conversasChat;
}

function criarConversa(idPedido, solicitante, ajudante) {
  const conversaExistente = buscarConversaDoPedido(idPedido);
  if (conversaExistente) {
    return conversaExistente;
  }

  const conversa = {
    id: `${idPedido}-${Date.now()}-${Math.round(Math.random() * 10_000)}`,
    requestId: idPedido,
    requesterId: solicitante && solicitante._id ? String(solicitante._id) : solicitante,
    requesterName: solicitante && solicitante.name ? solicitante.name : 'Solicitante',
    helperId: ajudante && ajudante._id ? String(ajudante._id) : ajudante,
    helperName: ajudante && ajudante.name ? ajudante.name : 'Ajudante',
    createdAt: new Date().toISOString(),
    messages: []
  };

  conversasDePedidos.push(conversa);
  return conversa;
}

function buscarConversaDoPedido(idPedido) {
  return conversasDePedidos.find((conversa) => String(conversa.requestId) === String(idPedido));
}

function obterConversasDoUsuario(idUsuario) {
  const idNormalizado = String(idUsuario);
  return conversasDePedidos.filter((conversa) =>
    String(conversa.requesterId) === idNormalizado || String(conversa.helperId) === idNormalizado
  );
}

function enviarMensagem(idPedidoOuContato, idRemetenteOuMensagem, nomeRemetente, mensagem) {
  if (typeof nomeRemetente === 'string' && typeof mensagem === 'string') {
    const conversa = buscarConversaDoPedido(idPedidoOuContato);

    if (!conversa) {
      return { id: idPedidoOuContato, messages: [] };
    }

    const dadosMensagem = {
      id: `${Date.now()}-${Math.round(Math.random() * 10_000)}`,
      requestId: String(idPedidoOuContato),
      senderId: String(idRemetenteOuMensagem),
      senderName: nomeRemetente,
      content: mensagem,
      createdAt: new Date().toISOString()
    };

    conversa.messages.push(dadosMensagem);
    conversasChat.unshift({ contact: nomeRemetente || 'Conversa', lastMessage: mensagem });

    return conversa;
  }

  const contato = idPedidoOuContato;
  const texto = idRemetenteOuMensagem;
  conversasChat.unshift({ contact: contato, lastMessage: texto });
  return conversasChat;
}

module.exports = {
  filtrarPedidos,
  obterNotificacoes,
  marcarNotificacaoComoLida,
  obterConversas,
  enviarMensagem,
  criarConversa,
  buscarConversaDoPedido,
  obterConversasDoUsuario
};
