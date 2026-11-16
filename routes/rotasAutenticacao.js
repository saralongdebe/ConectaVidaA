const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const Usuario = require('../models/Usuario');
const Pedido = require('../models/Pedido');
const Bloqueio = require('../models/Bloqueio');
const exigirAutenticacao = require('../middleware/autenticacao');
const { obterConversasDoUsuario, enviarMensagem, obterNotificacoes, marcarNotificacaoComoLida } = require('../estadoAplicativo');
const { gerarTokenRedefinicao, normalizarEmail, enviarEmailRedefinicaoSenha } = require('../utils/envioEmail');

const router = express.Router();
const emailAdministrador = process.env.ADMIN_EMAIL || 'admin@conectavida.com';
const mensagemRecuperacaoSenha = 'O link de recuperação foi enviado para seu e-mail. Verifique também a caixa de spam.';

function obterLimitesDoDia() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  return { today: hoje, tomorrow: amanha };
}

function criarTransportadorDeEmail() {
  const configuracaoEmail = [process.env.EMAIL_HOST, process.env.EMAIL_USER, process.env.EMAIL_PASS];
  const possuiCampoExemplo = configuracaoEmail.some((valor) => !valor || /seu-email|sua-senha|exemplo\.com/i.test(valor));
  if (possuiCampoExemplo) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT || 587) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

router.get('/home', (req, res) => res.redirect('/'));

router.get('/login', (req, res) => {
  res.render('entrar', { user: req.session.user || null, error: null, currentPage: 'login' });
});

router.post('/login', async (req, res) => {
  try {
    const user = await Usuario.findOne({ email: req.body.email });
    if (!user) return res.render('entrar', { user: null, error: 'Usuário não encontrado.', currentPage: 'login' });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.render('entrar', { user: null, error: 'Senha incorreta.', currentPage: 'login' });

    const sessaoUsuario = user.toObject ? user.toObject() : user;
    sessaoUsuario.role = sessaoUsuario.role || (sessaoUsuario.email === emailAdministrador ? 'admin' : 'user');
    req.session.user = sessaoUsuario;
    res.redirect('/dashboard');
  } catch (error) {
    res.render('entrar', { user: null, error: 'Erro ao fazer login.', currentPage: 'login' });
  }
});

router.get('/esqueci-senha', (req, res) => {
  res.render('esqueciSenha', {
    user: req.session.user || null,
    error: null,
    success: null,
    currentPage: 'login'
  });
});

router.post('/esqueci-senha', async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);
    const user = await Usuario.findOne({ email });

    if (!user) {
      return res.render('esqueciSenha', {
        user: req.session.user || null,
        error: null,
        success: mensagemRecuperacaoSenha,
        currentPage: 'login'
      });
    }

    const transporter = criarTransportadorDeEmail();
    if (!transporter) {
      console.error('[email] SMTP não configurado. Preencha EMAIL_HOST, EMAIL_USER e EMAIL_PASS no .env.');
      return res.render('esqueciSenha', {
        user: req.session.user || null,
        error: null,
        success: mensagemRecuperacaoSenha,
        currentPage: 'login'
      });
    }

    await transporter.verify();

    const resetToken = gerarTokenRedefinicao();
    const resetTokenExpires = new Date(Date.now() + 1000 * 60 * 30);

    user.resetToken = resetToken;
    user.resetTokenExpires = resetTokenExpires;
    await user.save();

    const resetLink = `${process.env.BASE_URL || `${req.protocol}://${req.get('host')}`}/redefinir-senha?token=${resetToken}`;

    await enviarEmailRedefinicaoSenha({
      transportador: transporter,
      destinatario: user.email,
      nome: user.name,
      linkRedefinicao: resetLink
    });

    return res.render('esqueciSenha', {
      user: req.session.user || null,
      error: null,
      success: mensagemRecuperacaoSenha,
      currentPage: 'login'
    });
  } catch (error) {
    console.error('[email] Erro ao enviar recuperação de senha:', error.message);
    return res.render('esqueciSenha', {
      user: req.session.user || null,
      error: null,
      success: mensagemRecuperacaoSenha,
      currentPage: 'login'
    });
  }
});

router.get('/redefinir-senha', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.render('redefinirSenha', {
      user: req.session.user || null,
      error: 'Token inválido.',
      success: null,
      currentPage: 'login'
    });
  }

  const user = await Usuario.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: new Date() }
  });

  if (!user) {
    return res.render('redefinirSenha', {
      user: req.session.user || null,
      error: 'Link expirado ou inválido. Solicite uma nova recuperação de senha.',
      success: null,
      currentPage: 'login'
    });
  }

  res.render('redefinirSenha', {
    user: req.session.user || null,
    error: null,
    success: null,
    token,
    currentPage: 'login'
  });
});

router.post('/redefinir-senha', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
      return res.render('redefinirSenha', {
        user: req.session.user || null,
        error: 'Token de redefinição ausente.',
        success: null,
        currentPage: 'login'
      });
    }

    if (password !== confirmPassword) {
      return res.render('redefinirSenha', {
        user: req.session.user || null,
        error: 'As senhas não conferem.',
        success: null,
        token,
        currentPage: 'login'
      });
    }

    const user = await Usuario.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.render('redefinirSenha', {
        user: req.session.user || null,
        error: 'Link expirado ou inválido. Solicite uma nova recuperação de senha.',
        success: null,
        currentPage: 'login'
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    return res.render('entrar', {
      user: null,
      error: null,
      success: 'Senha redefinida com sucesso! Faça login com sua nova senha.',
      currentPage: 'login'
    });
  } catch (error) {
    return res.render('redefinirSenha', {
      user: req.session.user || null,
      error: 'Não foi possível redefinir a senha agora.',
      success: null,
      currentPage: 'login'
    });
  }
});

router.get('/cadastro', (req, res) => {
  res.render('cadastro', { user: req.session.user || null, error: null, currentPage: 'cadastro' });
});

router.post('/cadastro', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, city, phone, userType, tipoConta, tipo, nomeInstituicao, cnpj, nomeResponsavel, telefoneInstituicao, bairroAtuacao } = req.body;
    if (password !== confirmPassword) return res.render('cadastro', { user: null, error: 'As senhas não conferem.', currentPage: 'cadastro' });

    const existingUser = await Usuario.findOne({ email });
    if (existingUser) return res.render('cadastro', { user: null, error: 'Email já cadastrado.', currentPage: 'cadastro' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = email === emailAdministrador ? 'admin' : 'user';
    const selectedType = userType || tipoConta || tipo || 'solicitante';
    const isOng = selectedType === 'ONG';
    const resolvedUserType = isOng ? 'solicitante' : selectedType;
    const user = new Usuario({
      name: isOng ? (nomeInstituicao || name) : name,
      email,
      password: hashedPassword,
      city,
      phone: isOng ? (telefoneInstituicao || phone) : phone,
      userType: resolvedUserType,
      tipo: isOng ? 'ONG' : 'pessoa_comum',
      nomeInstituicao: isOng ? nomeInstituicao : '',
      cnpj: isOng ? cnpj : '',
      nomeResponsavel: isOng ? nomeResponsavel : '',
      telefoneInstituicao: isOng ? telefoneInstituicao : '',
      bairroAtuacao: isOng ? bairroAtuacao : '',
      role
    });
    await user.save();

    const userSession = user.toObject ? user.toObject() : user;
    req.session.user = userSession;
    res.redirect('/dashboard');
  } catch (error) {
    res.render('cadastro', { user: null, error: 'Erro ao cadastrar usuário.', currentPage: 'cadastro' });
  }
});

router.get('/dashboard', exigirAutenticacao, async (req, res) => {
  const { today, tomorrow } = obterLimitesDoDia();
  const isVolunteer = req.session.user.userType === 'voluntario';
  const [registeredUsers, completed, activeToday, trackedRequests] = await Promise.all([
    Usuario.countDocuments({}),
    Pedido.countDocuments({ status: { $in: ['concluido', 'concluída'] } }),
    Pedido.countDocuments({
      status: { $nin: ['concluido', 'concluída'] },
      createdAt: { $gte: today, $lt: tomorrow }
    }),
    Pedido.find({ [isVolunteer ? 'helper' : 'user']: req.session.user._id })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()
  ]);
  res.render('painel', {
    user: req.session.user,
    notifications: obterNotificacoes(),
    metrics: { users: registeredUsers, completed, activeToday },
    trackedRequests,
    currentPage: 'dashboard'
  });
});

router.get('/perfil', exigirAutenticacao, (req, res) => {
  res.render('perfil', { user: req.session.user, error: null, success: null, currentPage: 'perfil' });
});

router.post('/perfil', exigirAutenticacao, async (req, res) => {
  try {
    const { name, email, city, phone, password, confirmPassword } = req.body;
    if (!name || !email || !city || !phone) {
      return res.render('perfil', { user: req.session.user, error: 'Preencha todos os campos obrigatórios.', success: null, currentPage: 'perfil' });
    }
    if (password && password !== confirmPassword) {
      return res.render('perfil', { user: req.session.user, error: 'As senhas não conferem.', success: null, currentPage: 'perfil' });
    }

    const user = await Usuario.findById(req.session.user._id);
    if (!user) return res.redirect('/logout');
    const normalizedEmail = normalizarEmail(email);
    const emailInUse = await Usuario.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
    if (emailInUse) {
      return res.render('perfil', { user: req.session.user, error: 'Este e-mail já está cadastrado.', success: null, currentPage: 'perfil' });
    }

    user.name = name.trim();
    user.email = normalizedEmail;
    user.city = city.trim();
    user.phone = phone.trim();
    if (password) user.password = await bcrypt.hash(password, 10);
    await user.save();
    req.session.user = user.toObject();
    res.render('perfil', { user: req.session.user, error: null, success: 'Perfil atualizado com sucesso.', currentPage: 'perfil' });
  } catch (error) {
    res.render('perfil', { user: req.session.user, error: 'Não foi possível atualizar o perfil.', success: null, currentPage: 'perfil' });
  }
});

router.post('/perfil/excluir', exigirAutenticacao, async (req, res) => {
  try {
    const userId = req.session.user._id;
    await Promise.all([
      Pedido.deleteMany({ user: userId }),
      Pedido.deleteMany({ helper: userId }),
      Bloqueio.deleteMany({ $or: [{ helper: userId }, { requester: userId }] }),
      Usuario.findByIdAndDelete(userId)
    ]);
    req.session.destroy(() => res.redirect('/'));
  } catch (error) {
    res.redirect('/perfil');
  }
});

router.get('/chat', exigirAutenticacao, (req, res) => {
  const chatThreads = obterConversasDoUsuario(req.session.user._id);
  res.render('conversas', { user: req.session.user, chatThreads, currentPage: 'chat' });
});

router.post('/chat', exigirAutenticacao, (req, res) => {
  const { requestId, message } = req.body;
  if (message) {
    enviarMensagem(requestId || 'default', req.session.user._id, req.session.user.name, message);
  }
  res.redirect('/chat');
});

router.get('/notifications', exigirAutenticacao, (req, res) => {
  res.render('notificacoes', { user: req.session.user, notifications: obterNotificacoes(), currentPage: 'notifications' });
});

router.post('/notifications/:id/read', exigirAutenticacao, (req, res) => {
  const updated = marcarNotificacaoComoLida(obterNotificacoes(), req.params.id);
  const notifications = obterNotificacoes();
  notifications.splice(0, notifications.length, ...updated);
  res.redirect('/notifications');
});

router.get('/admin', exigirAutenticacao, (req, res) => {
  if (req.session.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }
  const { today, tomorrow } = obterLimitesDoDia();
  Promise.all([
    Usuario.countDocuments({}),
    Pedido.countDocuments({ status: { $in: ['concluido', 'concluída'] } }),
    Pedido.countDocuments({
      status: { $nin: ['concluido', 'concluída'] },
      createdAt: { $gte: today, $lt: tomorrow }
    }),
    Bloqueio.find({ status: 'pendente' }).populate('helper requester').sort({ createdAt: -1 })
  ]).then(([registeredUsers, completed, activeToday, blocks]) => {
    res.render('administrador', {
      user: req.session.user,
      notifications: obterNotificacoes(),
      metrics: { users: registeredUsers, completed, activeToday },
      blocks,
      currentPage: 'admin'
    });
  }).catch(() => res.redirect('/dashboard'));
});

router.post('/admin/bloqueios/:id/analisar', exigirAutenticacao, async (req, res) => {
  if (req.session.user.role !== 'admin') return res.redirect('/dashboard');
  await Bloqueio.findByIdAndUpdate(req.params.id, { status: 'analisado' });
  res.redirect('/admin');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
