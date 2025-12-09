// comandos/venda.js
const readlineSync = require('readline-sync');
const db = require('../db');
const caixaUtil = require('../utils/caixa');
const log = require('./log');

exports.novo = async (usuarioId) => {
  const caixaId = await caixaUtil.getAberto(usuarioId);
  if (!caixaId) {
    console.log('⚠️ Abra o caixa primeiro (menu Relatórios > Caixa).');
    return;
  }

  // Selecionar cliente
  const codCliente = readlineSync.question('Código do cliente (0 se não cadastrado): ');
  const clienteId = codCliente !== '0' ? parseInt(codCliente) || null : null;

  // Selecionar produtos (REMOVIDA a condição 'ativo = true')
  const [produtos] = await db.execute('SELECT id, nome, preco FROM produtos WHERE quantidade_estoque > 0');
  
  if (produtos.length === 0) {
    console.log('⚠️ Nenhum produto disponível.');
    return;
  }

  console.log('\n--- PRODUTOS ---');
  produtos.forEach(p => console.log(`${p.id}. ${p.nome} - R$ ${p.preco.toFixed(2)}`));

  const itens = [];
  while (true) {
    const id = parseInt(readlineSync.question('\nID do produto (0 para finalizar): '));
    if (id === 0) break;
    
    const produto = produtos.find(p => p.id === id);
    if (!produto) {
      console.log('Produto inválido.');
      continue;
    }

    const qtd = parseInt(readlineSync.question('Quantidade: ')) || 1;
    const [estoque] = await db.execute('SELECT quantidade_estoque FROM produtos WHERE id = ?', [id]);
    if (estoque[0].quantidade_estoque < qtd) {
      console.log(`Estoque insuficiente. Disponível: ${estoque[0].quantidade_estoque}`);
      continue;
    }

    itens.push({ ...produto, quantidade: qtd });
  }

  if (itens.length === 0) return;

  let total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  console.log(`\nSubtotal: R$ ${total.toFixed(2)}`);

  // Aplicar desconto (≤10%)
  let desconto = 0;
  const aplicarDesconto = readlineSync.keyInYN('Aplicar desconto?');
  if (aplicarDesconto) {
    const descPercent = parseFloat(readlineSync.question('Desconto (% máximo 10): '));
    if (descPercent > 10) {
      console.log('⚠️ Desconto máximo permitido: 10%.');
      desconto = total * 0.10;
    } else {
      desconto = total * (descPercent / 100);
    }
    total -= desconto;
  }

  console.log(`\n✅ Total final: R$ ${total.toFixed(2)}`);
  if (!readlineSync.keyInYN('Confirmar venda?')) return;

  // Criar venda
  const [venda] = await db.execute(
    'INSERT INTO vendas (caixa_id, cliente_id, usuario_id, valor_total, desconto) VALUES (?, ?, ?, ?, ?)',
    [caixaId, clienteId, usuarioId, total, desconto]
  );

  // Atualizar estoque
for (const item of itens) {
  await db.execute('INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
    [venda.insertId, item.id, item.quantidade, item.preco]
  );
  await db.execute('UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?', [item.quantidade, item.id]);
  // REMOVIDA a coluna usuario_id da inserção abaixo
  await db.execute('INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade) VALUES (?, "saida", ?)',
  [item.id, item.quantidade]
);
}

  // Comprovante
  console.log('\n' + '='.repeat(40));
  console.log('           CUPOM NÃO FISCAL');
  console.log('='.repeat(40));
  console.log(`Venda: #${venda.insertId}`);
  console.log(`Data: ${new Date().toLocaleString('pt-BR')}`);
  itens.forEach(i => console.log(`${i.quantidade}x ${i.nome} - R$ ${(i.quantidade * i.preco).toFixed(2)}`));
  if (desconto > 0) console.log(`Desconto: R$ ${desconto.toFixed(2)}`);
  console.log('-'.repeat(40));
  console.log(`TOTAL: R$ ${total.toFixed(2)}`);
  console.log('='.repeat(40));

  await log.registrar(usuarioId, 'Venda realizada', `Venda #${venda.insertId}`);
};