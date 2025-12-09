// comandos/log.js
const db = require('../db');

// Função para registrar ações no log de auditoria
exports.registrar = async (usuarioId, acao, descricao = '') => {
  try {
    await db.execute(
      'INSERT INTO logs (acao, descricao, usuario_id) VALUES (?, ?, ?)',
      [acao, descricao, usuarioId]
    );
  } catch (err) {
    // Não interrompe o fluxo principal em caso de falha no log
    console.error('⚠️ Falha ao registrar log:', err.message);
  }
};