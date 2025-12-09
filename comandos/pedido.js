// comandos/pedido.js
const readlineSync = require('readline-sync');
const db = require('../db');

exports.novo = async (usuarioId) => {
  console.log('\n--- NOVO PEDIDO ---');

  // Perguntar código do cliente
  const codCliente = readlineSync.question('Código do cliente (0 se não cadastrado): ').trim();
  const clienteId = codCliente !== '0' ? parseInt(codCliente) || null : null;

  if (clienteId) {
    const [existe] = await db.execute('SELECT nome FROM clientes WHERE id = ?', [clienteId]);
    if (existe.length === 0) {
      console.log('⚠️ Cliente não encontrado. Pedido sem cliente.');
    }
  }

  const [produtos] = await db.execute('SELECT id, nome, preco FROM produtos WHERE quantidade_estoque > 0');
  if (produtos.length === 0) {
    console.log('⚠️ Nenhum produto disponível.');
    return;
  }

  console.log('\nCardápio:');
  produtos.forEach(p => console.log(`${p.id}. ${p.nome} - R$ ${p.preco}`));

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

  if (itens.length === 0) {
    console.log('Nenhum item adicionado.');
    return;
  }

  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  console.log(`\n✅ Total: R$ ${total.toFixed(2)}`);

  if (!readlineSync.keyInYN('Confirmar pedido?')) return;

  const [pedido] = await db.execute(
    'INSERT INTO pedidos (cliente_id, usuario_id, valor_total) VALUES (?, ?, ?)',
    [clienteId || null, usuarioId, total]
  );

  for (const item of itens) {
    await db.execute(
      'INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
      [pedido.insertId, item.id, item.quantidade, item.preco]
    );
    await db.execute(
      'UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?',
      [item.quantidade, item.id]
    );
    await db.execute(
      'INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade) VALUES (?, "saida", ?)',
      [item.id, item.quantidade]
    );
  }

  console.log(`\n🎉 Pedido #${pedido.insertId} criado com sucesso!`);
};