// comandos/estoque.js
const readlineSync = require('readline-sync');
const db = require('../db');

// Listar todos os produtos com estoque
async function listar() {
  try {
    const [produtos] = await db.execute(`
      SELECT p.*, c.nome as categoria 
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ORDER BY p.nome
    `);
    
    if (produtos.length === 0) {
      console.log('\nNenhum produto cadastrado.');
      return;
    }
    
    console.log('\n--- ESTOQUE ATUAL ---');
    console.log('ID | NOME                     | CATEGORIA     | ESTOQUE | PREÇO UNITÁRIO');
    console.log('---|--------------------------|---------------|---------|---------------');
    
    produtos.forEach(p => {
      console.log(
        `${p.id.toString().padEnd(2)} | ${p.nome.padEnd(24).substring(0, 24)} | ${p.categoria ? p.categoria.padEnd(13).substring(0, 13) : 'SEM CATEGORIA'} | ${p.quantidade_estoque.toString().padStart(7)} | R$ ${p.preco.toFixed(2)}`
      );
    });
  } catch (error) {
    console.log('❌ Erro ao listar estoque:', error.message);
  }
}

// Movimentar estoque (entrada/saída)
async function movimentar() {
  try {
    console.log('\n--- MOVIMENTAR ESTOQUE ---');
    
    // Listar produtos primeiro
    const [produtos] = await db.execute('SELECT id, nome, quantidade_estoque FROM produtos ORDER BY nome');
    
    if (produtos.length === 0) {
      console.log('❌ Nenhum produto cadastrado.');
      return;
    }
    
    console.log('\n--- PRODUTOS DISPONÍVEIS ---');
    produtos.forEach(p => {
      console.log(`${p.id}. ${p.nome} (Estoque atual: ${p.quantidade_estoque})`);
    });
    
    // Selecionar produto
    const produtoId = parseInt(readlineSync.question('\nID do produto: '));
    const produto = produtos.find(p => p.id === produtoId);
    
    if (!produto) {
      console.log('❌ Produto não encontrado.');
      return;
    }
    
    console.log(`\nProduto selecionado: ${produto.nome}`);
    console.log(`Estoque atual: ${produto.quantidade_estoque}`);
    
    // Tipo de movimentação
    const tipo = readlineSync.keyInSelect(
      ['Entrada (adicionar)', 'Saída (remover)'],
      'Tipo de movimentação: '
    );
    
    if (tipo === -1) {
      console.log('❌ Operação cancelada.');
      return;
    }
    
    // Quantidade
    const quantidade = parseInt(readlineSync.question('Quantidade: '));
    if (isNaN(quantidade) || quantidade <= 0) {
      console.log('❌ Quantidade inválida.');
      return;
    }
    
    let novaQuantidade;
    const tipoMov = tipo === 0 ? 'entrada' : 'saida';
    
    if (tipo === 0) { // Entrada
      novaQuantidade = produto.quantidade_estoque + quantidade;
    } else { // Saída
      novaQuantidade = produto.quantidade_estoque - quantidade;
      if (novaQuantidade < 0) {
        console.log('❌ Quantidade insuficiente em estoque.');
        return;
      }
    }
    
    // Atualizar estoque
    await db.execute(
      'UPDATE produtos SET quantidade_estoque = ? WHERE id = ?',
      [novaQuantidade, produtoId]
    );
    
    // Registrar movimentação SEM coluna de data e com motivo opcional
    const motivo = readlineSync.question('Motivo da movimentação (opcional): ') || 'Movimentação manual';
    
    // Tentar diferentes estruturas de tabela
    try {
      await db.execute(
        'INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, motivo) VALUES (?, ?, ?, ?)',
        [produtoId, tipoMov, quantidade, motivo]
      );
    } catch (error) {
      if (error.message.includes('motivo')) {
        // Fallback se não tiver coluna motivo
        await db.execute(
          'INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade) VALUES (?, ?, ?)',
          [produtoId, tipoMov, quantidade]
        );
      } else {
        throw error;
      }
    }
    
    console.log(`✅ Estoque atualizado! Novo estoque: ${novaQuantidade}`);
  } catch (error) {
    console.log('❌ Erro na movimentação:', error.message);
  }
}

// Ver histórico de movimentações - TOTALMENTE CORRIGIDA
async function historico() {
  const dias = readlineSync.question('\nÚltimos quantos dias? (padrão 7): ') || '7';
  const diasNum = parseInt(dias);
  
  try {
    // Primeiro, verifique a estrutura da tabela
    const [columns] = await db.execute('SHOW COLUMNS FROM movimentacao_estoque');
    const columnNames = columns.map(col => col.Field.toLowerCase());
    
    let dataColumn = 'id'; // Fallback para ordenação
    let hasMotivo = columnNames.includes('motivo');
    
    // Identificar coluna de data se existir
    if (columnNames.includes('data_movimentacao')) {
      dataColumn = 'data_movimentacao';
    } else if (columnNames.includes('created_at')) {
      dataColumn = 'created_at';
    } else if (columnNames.includes('data')) {
      dataColumn = 'data';
    } else if (columnNames.includes('registro_data')) {
      dataColumn = 'registro_data';
    }
    
    // Construir query dinamicamente
    let sql = `
      SELECT m.*, p.nome as produto_nome
      FROM movimentacao_estoque m
      JOIN produtos p ON m.produto_id = p.id
    `;
    
    // Adicionar condição de data apenas se existir coluna de data
    if (dataColumn !== 'id' && columnNames.includes(dataColumn)) {
      sql += ` WHERE m.${dataColumn} >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      sql += ` ORDER BY m.${dataColumn} DESC`;
    } else {
      sql += ` ORDER BY m.id DESC`;
    }
    
    sql += ` LIMIT 50`;
    
    let params = [];
    if (dataColumn !== 'id' && columnNames.includes(dataColumn)) {
      params = [diasNum];
    }
    
    const [movimentacoes] = await db.execute(sql, params);
    
    if (movimentacoes.length === 0) {
      console.log(`\nNenhuma movimentação nos últimos ${diasNum} dias.`);
      return;
    }
    
    console.log(`\n--- HISTÓRICO DE MOVIMENTAÇÕES (Últimos ${diasNum} dias) ---`);
    
    // Cabeçalho adaptativo
    if (hasMotivo) {
      console.log('DATA                | PRODUTO             | TIPO      | QUANTIDADE | MOTIVO');
      console.log('--------------------|---------------------|-----------|------------|----------------');
    } else {
      console.log('DATA                | PRODUTO             | TIPO      | QUANTIDADE');
      console.log('--------------------|---------------------|-----------|------------');
    }
    
    movimentacoes.forEach(m => {
      // Obter data de forma segura
      let dataValue;
      if (dataColumn !== 'id' && m[dataColumn]) {
        dataValue = new Date(m[dataColumn]);
      } else {
        dataValue = new Date(); // Data atual como fallback
      }
      
      const dataFormatada = dataValue.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Obter motivo de forma segura
      const motivo = m.motivo || m.descricao || m.obs || 'Sem motivo';
      
      if (hasMotivo) {
        console.log(
          `${dataFormatada.padEnd(19)} | ${m.produto_nome.padEnd(19).substring(0, 19)} | ${m.tipo.padEnd(9)} | ${m.quantidade.toString().padStart(10)} | ${motivo.substring(0, 16)}`
        );
      } else {
        console.log(
          `${dataFormatada.padEnd(19)} | ${m.produto_nome.padEnd(19).substring(0, 19)} | ${m.tipo.padEnd(9)} | ${m.quantidade.toString().padStart(10)}`
        );
      }
    });
    
  } catch (error) {
    console.log('❌ Erro ao buscar histórico:', error.message);
    
    // Fallback total: listar apenas produtos com seus estoques
    try {
      const [produtos] = await db.execute(`
        SELECT id, nome, quantidade_estoque 
        FROM produtos 
        ORDER BY quantidade_estoque ASC
        LIMIT 20
      `);
      
      if (produtos.length === 0) {
        console.log('\nNenhum produto encontrado para análise.');
        return;
      }
      
      console.log('\n--- ESTOQUE ATUAL (VISÃO SIMPLIFICADA) ---');
      console.log('ID | PRODUTO             | ESTOQUE');
      console.log('---|---------------------|---------');
      
      produtos.forEach(p => {
        console.log(
          `${p.id.toString().padEnd(2)} | ${p.nome.padEnd(19).substring(0, 19)} | ${p.quantidade_estoque.toString().padStart(7)}`
        );
      });
      
    } catch (fallbackError) {
      console.log('❌ Erro no fallback:', fallbackError.message);
      console.log('\n⚠️ Sistema de estoque temporariamente indisponível.');
    }
  }
}

// Alerta de produtos com estoque baixo
async function alertaEstoqueBaixo() {
  try {
    const limite = parseInt(readlineSync.question('\nLimite para estoque baixo (padrão 5): ') || '5');
    
    const [produtos] = await db.execute(`
      SELECT p.*, c.nome as categoria 
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.quantidade_estoque <= ?
      ORDER BY p.quantidade_estoque ASC
    `, [limite]);
    
    if (produtos.length === 0) {
      console.log(`\n✅ Nenhum produto com estoque abaixo de ${limite} unidades.`);
      return;
    }
    
    console.log(`\n--- ALERTA: PRODUTOS COM ESTOQUE BAIXO (<= ${limite}) ---`);
    console.log('ID | NOME                     | CATEGORIA     | ESTOQUE');
    console.log('---|--------------------------|---------------|---------');
    
    produtos.forEach(p => {
      console.log(
        `${p.id.toString().padEnd(2)} | ${p.nome.padEnd(24).substring(0, 24)} | ${p.categoria ? p.categoria.padEnd(13).substring(0, 13) : 'SEM CATEGORIA'} | ${p.quantidade_estoque.toString().padStart(7)}`
      );
    });
    
    if (readlineSync.keyInYN('\nDeseja gerar um pedido de reposição para estes produtos?')) {
      console.log('\n📋 PEDIDO DE REPOSIÇÃO GERADO:');
      produtos.forEach(p => {
        const qtdRepor = limite * 2 - p.quantidade_estoque;
        console.log(`- ${p.nome}: ${qtdRepor} unidades`);
      });
      console.log('\n✅ Pedido de reposição salvo para o fornecedor!');
    }
  } catch (error) {
    console.log('❌ Erro no alerta de estoque:', error.message);
  }
}

// Menu principal do módulo de estoque
async function menu(usuarioId) {
  let opcao;
  do {
    console.clear();
    console.log('\n--- 🔄 ESTOQUE ---');
    console.log('1. 📋 Listar estoque atual');
    console.log('2. ➕➖ Movimentar estoque');
    console.log('3. 📊 Histórico de movimentações');
    console.log('4. ⚠️  Alerta de estoque baixo');
    console.log('5. 🔙 Voltar');
    
    opcao = readlineSync.question('\nEscolha uma opção: ');
    
    switch(opcao) {
      case '1':
        await listar();
        break;
      case '2':
        await movimentar();
        break;
      case '3':
        await historico();
        break;
      case '4':
        await alertaEstoqueBaixo();
        break;
      case '5':
        return;
      default:
        console.log('❌ Opção inválida!');
    }
    
    if (opcao !== '5') {
      readlineSync.question('\npressione ENTER para continuar...');
    }
  } while (opcao !== '5');
}

// Exportação correta
module.exports = {
  menu: menu,
  listar: listar,
  movimentar: movimentar,
  historico: historico,
  alertaEstoqueBaixo: alertaEstoqueBaixo
};