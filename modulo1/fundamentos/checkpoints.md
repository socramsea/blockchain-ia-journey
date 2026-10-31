# Checkpoints — Lição 01

## 1. Por que uma blockchain precisa de um hash encadeado?
Sua resposta: Porque o hash encadeado é o que torna o passado imutável. Cada bloco contém o hash do bloco anterior, então se alguém tenta mudar uma transação antiga, o hash daquele bloco muda e quebra a corrente. Não tem como mudar o passado sem que todo mundo veja.

## 2. O que acontece se alguém alterar um bloco no meio da corrente?
Sua resposta: O hash daquele bloco muda. Aí o bloco seguinte, que apontava para o hash antigo, quebra. E todos os blocos depois dele também. Para consertar, teria que recalcular todos os blocos seguintes — e a rede rejeita a versão adulterada porque os outros nós têm a versão original.

## 3. Qual a diferença entre "validade criptográfica" e "consenso"?
Sua resposta: Validade criptográfica é a assinatura — prova que o dono autorizou a transação (como a assinatura do engenheiro na planta). Consenso é a rede verificando se a transação obedece às regras do protocolo (como a física, o solo e o código de obras). Uma transação pode ter assinatura válida e mesmo assim ser rejeitada pela rede se violar as regras (ex: gasto duplo).
