// comandos/auth.js
const readlineSync = require('readline-sync');
const db = require('../db');
const bcrypt = require('bcryptjs');

// Função de login
exports.login = async () => {
  console.log('\n--- LOGIN ---');
  const email = readlineSync.question('E-mail: ').trim();
  const senha = readlineSync.question('Senha: ', { hideEchoBack: true });

  if (!email || !senha) {
    console.log('⚠️ E-mail e senha são obrigatórios.');
    return null;
  }

  try {
    const [usuarios] = await db.execute('SELECT id, nome, perfil, senha FROM usuarios WHERE email = ?', [email]);
    
    if (usuarios.length === 0) {
      console.log('❌ E-mail ou senha inválidos.');
      return null;
    }

    const user = usuarios[0];
    const valido = await bcrypt.compare(senha, user.senha);

    if (!valido) {
      console.log('❌ E-mail ou senha inválidos.');
      return null;
    }

    console.log(`✅ Login bem-sucedido! Bem-vindo, ${user.nome}.`);
    return {
      id: user.id,
      nome: user.nome,
      perfil: user.perfil
    };
  } catch (err) {
    console.error('Erro no login:', err.message);
    return null;
  }
};

// Função de cadastro
exports.cadastrar = async () => {
  console.log('\n--- CADASTRO DE USUÁRIO ---');
  const nome = readlineSync.question('Nome: ').trim();
  const email = readlineSync.question('E-mail: ').trim();
  const senha = readlineSync.question('Senha: ', { hideEchoBack: true });
  const perfilOp = readlineSync.question('Perfil (1=Admin, 2=Gerente, 3=Atendente): ').trim();

  const perfilMap = { '1': 'administrador', '2': 'gerente', '3': 'atendente' };
  const perfil = perfilMap[perfilOp] || 'atendente';

  if (!nome || !email || !senha) {
    console.log('⚠️ Todos os campos são obrigatórios.');
    return;
  }

  try {
    const hashed = await bcrypt.hash(senha, 10);
    await db.execute(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [nome, email, hashed, perfil]
    );
    console.log('✅ Usuário cadastrado com sucesso!');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log('⚠️ E-mail já cadastrado.');
    } else {
      console.error('❌ Erro ao cadastrar:', err.message);
    }
  }

  async function excluirUsuario(usuarioId) {
    console.clear();
    console.log('=== 🗑️ EXCLUIR USUÁRIO ===\n');
    
    // Verificar se usuário é administrador
    const [admins] = await db.execute(
      'SELECT cargo FROM usuarios WHERE id = ? AND cargo = "admin"',
      [usuarioId]
    );
    
    if (admins.length === 0) {
      console.log('\n❌ Apenas administradores podem excluir usuários.');
      readlineSync.question('\nPressione ENTER para continuar...');
      return;
    }
    
    const idAlvo = parseInt(readlineSync.question('ID do usuário a ser excluído: '));
    
    if (isNaN(idAlvo) || idAlvo <= 0) {
      console.log('\n❌ ID inválido.');
      readlineSync.question('\nPressione ENTER para continuar...');
      return;
    }
    
    // Evitar autoexclusão
    if (idAlvo === usuarioId) {
      console.log('\n❌ Você não pode excluir sua própria conta enquanto estiver logado.');
      readlineSync.question('\nPressione ENTER para continuar...');
      return;
    }
    
    try {
      // Verificar se usuário existe
      const [usuarios] = await db.execute(
        'SELECT id, nome, cargo FROM usuarios WHERE id = ?',
        [idAlvo]
      );
      
      if (usuarios.length === 0) {
        console.log('\n❌ Usuário não encontrado.');
        readlineSync.question('\nPressione ENTER para continuar...');
        return;
      }
      
      const usuario = usuarios[0];
      
      // Proteger usuários administradores
      if (usuario.cargo === 'admin') {
        console.log('\n⚠️ ATENÇÃO: Este é um usuário ADMINISTRADOR.');
        console.log('Excluir administradores pode afetar a gestão do sistema.');
        const forcarExclusao = readlineSync.keyInYN('Deseja realmente excluir este administrador?');
        if (!forcarExclusao) {
          console.log('\n❌ Exclusão cancelada.');
          readlineSync.question('\nPressione ENTER para continuar...');
          return;
        }
      }
      
      console.log(`\nUsuário a ser excluído: ${usuario.nome}`);
      console.log(`Cargo: ${usuario.cargo === 'admin' ? 'Administrador' : 'Operador'}`);
      
      const confirmar = readlineSync.keyInYN('\nTem certeza ABSOLUTA que deseja EXCLUIR permanentemente este usuário?');
      
      if (confirmar) {
        await db.execute('DELETE FROM usuarios WHERE id = ?', [idAlvo]);
        console.log(`\n✅ Usuário ${usuario.nome} excluído permanentemente!`);
        await log.registrar(usuarioId, 'Usuário excluído', `Usuário ID ${idAlvo} (${usuario.nome}) excluído`);
      } else {
        console.log('\n❌ Exclusão cancelada.');
      }
      
    } catch (error) {
      console.log('\n❌ Erro ao excluir usuário:', error.message);
    }
    
    readlineSync.question('\nPressione ENTER para continuar...');
  }

};