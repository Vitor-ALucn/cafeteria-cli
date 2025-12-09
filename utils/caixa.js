// utils/caixa.js
const db = require('../db');

exports.abrir = async (usuarioId, valorInicial) => {
  const [result] = await db.execute(
    'INSERT INTO caixas (valor_inicial, usuario_id) VALUES (?, ?)',
    [valorInicial, usuarioId]
  );
  return result.insertId;
};

exports.getAberto = async (usuarioId) => {
  const [caixas] = await db.execute(
    'SELECT id FROM caixas WHERE usuario_id = ? AND status = "aberto" ORDER BY id DESC LIMIT 1',
    [usuarioId]
  );
  return caixas[0]?.id || null;
};

exports.fechar = async (caixaId, valorInformado) => {
  const [vendas] = await db.execute('SELECT SUM(valor_total) as total FROM vendas WHERE caixa_id = ?', [caixaId]);
  const totalVendas = vendas[0].total || 0;
  
  await db.execute('UPDATE caixas SET valor_final = ?, fechado_em = NOW(), status = "fechado" WHERE id = ?', [valorInformado, caixaId]);
  
  return { totalVendas, valorInformado };
};