// comandos/cliente.js
const readlineSync = require('readline-sync');
const db = require('../db');

async function listar() {
  const [clientes] = await db.execute('SELECT * FROM clientes');
  if (clientes.length === 0) {
    console.log('Nenhum cliente cadastrado.');
    return;
  }
  console.log('\n--- CLIENTES CADASTRADOS ---');
  console.log('ID | NOME                     | CPF');
  console.log('---|--------------------------|------------');
  clientes.forEach(c => {
    console.log(`${c.id.toString().padEnd(2)} | ${c.nome.padEnd(24).substring(0, 24)} | ${c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`);
  });
}

async function cadastrar() {
  console.log('\n--- CADASTRAR CLIENTE ---');
  const nome = readlineSync.question('Nome completo: ');
  const cpf = readlineSync.question('CPF (apenas números): ');
  
  const [cpfExistente] = await db.execute('SELECT id FROM clientes WHERE cpf = ?', [cpf]);
  if (cpfExistente.length > 0) {
    console.log('❌ CPF já cadastrado no sistema.');
    return;
  }
  
  await db.execute(
    'INSERT INTO clientes (nome, cpf) VALUES (?, ?)',
    [nome, cpf]
  );
  console.log('✅ Cliente cadastrado com sucesso!');
}

async function editar() {
  console.log('\n--- EDITAR CLIENTE ---');
  const id = readlineSync.question('ID do cliente: ');
  
  const [clientes] = await db.execute('SELECT * FROM clientes WHERE id = ?', [id]);
  if (clientes.length === 0) {
    console.log('❌ Cliente não encontrado.');
    return;
  }
  
  const cliente = clientes[0];
  console.log(`Editando: ${cliente.nome} (CPF: ${cliente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')})`);
  
  const nome = readlineSync.question(`Novo nome (${cliente.nome}): `) || cliente.nome;
  let cpf = readlineSync.question(`Novo CPF (${cliente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}): `) || cliente.cpf;
  cpf = cpf.replace(/\D/g, '');
  
  const [cpfExistente] = await db.execute('SELECT id FROM clientes WHERE cpf = ? AND id != ?', [cpf, id]);
  if (cpfExistente.length > 0) {
    console.log('❌ CPF já cadastrado para outro cliente.');
    return;
  }
  
  await db.execute(
    'UPDATE clientes SET nome = ?, cpf = ? WHERE id = ?',
    [nome, cpf, id]
  );
  console.log('✅ Cliente atualizado com sucesso!');
}

async function buscarPorCPF() {
  console.log('\n--- BUSCAR CLIENTE POR CPF ---');
  const cpfInput = readlineSync.question('CPF (apenas números ou com máscara): ');
  const cpf = cpfInput.replace(/\D/g, '');
  
  const [clientes] = await db.execute('SELECT * FROM clientes WHERE cpf = ?', [cpf]);
  
  if (clientes.length === 0) {
    console.log('❌ Nenhum cliente encontrado com este CPF.');
    return;
  }
  
  const cliente = clientes[0];
  console.log('\n✅ CLIENTE ENCONTRADO:');
  console.log(`ID: ${cliente.id}`);
  console.log(`Nome: ${cliente.nome}`);
  console.log(`CPF: ${cliente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`);
}

async function  excluir(params) {
  // Função de exclusão de cliente (opcional)
  console .log('\n--- EXCLUIR CLIENTE ---');
  const id = readlineSync.question('ID do cliente a ser excluído: ');

  const [clientes] = await db.execute('SELECT * FROM clientes WHERE id = ?', [id]);
  if (clientes.length === 0) {
  console.log('❌ Cliente não encontrado.');
  return;
  }
  const cliente = clientes[0];
  console.log(`Excluindo: ${cliente.nome} (CPF: ${cliente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')})`);

const confirmacao = readlineSync.question('Tem certeza que deseja excluir este cliente? (s/n): ');
if (confirmacao.toLowerCase() !== 's') {
  console.log('❌ Exclusão cancelada.');
  return;
}
  await db.execute('update clientes set active = 0 where id = ?', [id]);
  console.log('✅ Cliente excluído com sucesso!');
}

async function menu(usuarioId) {
  let opcao;
  do {
    console.clear();
    console.log('\n--- CLIENTES ---');
    console.log('1. Listar clientes');
    console.log('2. Cadastrar cliente');
    console.log('3. Editar cliente');
    console.log('4. Buscar cliente por CPF');
    console.log('5. Excluir cliente');
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
        await buscarPorCPF();
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

module.exports = {
  menu: menu,
  listar: listar,
  cadastrar: cadastrar,
  editar: editar,
  buscarPorCPF: buscarPorCPF
};