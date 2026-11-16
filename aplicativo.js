require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const conectarBancoDados = require('./config/bancoDados');
const rotasAutenticacao = require('./routes/rotasAutenticacao');
const rotasPedidos = require('./routes/rotasPedidos');
const { obterNotificacoes } = require('./estadoAplicativo');

const aplicacao = express();
const ENDERECO = process.env.HOST || '0.0.0.0';
const PORTA = process.env.PORT || 3000;

aplicacao.set('view engine', 'ejs');
aplicacao.set('views', path.join(__dirname, 'views'));

aplicacao.use(express.urlencoded({ extended: true }));
aplicacao.use(express.static(path.join(__dirname, 'public')));
aplicacao.use(
  session({
    secret: process.env.SESSION_SECRET || 'conectavida-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);

aplicacao.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.unreadCount = req.session.user
    ? obterNotificacoes().filter((notificacao) => !notificacao.read).length
    : 0;
  next();
});

aplicacao.use('/', rotasAutenticacao);
aplicacao.use('/', rotasPedidos);

aplicacao.get('/', (req, res) => {
  res.render('inicio', { user: req.session.user || null, error: null, currentPage: 'home' });
});

aplicacao.get('/home', (req, res) => res.redirect('/'));

aplicacao.use((req, res) => {
  res.status(404).render('404', { user: req.session.user || null, currentPage: 'home' });
});

conectarBancoDados();

aplicacao.listen(PORTA, ENDERECO, () => {
  console.log(`ConectaVida rodando em http://${ENDERECO}:${PORTA}`);
});
