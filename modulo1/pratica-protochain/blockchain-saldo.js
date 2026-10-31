const crypto = require('crypto');

const DIFICULDADE = 4;

// ===== CHAVES E ASSINATURA =====
function gerarParDeChaves() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

function assinarTransacao(tx, chavePrivada) {
  const dados = JSON.stringify({ de: tx.de, para: tx.para, valor: tx.valor });
  return crypto.sign(null, Buffer.from(dados), chavePrivada).toString('base64');
}

function verificarAssinatura(tx, assinatura, chavePublica) {
  const dados = JSON.stringify({ de: tx.de, para: tx.para, valor: tx.valor });
  return crypto.verify(null, Buffer.from(dados), chavePublica, Buffer.from(assinatura, 'base64'));
}

// ===== BLOCO =====
class Bloco {
  constructor(indice, transacoes, hashAnterior) {
    this.indice = indice;
    this.transacoes = transacoes;
    this.hashAnterior = hashAnterior;
    this.timestamp = Date.now();
    this.nonce = 0;
    this.hash = this.minerar();
  }
  calcularHash() {
    const dados = this.indice + this.timestamp + JSON.stringify(this.transacoes) + this.hashAnterior + this.nonce;
    return crypto.createHash('sha256').update(dados).digest('hex');
  }
  minerar() {
    const alvo = '0'.repeat(DIFICULDADE);
    while (true) {
      const hash = this.calcularHash();
      if (hash.startsWith(alvo)) return hash;
      this.nonce++;
    }
  }
}

// ===== BLOCKCHAIN =====
class Blockchain {
  constructor() {
    this.chain = [this.criarBlocoGenesis()];
    this.chavesPublicas = {};
  }

  registrarParticipante(nome, chavePublica) {
    this.chavesPublicas[nome] = chavePublica;
  }

  criarBlocoGenesis() {
    // Genesis distribui 100 moedas para Alice (o "criador" do sistema)
    return new Bloco(0, [{ de: 'genesis', para: 'alice', valor: 100 }], '0');
  }

  ultimoBloco() {
    return this.chain[this.chain.length - 1];
  }

  adicionarBloco(transacoes) {
    const inicio = Date.now();
    const novoBloco = new Bloco(this.chain.length, transacoes, this.ultimoBloco().hash);
    const tempo = Date.now() - inicio;
    console.log(`⛏️  Bloco ${novoBloco.indice} minerado em ${tempo}ms | nonce: ${novoBloco.nonce}`);
    this.chain.push(novoBloco);
  }

  saldoDe(nome) {
    let saldo = 0;
    for (const bloco of this.chain) {
      for (const tx of bloco.transacoes) {
        if (tx.de === 'genesis') {
          if (tx.para === nome) saldo += tx.valor;
        } else {
          if (tx.de === nome) saldo -= tx.valor;
          if (tx.para === nome) saldo += tx.valor;
        }
      }
    }
    return saldo;
  }

  isValida() {
    const saldos = {}; // saldo "em construção" enquanto percorre os blocos

    for (let i = 0; i < this.chain.length; i++) {
      const atual = this.chain[i];
      const anterior = this.chain[i - 1];

      // --- Checks de integridade (só para blocos após genesis) ---
      if (i > 0) {
        if (atual.hash !== atual.calcularHash()) {
          console.log(`❌ Bloco ${i}: hash inválido (conteúdo adulterado)`);
          return false;
        }
        if (!atual.hash.startsWith('0'.repeat(DIFICULDADE))) {
          console.log(`❌ Bloco ${i}: prova de trabalho inválida`);
          return false;
        }
        if (atual.hashAnterior !== anterior.hash) {
          console.log(`❌ Bloco ${i}: encadeamento quebrado`);
          return false;
        }
      }

      // --- Checks de transação (assinatura + saldo) ---
      for (const tx of atual.transacoes) {
        if (tx.de === 'genesis') {
          saldos[tx.para] = (saldos[tx.para] || 0) + tx.valor;
          continue;
        }

        // Assinatura
        const chavePublica = this.chavesPublicas[tx.de];
        if (!chavePublica) {
          console.log(`❌ Bloco ${i}: remetente "${tx.de}" não registrado`);
          return false;
        }
        if (!verificarAssinatura(tx, tx.assinatura, chavePublica)) {
          console.log(`❌ Bloco ${i}: assinatura inválida de "${tx.de}"`);
          return false;
        }

        // Saldo
        const saldoAtual = saldos[tx.de] || 0;
        if (saldoAtual < tx.valor) {
          console.log(
            `❌ Bloco ${i}: "${tx.de}" tenta enviar ${tx.valor} mas só tem ${saldoAtual} (double spend)`
          );
          return false;
        }

        // Aplica a transação ao estado
        saldos[tx.de] = saldoAtual - tx.valor;
        saldos[tx.para] = (saldos[tx.para] || 0) + tx.valor;
      }
    }
    return true;
  }
}

// ===== HELPER =====
function setup() {
  const alice = gerarParDeChaves();
  const bob = gerarParDeChaves();
  const carol = gerarParDeChaves();
  const chain = new Blockchain();
  chain.registrarParticipante('alice', alice.publicKey);
  chain.registrarParticipante('bob', bob.publicKey);
  chain.registrarParticipante('carol', carol.publicKey);
  return { chain, alice, bob, carol };
}

// ===== CENÁRIO 1: transferência válida =====
console.log('=== Cenário 1: Alice envia 30 para Bob (válido) ===');
{
  const { chain, alice } = setup();
  console.log(`Alice tem ${chain.saldoDe('alice')} (genesis)`);
  const tx = { de: 'alice', para: 'bob', valor: 30 };
  tx.assinatura = assinarTransacao(tx, alice.privateKey);
  chain.adicionarBloco([tx]);
  console.log('Blockchain válida?', chain.isValida());
  console.log(`Saldos finais → Alice: ${chain.saldoDe('alice')} | Bob: ${chain.saldoDe('bob')}`);
}

// ===== CENÁRIO 2: tentar gastar mais do que tem =====
console.log('\n=== Cenário 2: Alice tenta enviar 150 para Bob (só tem 100) ===');
{
  const { chain, alice } = setup();
  const tx = { de: 'alice', para: 'bob', valor: 150 };
  tx.assinatura = assinarTransacao(tx, alice.privateKey);
  chain.adicionarBloco([tx]);
  console.log('Blockchain válida?', chain.isValida());
}

// ===== CENÁRIO 3: double spend no MESMO bloco =====
console.log('\n=== Cenário 3: Alice tenta enviar 60 p/ Bob E 60 p/ Carol no mesmo bloco (só tem 100) ===');
{
  const { chain, alice } = setup();
  const txA = { de: 'alice', para: 'bob', valor: 60 };
  txA.assinatura = assinarTransacao(txA, alice.privateKey);
  const txB = { de: 'alice', para: 'carol', valor: 60 };
  txB.assinatura = assinarTransacao(txB, alice.privateKey);
  chain.adicionarBloco([txA, txB]);
  console.log('Blockchain válida?', chain.isValida());
}