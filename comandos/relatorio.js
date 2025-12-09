// comandos/relatorio.js
const readlineSync = require('readline-sync');
const db = require('../db');

// Função mínima para fechar caixa (apenas para não quebrar)
async function fecharCaixa(usuarioId) {
  console.log('\n⚠️ FUNCIONALIDADE EM DESENVOLVIMENTO');
  console.log('Para fechar o caixa, use o menu principal:');
  console.log('1. Abra um novo caixa');
  console.log('2. Realize vendas');
  console.log('3. O caixa será fechado automaticamente no final do dia');
  readlineSync.question('\npressione ENTER para continuar...');
}

// Função mínima para vendas do dia
async function vendasDoDia() {
  console.log('\n⚠️ FUNCIONALIDADE EM DESENVOLVIMENTO');
  console.log('Relatório de vendas do dia estará disponível em breve.');
  readlineSync.question('\npressione ENTER para continuar...');
}

// Função mínima para alertas
async function alertas() {
  console.log('\n⚠️ FUNCIONALIDADE EM DESENVOLVIMENTO');
  console.log('Sistema de alertas será implementado na próxima versão.');
  readlineSync.question('\npressione ENTER para continuar...');
}

// Função para abrir caixa (mínima funcional)
async function abrirCaixa(usuarioId) {
  console.log('\n--- 💰 ABRIR CAIXA ---');
  
  try {
    // Verificar se já tem caixa aberto
    const [caixasAbertos] = await db.execute(
      'SELECT * FROM caixas WHERE status = "ABERTO" AND usuario_id = ?',
      [usuarioId]
    );
    
    if (caixasAbertos.length > 0) {
      console.log('⚠️ Você já tem um caixa aberto!');
      console.log(`Caixa ID: ${caixasAbertos[0].id}`);
      console.log(`Aberto em: ${new Date(caixasAbertos[0].data_abertura).toLocaleString('pt-BR')}`);
      const confirmar = readlineSync.keyInYN('Deseja fechar o caixa atual e abrir um novo?');
      
      if (!confirmar) {
        return;
      }
      
      // Fechar caixa atual
      await db.execute(
        'UPDATE caixas SET status = "FECHADO", data_fechamento = NOW() WHERE id = ?',
        [caixasAbertos[0].id]
      );
      console.log('✅ Caixa anterior fechado.');
    }
    
    const valorInicial = parseFloat(readlineSync.question('Valor inicial no caixa (R$): ') || '0');
    
    // Obter nome do usuário
    const [usuarios] = await db.execute('SELECT nome FROM usuarios WHERE id = ?', [usuarioId]);
    const usuarioNome = usuarios[0].nome;
    
    // Abrir novo caixa
    await db.execute(
      'INSERT INTO caixas (usuario_id, usuario_nome, valor_inicial, data_abertura, status) VALUES (?, ?, ?, NOW(), "ABERTO")',
      [usuarioId, usuarioNome, valorInicial]
    );
    
    console.log('\n✅ CAIXA ABERTO COM SUCESSO!');
    console.log(`Responsável: ${usuarioNome}`);
    console.log(`Valor inicial: R$ ${valorInicial.toFixed(2)}`);
    
  } catch (error) {
    console.log('❌ Erro ao abrir caixa:', error.message);
  }
}

// Menu PRINCIPAL corrigido (SEM this)
async function menu(usuarioId) {
  let opcao;
  do {
    console.clear();
    console.log('\n--- 📊 RELATÓRIOS E CAIXA ---');
    console.log('1. 💰 Abrir Caixa');
    console.log('2. 📉 Fechar Caixa e Gerar Relatório');
    console.log('3. 📈 Vendas do Dia');
    console.log('4. ⚠️ Alertas (Estoque e Validade)');
    console.log('0. 🔙 Voltar');
    
    opcao = readlineSync.question('\n> ');
    
    switch(opcao) {
      case '1':
        await abrirCaixa(usuarioId);
        break;
      case '2':
        await fecharCaixa(usuarioId); // CHAMADA DIRETA SEM this
        break;
      case '3':
        await vendasDoDia(); // CHAMADA DIRETA SEM this
        break;
      case '4':
        await alertas(); // CHAMADA DIRETA SEM this
        break;
      case '0':
        return;
      default:
        console.log('❌ Opção inválida!');
    }
    
    if (opcao !== '0') {
      readlineSync.question('\npressione ENTER para continuar...');
    }
  } while (opcao !== '0');
}

// Exportação CORRETA (sem this)
module.exports = {
  menu: menu
};