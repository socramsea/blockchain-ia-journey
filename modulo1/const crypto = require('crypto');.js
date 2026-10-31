const crypto = require('crypto');

// ===== 1. GERAR PAR DE CHAVES (ed25519) =====
function gerarParDeChaves() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

// ===== 2. ASSINAR TRANSAÇÃO =====
function assinarTransacao(transacao, chavePrivada) {
  const dados = JSON.stringify(transacao);
  const assinatura = crypto.sign(null, Buffer.from(dados), chavePrivada);
  return assinatura.toString('base64');
}

// ===== 3. VERIFICAR ASSINATURA =====
function verificarAssinatura(transacao, assinatura, chavePublica) {
  const dados = JSON.stringify(transacao);
  return crypto.verify(
    null,
    Buffer.from(dados),
    chavePublica,
    Buffer.from(assinatura, 'base64')
  );
}

// ===== 4. BLOCO =====
class Bloco {
  constructor(indice, transacoes, hashAnterior) {
    this.indice = indice;
    this.transacoes = transacoes;
    this.hashAnterior = hashAnterior;
    this.timestamp = Date.now();
    this.hash = this.calcularHash();
  }
  calcularHash() {
    const dados = this.indice + this.timestamp + JSON.stringify(this.transacoes) + this.hashAnterior;
    return crypto.createHash('sha256').update(dados).digest('hex');
  }
}

// ===== 5. BLOCKCHAIN COM VALIDAÇÃO DE ASSINATURA =====
class Blockchain {
  constructor() {
    this.chain = [this.criarBlocoGenesis()];
    this.chavesPublicas = {};
  }
  registrarParticipante(nome, chavePublica) {
    this.chavesPublicas[nome] = chavePublica;
  }
  criarBlocoGenesis() {
    return new Bloco(0, [{ de: 'genesis', para: 'genesis', valor: 0 }], '0');
  }
  ultimoBloco() {
    return this.chain[this.chain.length - 1];
  }
  adicionarBloco(transacoes) {
    const novoBloco = new Bloco(this.chain.length, transacoes, this.ultimoBloco().hash);
    this.chain.push(novoBloco);
  }
  isValida() {
    for (let i = 1; i < this.chain.length; i++) {
      const atual = this.chain[i];
      const anterior = this.chain[i - 1];

      // Check 1: integridade do bloco
      if (atual.hash !== atual.calcularHash()) {
        console.log(`❌ Bloco ${i}: hash inválido (conteúdo adulterado)`);
        return false;
      }
      // Check 2: encadeamento
      if (atual.hashAnterior !== anterior.hash) {
        console.log(`❌ Bloco ${i}: encadeamento quebrado`);
        return false;
      }
      // Check 3: toda transação precisa de assinatura válida
      for (const tx of atual.transacoes) {
        if (tx.de === 'genesis') continue;
        const chavePublica = this.chavesPublicas[tx.de];
        if (!chavePublica) {
          console.log(`❌ Bloco ${i}: remetente "${tx.de}" não registrado`);
          return false;
        }
        const valida = verificarAssinatura(
          { de: tx.de, para: tx.para, valor: tx.valor },
          tx.assinatura,
          chavePublica
        );
        if (!valida) {
          console.log(`❌ Bloco ${i}: assinatura inválida de "${tx.de}"`);
          return false;
        }
      }
    }
    return true;
  }
}

// ===== TESTE =====
console.log('=== Gerando pares de chaves ===');
const alice = gerarParDeChaves();
const bob = gerarParDeChaves();

const chain = new Blockchain();
chain.registrarParticipante('alice', alice.publicKey);
chain.registrarParticipante('bob', bob.publicKey);

// --- Cenário 1: transação legítima, assinada pela Alice ---
console.log('\n--- Cenário 1: Alice envia 10 para Bob (assinado corretamente) ---');
const tx1 = { de: 'alice', para: 'bob', valor: 10 };
tx1.assinatura = assinarTransacao(
  { de: tx1.de, para: tx1.para, valor: tx1.valor },
  alice.privateKey
);
chain.adicionarBloco([tx1]);
console.log('Blockchain válida?', chain.isValida());

// --- Cenário 2: adulterar o valor depois de assinado ---
console.log('\n--- Cenário 2: alguém adultera o valor de 10 para 9999 ---');
chain.chain[1].transacoes[0].valor = 9999;
console.log('Blockchain válida?', chain.isValida());

// --- Cenário 3: Bob tenta assinar como se fosse Alice ---
console.log('\n--- Cenário 3: Bob forja transação dizendo que é Alice ---');
const chain2 = new Blockchain();
chain2.registrarParticipante('alice', alice.publicKey);
chain2.registrarParticipante('bob', bob.publicKey);

const tx2 = { de: 'alice', para: 'bob', valor: 10 };
tx2.assinatura = assinarTransacao(
  { de: 'alice', para: 'bob', valor: 10 },
  bob.privateKey  // ← Bob assina com a chave dele, não com a da Alice
);
chain2.adicionarBloco([tx2]);
console.log('Blockchain válida?', chain2.isValida());