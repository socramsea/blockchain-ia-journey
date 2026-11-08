const crypto = require('crypto');

const DIFICULDADE = 3; // reduzido para rodar rápido; conceito é o mesmo

// ===== BLOCO (reutilizado) =====
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

  criarBlocoGenesis() {
    return new Bloco(0, [{ de: 'genesis', para: 'alice', valor: 100 }], '0');
  }

  registrarParticipante(nome, chavePublica) {
    this.chavesPublicas[nome] = chavePublica;
  }

  ultimoBloco() {
    return this.chain[this.chain.length - 1];
  }

  adicionarBloco(transacoes) {
    const novo = new Bloco(this.chain.length, transacoes, this.ultimoBloco().hash);
    this.chain.push(novo);
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
    const saldos = {};
    for (let i = 0; i < this.chain.length; i++) {
      const atual = this.chain[i];
      const anterior = this.chain[i - 1];
      if (i > 0) {
        if (atual.hash !== atual.calcularHash()) return false;
        if (!atual.hash.startsWith('0'.repeat(DIFICULDADE))) return false;
        if (atual.hashAnterior !== anterior.hash) return false;
      }
      for (const tx of atual.transacoes) {
        if (tx.de === 'genesis') {
          saldos[tx.para] = (saldos[tx.para] || 0) + tx.valor;
          continue;
        }
        const pub = this.chavesPublicas[tx.de];
        if (!pub) return false;
        const dados = JSON.stringify({ de: tx.de, para: tx.para, valor: tx.valor });
        const ok = crypto.verify(null, Buffer.from(dados), pub, Buffer.from(tx.assinatura, 'base64'));
        if (!ok) return false;
        if ((saldos[tx.de] || 0) < tx.valor) return false;
        saldos[tx.de] = (saldos[tx.de] || 0) - tx.valor;
        saldos[tx.para] = (saldos[tx.para] || 0) + tx.valor;
      }
    }
    return true;
  }
}

// ===== CARTEIRA (o coração da Lição 06) =====
class Carteira {
  constructor(nome, blockchain) {
    this.nome = nome;
    this.blockchain = blockchain;

    // 1. Gera par de chaves
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    this.chavePublica = publicKey;
    this.chavePrivada = privateKey;

    // 2. Deriva endereço = hash curto da chave pública
    this.endereco = crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .substring(0, 16);

    // 3. Registra no blockchain (assim a rede sabe verificar a assinatura)
    blockchain.registrarParticipante(nome, publicKey);
  }

  saldo() {
    return this.blockchain.saldoDe(this.nome);
  }

  // Assina e envia uma transação
  enviar(destinatario, valor) {
    // 1. Checa saldo local antes de gastar trabalho
    if (this.saldo() < valor) {
      throw new Error(`Saldo insuficiente: ${this.saldo()} < ${valor}`);
    }

    // 2. Monta transação
    const tx = { de: this.nome, para: destinatario, valor };

    // 3. Assina com a chave privada
    const dados = JSON.stringify({ de: tx.de, para: tx.para, valor: tx.valor });
    tx.assinatura = crypto.sign(null, Buffer.from(dados), this.chavePrivada).toString('base64');

    // 4. Envia para a rede (adiciona ao próximo bloco)
    this.blockchain.adicionarBloco([tx]);

    return tx;
  }
}

// ===== DEMONSTRAÇÃO =====
console.log('=== Inicializando rede ===');
const chain = new Blockchain();

console.log('\n=== Criando carteiras ===');
const alice = new Carteira('alice', chain);
const bob = new Carteira('bob', chain);
const carol = new Carteira('carol', chain);

console.log(`Alice → endereço: ${alice.endereco}`);
console.log(`Bob   → endereço: ${bob.endereco}`);
console.log(`Carol → endereço: ${carol.endereco}`);

console.log('\n=== Saldos iniciais ===');
console.log(`Alice: ${alice.saldo()}`);
console.log(`Bob:   ${bob.saldo()}`);

console.log('\n=== Alice envia 30 para Bob ===');
const tx1 = alice.enviar('bob', 30);
console.log(`Tx hash (assinatura): ${tx1.assinatura.substring(0, 30)}...`);

console.log('\n=== Saldos após envio ===');
console.log(`Alice: ${alice.saldo()}`);
console.log(`Bob:   ${bob.saldo()}`);

console.log('\n=== Bob envia 10 para Carol ===');
bob.enviar('carol', 10);

console.log('\n=== Saldos finais ===');
console.log(`Alice: ${alice.saldo()}`);
console.log(`Bob:   ${bob.saldo()}`);
console.log(`Carol: ${carol.saldo()}`);

console.log('\n=== Validação final ===');
console.log('Blockchain válida?', chain.isValida());

console.log('\n=== Tentativa de fraude: Bob tenta enviar 999 (só tem 20) ===');
try {
  bob.enviar('carol', 999);
} catch (e) {
  console.log(`🛑 Bloqueado pela carteira: ${e.message}`);
}