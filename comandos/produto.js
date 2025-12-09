// comandos/produto.js
const readlineSync = require('readline-sync');
const db = require('../db');

// Função para listar categorias existentes
async function listarCategorias() {
  const [categorias] = await db.execute('SELECT id, nome FROM categorias ORDER BY nome');
  return categorias;
}

// Função para selecionar categoria (evita duplicação)
async function selecionarCategoria() {
  const categorias = await listarCategorias();
  
  if (categorias.length === 0) {
    console.log('\n❌ Nenhuma categoria cadastrada.');
    const criar = readlineSync.keyInYN('Deseja cadastrar uma nova categoria?');
    if (criar) {
      return await criarNovaCategoria();
    }
    return null;
  }
  
  console.log('\n--- CATEGORIAS DISPONÍVEIS ---');
  categorias.forEach(c => {
    console.log(`${c.id}. ${c.nome}`);
  });
  
  console.log('0. Cadastrar nova categoria');
  
  while (true) {
    const opcao = readlineSync.question('\nSelecione uma categoria (0 para nova): ');
    const opcaoNum = parseInt(opcao);
    
    if (opcaoNum === 0) {
      return await criarNovaCategoria();
    }
    
    const categoria = categorias.find(c => c.id === opcaoNum);
    if (categoria) {
      return categoria.id;
    }
    
    console.log('❌ Opção inválida. Tente novamente.');
  }
}

// Função para criar nova categoria SEM duplicação
async function criarNovaCategoria() {
  const nomeOriginal = readlineSync.question('\nNome da nova categoria: ');
  const nome = nomeOriginal.trim().charAt(0).toUpperCase() + nomeOriginal.trim().slice(1).toLowerCase();
  
  // Verificar se categoria já existe (case-insensitive)
  const [categoriasExistentes] = await db.execute(
    'SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?)',
    [nome]
  );
  
  if (categoriasExistentes.length > 0) {
    console.log(`✅ Categoria "${nome}" já existe (ID: ${categoriasExistentes[0].id})`);
    return categoriasExistentes[0].id;
  }
  
  // Criar nova categoria
  const [result] = await db.execute(
    'INSERT INTO categorias (nome) VALUES (?)',
    [nome]
  );
  
  console.log(`✅ Categoria "${nome}" criada com sucesso!`);
  return result.insertId;
}

// Listar produtos
async function listar() {
  const [produtos] = await db.execute(`
    SELECT p.*, c.nome as categoria_nome 
    FROM produtos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    ORDER BY p.nome
  `);
  
  if (produtos.length === 0) {
    console.log('\nNenhum produto cadastrado.');
    return;
  }
  
  console.log('\n--- PRODUTOS CADASTRADOS ---');
  console.log('ID | NOME                     | CATEGORIA     | PREÇO    | ESTOQUE');
  console.log('---|--------------------------|---------------|----------|---------');
  
  produtos.forEach(p => {
    console.log(
      `${p.id.toString().padEnd(2)} | ${p.nome.padEnd(24).substring(0, 24)} | ${p.categoria_nome ? p.categoria_nome.padEnd(13).substring(0, 13) : 'SEM CATEGORIA'} | R$ ${p.preco.toFixed(2).padStart(7)} | ${p.quantidade_estoque.toString().padStart(7)}`
    );
  });
}

// Cadastrar produto
async function cadastrar() {
  console.log('\n--- CADASTRAR PRODUTO ---');
  
  const categoriaId = await selecionarCategoria();
  if (categoriaId === null) {
    console.log('❌ Cadastro cancelado.');
    return;
  }
  
  const nome = readlineSync.question('Nome do produto: ');
  const preco = parseFloat(readlineSync.question('Preço (R$): '));
  const quantidade = parseInt(readlineSync.question('Quantidade inicial: ')) || 0;
  
  await db.execute(
    'INSERT INTO produtos (nome, preco, quantidade_estoque, categoria_id) VALUES (?, ?, ?, ?)',
    [nome, preco, quantidade, categoriaId]
  );
  
  console.log('✅ Produto cadastrado com sucesso!');
}

async function excluir() {
  console.log('\n--- EXCLUIR PRODUTO ---');
  
  const id = readlineSync.question('ID do produto: ');
  const [produtos] = await db.execute('SELECT * FROM produtos WHERE id = ?', [id]);
  
  if (produtos.length === 0) {
    console.log('❌ Produto não encontrado.');
    return;
  }
  
  const produto = produtos[0];
  const confirmar = readlineSync.keyInYN(`Tem certeza que deseja excluir o produto "${produto.nome}"?`);
  
  if (!confirmar) {
    console.log('❌ Exclusão cancelada.');
    return;
  }
  
  await db.execute('DELETE FROM produtos WHERE id = ?', [id]);
  console.log('✅ Produto excluído com sucesso!');
}

// Editar produto
async function editar() {
  console.log('\n--- EDITAR PRODUTO ---');
  
  const id = readlineSync.question('ID do produto: ');
  const [produtos] = await db.execute('SELECT * FROM produtos WHERE id = ?', [id]);
  
  if (produtos.length === 0) {
    console.log('❌ Produto não encontrado.');
    return;
  }
  
  const produto = produtos[0];
  console.log(`\nEditando: ${produto.nome}`);
  
  // Listar categorias para edição
  const categorias = await listarCategorias();
  console.log('\n--- CATEGORIAS DISPONÍVEIS ---');
  categorias.forEach(c => {
    console.log(`${c.id}. ${c.nome}`);
  });
  
  const nome = readlineSync.question(`Novo nome (${produto.nome}): `) || produto.nome;
  const preco = parseFloat(readlineSync.question(`Novo preço (R$ ${produto.preco.toFixed(2)}): `)) || produto.preco;
  const categoriaId = readlineSync.question(`Nova categoria (${produto.categoria_id}): `) || produto.categoria_id;
  
  await db.execute(
    'UPDATE produtos SET nome = ?, preco = ?, categoria_id = ? WHERE id = ?',
    [nome, preco, categoriaId, id]
  );
  
  console.log('✅ Produto atualizado com sucesso!');
}

// Atualizar estoque
async function atualizarEstoque() {
  console.log('\n--- ATUALIZAR ESTOQUE ---');
  
  const id = readlineSync.question('ID do produto: ');
  const [produtos] = await db.execute('SELECT * FROM produtos WHERE id = ?', [id]);
  
  if (produtos.length === 0) {
    console.log('❌ Produto não encontrado.');
    return;
  }
  
  const produto = produtos[0];
  console.log(`\nProduto: ${produto.nome}`);
  console.log(`Estoque atual: ${produto.quantidade_estoque}`);
  
  const tipo = readlineSync.keyInSelect(
    ['Adicionar unidades', 'Remover unidades'],
    'Tipo de movimentação: '
  );
  
  if (tipo === -1) return;
  
  const quantidade = parseInt(readlineSync.question('Quantidade: '));
  let novaQuantidade;
  
  if (tipo === 0) { // Adicionar
    novaQuantidade = produto.quantidade_estoque + quantidade;
  } else { // Remover
    novaQuantidade = produto.quantidade_estoque - quantidade;
    if (novaQuantidade < 0) {
      console.log('❌ Quantidade não pode ficar negativa.');
      return;
    }
  }
  
  await db.execute(
    'UPDATE produtos SET quantidade_estoque = ? WHERE id = ?',
    [novaQuantidade, id]
  );
  
  // Registrar movimentação
  const tipoMov = tipo === 0 ? 'entrada' : 'saida';
  const motivo = tipo === 0 ? 'Reposição manual' : 'Ajuste manual';
  
  await db.execute(
    'INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, motivo) VALUES (?, ?, ?, ?)',
    [id, tipoMov, Math.abs(quantidade), motivo]
  );
  
  console.log(`✅ Estoque atualizado! Novo estoque: ${novaQuantidade}`);
}

// Menu principal do módulo
async function menu(usuarioId) {
  let opcao;
  do {
    console.clear();
    console.log('\n--- PRODUTOS ---');
    console.log('1. Listar produtos');
    console.log('2. Cadastrar produto');
    console.log('3. Editar produto');
    console.log('4. Atualizar estoque');
    console.log('5. Excluir produto');
    console.log('6. Voltar');
    
    opcao = readlineSync.question('\nEscolha uma opção: ');
    
    switch(opcao) {
      case '1':
        await listar();
        break;
      case '2':
        await cadastrar();
        break;
      case '3':
        await editar();
        break;
      case '4':
        await atualizarEstoque();
        break;
      case '5':
        await excluir();
        return;
      case '6':  
      default:
        console.log('Opção inválida!');
    }
    
    if (opcao !== '6') {
      readlineSync.question('\nPressione ENTER para continuar...');
    }
  } while (opcao !== '6');
}

// Exportação correta
module.exports = {
  menu: menu,
  listar: listar,
  cadastrar: cadastrar,
  editar: editar,
  atualizarEstoque: atualizarEstoque
};