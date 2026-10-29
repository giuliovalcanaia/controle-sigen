# Glossário

Vocabulário do domínio usado no código e nas conversas. Sem dados pessoais.

| Termo | Significado |
|---|---|
| **Brinco** | O **Nº Manejo** de 6 dígitos, o número que o produtor vê e chama de brinco. Preserve os zeros à esquerda (`067836`). |
| **Brinco oficial** | O número de 15 dígitos do SIGEN. É a chave estável do animal (apelido, foto, histórico). Nunca use o manejo como chave. |
| **UEP** | Unidade de Exploração Pecuária. Uma propriedade pode ter mais de uma; a GTA tem uma única origem. |
| **Propriedade** | Identificada pelo **código oficial** (`42-000165623`), com localidade, município e UF. |
| **Viagem** | A saída de um conjunto de animais de uma propriedade numa data. Identidade = origem + animais + `dataSaida`. Placa, nota, finalidade, destino, transporte e validade são atributos, não identidade. |
| **Emissão** | Criar a GTA no SIGEN (`POST /SaidaAnimais/Add`). É um documento oficial e não pode ser desfeito pelo app. |
| **Conferência** | Preencher e validar a tela do SIGEN sem salvar (`GTA_EMISSAO_ATIVA=0`). Nunca emite. |
| **Reserva** | Claim atômico da viagem antes de abrir o navegador. Enquanto existe uma reserva ativa, a mesma viagem não pode ser emitida de novo. |
| **Incerta** | O `Add` pode ter sido aceito e a resposta ficou ambígua. Bloqueia a viagem até o produtor conferir no SIGEN. |
| **Não emitida** | O produtor conferiu no SIGEN e confirmou que a GTA incerta **não** foi emitida. Libera uma nova tentativa. |
| **Finalidade / Transporte** | Listas fixas da tela oficial (`ENGORDA`, `RODOVIÁRIO`, ...). Vêm de `/api/gta/opcoes`. |
