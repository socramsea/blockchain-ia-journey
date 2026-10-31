const crypto = require('crypto');

const DIFICULDADE = 4;

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
    const dados =
      this.indice +
      this.timestamp +
      JSON.stringify(this.transacoes) +
      this.hashAnterior +
      this.nonce;
    return crypto.createHash('sha256').update(dados).digest('hex');
  }

  minerar() {
    const alvo = '0'.repeat(DIFICULDADE);
    while (true) {
      const hash = this.calcularHash();
      if (hash.startsWith(alvo)) {
        return hash;
      }
      this.nonce++;
    }
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.criarBlocoGenesis()];
  }

  criarBlocoGenesis() {
    return new Bloco(0, [{ de: 'genesis', para: 'genesis', valor: 0 }], '0');
  }

  ultimoBloco() {
    return this.chain[this.chain.length - 1];
  }

  adicionarBloco(transacoes) {
    const inicio = Date.now();
    const novoBloco = new Bloco(this.chain.length, transacoes, this.ultimoBloco().hash);
    const tempo = Date.now() - inicio;
    console.log(
      `⛏️  Bloco ${novoBloco.indice} minerado em ${tempo}ms | nonce: ${novoBloco.nonce} | hash: ${novoBloco.hash.substring(0, 20)}...`
    );
    this.chain.push(novoBloco);
  }

  isValida() {
    for (let i = 1; i < this.chain.length; i++) {
      const atual = this.chain[i];
      const anterior = this.chain[i - 1];

      if (atual.hash !== atual.calcularHash()) {
        console.log(`❌ Bloco ${i}: hash inválido`);
        return false;
      }

      const alvo = '0'.repeat(DIFICULDADE);
      if (!atual.hash.startsWith(alvo)) {
        console.log(`❌ Bloco ${i}: prova de trabalho inválida`);
        return false;
      }

      if (atual.hashAnterior !== anterior.hash) {
        console.log(`❌ Bloco ${i}: encadeamento quebrado`);
        return false;
      }
    }
    return true;
  }
}

console.log(`=== Dificuldade: ${DIFICULDADE} zeros ===\n`);

const chain = new Blockchain();

console.log('--- Adicionando blocos ---');
chain.adicionarBloco([{ de: 'alice', para: 'bob', valor: 10 }]);
chain.adicionarBloco([{ de: 'bob', para: 'carol', valor: 5 }]);
chain.adicionarBloco([{ de: 'carol', para: 'dave', valor: 2 }]);

console.log('\n--- Validação ---');
console.log('Blockchain válida?', chain.isValida());

console.log('\n--- Ataque: adulterar bloco 1 e recalcular o hash dele (sem minerar) ---');
chain.chain[1].transacoes = [{ de: 'alice', para: 'bob', valor: 9999 }];
chain.chain[1].hash = chain.chain[1].calcularHash();

console.log(
  `Hash do bloco 1 depois do "ataque": ${chain.chain[1].hash.substring(0, 20)}...`
);
console.log('Ainda começa com os zeros exigidos?', chain.chain[1].hash.startsWith('0'.repeat(DIFICULDADE)));
console.log('Blockchain válida?', chain.isValida());

console.log('\n--- Ataque 2: atacante recalcula o bloco 1 COM mineração ---');
chain.chain[1].nonce = 0;
const inicioReMineracao = Date.now();
chain.chain[1].hash = chain.chain[1].minerar();
const tempoReMineracao = Date.now() - inicioReMineracao;
console.log(`Re-mineração do bloco 1 levou ${tempoReMineracao}ms (nonce final: ${chain.chain[1].nonce})`);

console.log('\nBlockchain válida após re-minerar o bloco 1?', chain.isValida());