const crypto = require('crypto');

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
    const novoBloco = new Bloco(this.chain.length, transacoes, this.ultimoBloco().hash);
    this.chain.push(novoBloco);
  }

  isValida() {
    for (let i = 1; i < this.chain.length; i++) {
      const atual = this.chain[i];
      const anterior = this.chain[i - 1];

      if (atual.hash !== atual.calcularHash()) {
        console.log(`❌ Bloco ${i}: hash inválido (conteúdo foi alterado)`);
        return false;
      }

      if (atual.hashAnterior !== anterior.hash) {
        console.log(`❌ Bloco ${i}: hashAnterior não corresponde ao hash do bloco ${i-1}`);
        return false;
      }
    }
    return true;
  }
}

// ===== TESTE =====
const minhaBlockchain = new Blockchain();

minhaBlockchain.adicionarBloco([{ de: 'alice', para: 'bob', valor: 10 }]);
minhaBlockchain.adicionarBloco([{ de: 'bob', para: 'carol', valor: 5 }]);

console.log('--- Blockchain completa ---');
console.log(JSON.stringify(minhaBlockchain.chain, null, 2));

console.log('\n--- Validação ---');
console.log('Blockchain válida?', minhaBlockchain.isValida());

// ===== ATAQUE =====
console.log('\n--- Tentando adulterar o bloco 1 ---');
minhaBlockchain.chain[1].transacoes = [{ de: 'alice', para: 'bob', valor: 9999 }];

console.log('Blockchain válida após adulteração?', minhaBlockchain.isValida());