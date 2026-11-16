const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Pedido = require('../models/Pedido');
const Usuario = require('../models/Usuario');
const Bloqueio = require('../models/Bloqueio');
const exigirAutenticacao = require('../middleware/autenticacao');
const { filtrarPedidos, criarConversa, buscarConversaDoPedido } = require('../estadoAplicativo');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${Math.round(Math.random() * 100000)}${extension}`);
    }
  }),
  fileFilter: (req, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/pedir-ajuda', exigirAutenticacao, (req, res) => {
  if (req.session.user.userType !== 'solicitante') {
    return res.redirect('/dashboard');
  }

  res.render('novoPedido', {
    user: req.session.user,
    error: null,
    posted: req.query.posted === '1',
    request: null,
    editing: false,
    currentPage: 'novo-pedido'
  });
});

router.get('/meus-pedidos', exigirAutenticacao, async (req, res) => {
  if (req.session.user.userType !== 'solicitante') {
    return res.redirect('/dashboard');
  }

  const requestDocs = await Pedido.find({ user: req.session.user._id }).populate('helper').sort({ createdAt: -1 });
  const requests = requestDocs.map((request) => (request.toObject ? request.toObject() : request));

  res.render('meusPedidos', {
    user: req.session.user,
    requests,
    edited: req.query.edited === '1',
    currentPage: 'meus-pedidos'
  });
});

router.get('/ajudar', exigirAutenticacao, async (req, res) => {
  if (req.session.user.userType !== 'voluntario') {
    return res.redirect('/dashboard');
  }

  const searchQuery = req.query.q || '';
  const blockedUsers = await Bloqueio.find({ helper: req.session.user._id, status: { $in: ['pendente', 'analisado'] } }).distinct('requester');
  const requestDocs = await Pedido.find({ status: 'aberto', user: { $nin: blockedUsers } }).populate('user').sort({ createdAt: -1 });
  const requests = requestDocs.map((request) => (request.toObject ? request.toObject() : request));
  const filteredRequests = filtrarPedidos(requests, searchQuery);

  const acceptedRequestDocs = await Pedido.find({ helper: req.session.user._id }).populate('user').sort({ createdAt: -1 });
  const acceptedRequests = acceptedRequestDocs.map((request) => (request.toObject ? request.toObject() : request));

  res.render('ajudar', {
    user: req.session.user || null,
    requests: filteredRequests,
    acceptedRequests,
    searchQuery,
    currentPage: 'ajudar'
  });
});

router.get('/relatorio', exigirAutenticacao, async (req, res) => {
  if (req.session.user.userType !== 'voluntario') {
    return res.redirect('/dashboard');
  }

  const query = { helper: req.session.user._id };
  const requestDocs = await Pedido.find(query).populate('user helper').sort({ createdAt: -1 });
  const requests = requestDocs.map((request) => (request.toObject ? request.toObject() : request));
  res.render('relatorio', { user: req.session.user, requests, currentPage: 'relatorio' });
});

router.get('/pedido/:id/editar', exigirAutenticacao, async (req, res) => {
  if (req.session.user.userType !== 'solicitante') return res.redirect('/dashboard');
  const request = await Pedido.findOne({ _id: req.params.id, user: req.session.user._id });
  if (!request) return res.redirect('/meus-pedidos');

  res.render('novoPedido', {
    user: req.session.user,
    error: null,
    posted: false,
    request,
    editing: true,
    currentPage: 'meus-pedidos'
  });
});

router.post('/novo-pedido', exigirAutenticacao, upload.single('photo'), async (req, res) => {
  try {
    if (req.session.user.userType !== 'solicitante') {
      return res.render('novoPedido', {
        user: req.session.user,
        error: 'Somente pessoas que precisam de ajuda podem publicar pedidos.',
        currentPage: 'novo-pedido'
      });
    }

    const isOng = req.session.user.tipo === 'ONG';
    const ehParaTerceiro = isOng && req.body.ehParaTerceiro === 'true';
    if (ehParaTerceiro && (!req.body.nomeBeneficiarioFinal || req.body.autorizacaoLgpd !== 'on')) {
      return res.render('novoPedido', {
        user: req.session.user,
        error: 'Informe o nome da pessoa e confirme a autorização da ONG para continuar.',
        posted: false,
        request: req.body,
        editing: false,
        currentPage: 'novo-pedido'
      });
    }

    const request = new Pedido({
      title: req.body.title,
      category: req.body.category,
      description: req.body.description,
      city: req.body.city,
      approximateLocation: req.body.approximateLocation || '',
      requestDate: req.body.requestDate || '',
      requestTime: req.body.requestTime || '',
      phone: ehParaTerceiro ? (req.body.telefoneBeneficiarioFinal || req.session.user.telefoneInstituicao || req.session.user.phone) : req.body.phone,
      additionalInfo: req.body.additionalInfo || '',
      photo: req.file ? `/uploads/${req.file.filename}` : '',
      user: req.session.user._id,
      ehParaTerceiro,
      idOngSolicitante: ehParaTerceiro ? req.session.user._id : null,
      nomeBeneficiarioFinal: ehParaTerceiro ? req.body.nomeBeneficiarioFinal : '',
      idadeBeneficiarioFinal: ehParaTerceiro && req.body.idadeBeneficiarioFinal ? Number(req.body.idadeBeneficiarioFinal) : null,
      enderecoBeneficiarioFinal: ehParaTerceiro ? req.body.enderecoBeneficiarioFinal || '' : '',
      telefoneBeneficiarioFinal: ehParaTerceiro ? req.body.telefoneBeneficiarioFinal || '' : '',
      descricaoSituacaoBeneficiario: ehParaTerceiro ? req.body.descricaoSituacaoBeneficiario || '' : '',
      autorizacaoLgpd: ehParaTerceiro,
      temAcessoInternet: !ehParaTerceiro || req.body.temAcessoInternet !== 'nao'
    });

    await request.save();
    res.redirect('/pedir-ajuda?posted=1');
  } catch (error) {
    res.render('novoPedido', { user: req.session.user, error: 'Erro ao criar pedido.', currentPage: 'novo-pedido' });
  }
});

router.post('/pedido/:id/editar', exigirAutenticacao, upload.single('photo'), async (req, res) => {
  try {
    if (req.session.user.userType !== 'solicitante') return res.redirect('/dashboard');
    const request = await Pedido.findOne({ _id: req.params.id, user: req.session.user._id });
    if (!request) return res.redirect('/meus-pedidos');

    request.title = req.body.title;
    request.category = req.body.category;
    request.description = req.body.description;
    request.city = req.body.city;
    request.approximateLocation = req.body.approximateLocation || '';
    request.requestDate = req.body.requestDate || '';
    request.requestTime = req.body.requestTime || '';
    request.phone = req.body.phone;
    request.additionalInfo = req.body.additionalInfo || '';
    if (req.file) request.photo = `/uploads/${req.file.filename}`;
    if (req.session.user.tipo === 'ONG') {
      const ehParaTerceiro = req.body.ehParaTerceiro === 'true';
      if (ehParaTerceiro && (!req.body.nomeBeneficiarioFinal || req.body.autorizacaoLgpd !== 'on')) {
        return res.redirect(`/pedido/${req.params.id}/editar`);
      }
      request.ehParaTerceiro = ehParaTerceiro;
      request.idOngSolicitante = ehParaTerceiro ? req.session.user._id : null;
      request.nomeBeneficiarioFinal = ehParaTerceiro ? req.body.nomeBeneficiarioFinal : '';
      request.idadeBeneficiarioFinal = ehParaTerceiro && req.body.idadeBeneficiarioFinal ? Number(req.body.idadeBeneficiarioFinal) : null;
      request.enderecoBeneficiarioFinal = ehParaTerceiro ? req.body.enderecoBeneficiarioFinal || '' : '';
      request.telefoneBeneficiarioFinal = ehParaTerceiro ? req.body.telefoneBeneficiarioFinal || '' : '';
      request.descricaoSituacaoBeneficiario = ehParaTerceiro ? req.body.descricaoSituacaoBeneficiario || '' : '';
      request.autorizacaoLgpd = ehParaTerceiro;
      request.temAcessoInternet = !ehParaTerceiro || req.body.temAcessoInternet !== 'nao';
    }
    await request.save();
    res.redirect('/meus-pedidos?edited=1');
  } catch (error) {
    res.redirect(`/pedido/${req.params.id}/editar`);
  }
});

router.post('/pedido/:id/excluir', exigirAutenticacao, async (req, res) => {
  if (req.session.user.userType !== 'solicitante') return res.redirect('/dashboard');
  await Pedido.findOneAndDelete({ _id: req.params.id, user: req.session.user._id });
  res.redirect('/meus-pedidos');
});

router.get('/feed', exigirAutenticacao, async (req, res) => {
  const searchQuery = req.query.q || '';
  const requestDocs = await Pedido.find({ status: 'aberto' }).populate('user').sort({ createdAt: -1 });
  const requests = requestDocs.map((request) => (request.toObject ? request.toObject() : request));
  const filteredRequests = filtrarPedidos(requests, searchQuery);
  res.render('mural', {
    user: req.session.user || null,
    requests: filteredRequests,
    searchQuery,
    currentPage: 'feed'
  });
});

router.get('/pedido/:id', exigirAutenticacao, async (req, res) => {
  const request = await Pedido.findById(req.params.id).populate('user').populate('helper');

  if (!request) {
    return res.redirect('/feed');
  }

  const chatThread = buscarConversaDoPedido(req.params.id);

  res.render('pedido', {
    user: req.session.user || null,
    request,
    chatThread,
    currentPage: 'feed'
  });
});

router.post('/pedido/:id/concluir', exigirAutenticacao, async (req, res) => {
  const request = await Pedido.findById(req.params.id);

  if (!request) {
    return res.redirect('/ajudar');
  }

  if (String(request.helper) !== String(req.session.user._id)) {
    return res.redirect('/ajudar');
  }

  request.status = 'concluido';
  await request.save();

  res.redirect('/ajudar');
});

router.post('/pedido/:id/avaliar', exigirAutenticacao, async (req, res) => {
  const request = await Pedido.findById(req.params.id);

  if (!request) {
    return res.redirect('/feed');
  }

  if (String(request.user) !== String(req.session.user._id) || !['concluido', 'concluída'].includes(request.status)) {
    return res.redirect('/feed');
  }

  if (req.body.rating) {
    request.rating = Number(req.body.rating);
  }

  request.ratingComment = req.body.ratingComment || '';
  await request.save();

  res.redirect('/relatorio');
});

router.post('/pedido/:id/bloquear', exigirAutenticacao, async (req, res) => {
  if (req.session.user.userType !== 'voluntario') return res.redirect('/chat');

  const allowedReasons = ['Violação de regras', 'Falta de educação', 'Pedido falso'];
  const request = await Pedido.findById(req.params.id);
  if (!request || !request.helper || String(request.helper) !== String(req.session.user._id)) {
    return res.redirect('/chat');
  }
  if (!allowedReasons.includes(req.body.reason)) return res.redirect('/chat');

  await Bloqueio.findOneAndUpdate(
    { helper: req.session.user._id, requester: request.user, status: 'pendente' },
    { helper: req.session.user._id, requester: request.user, request: request._id, reason: req.body.reason },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.redirect('/relatorio');
});

router.post('/pedido/:id/quero-ajudar', exigirAutenticacao, async (req, res) => {
  const request = await Pedido.findById(req.params.id);

  if (!request) {
    return res.redirect('/ajudar');
  }

  if (req.session.user.userType !== 'voluntario') {
    return res.redirect('/dashboard');
  }

  if (request.status === 'concluido' || request.status === 'concluída') {
    return res.redirect('/ajudar');
  }

  if (String(request.user) === String(req.session.user._id)) {
    return res.redirect('/ajudar');
  }

  const blocked = await Bloqueio.exists({
    helper: req.session.user._id,
    requester: request.user,
    status: { $in: ['pendente', 'analisado'] }
  });
  if (blocked) return res.redirect('/ajudar');

  if (request.helper && String(request.helper) !== String(req.session.user._id)) {
    return res.redirect('/ajudar');
  }

  request.helper = req.session.user._id;
  request.status = 'em andamento';
  await request.save();

  const requester = await Usuario.findById(request.user);
  const helper = await Usuario.findById(req.session.user._id);
  criarConversa(String(request._id), requester, helper);

  res.redirect('/ajudar');
});

module.exports = router;
