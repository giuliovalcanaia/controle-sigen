# Segurança

O SIGEN Campo lida com credenciais do SIGEN, dados de propriedades e um documento oficial (a GTA). Por isso, alguns cuidados são deliberados:

- A senha do SIGEN fica só no servidor (`.env` ou secret do Docker) ou em uma sessão local salva por `npm run sigen:login`. Ela nunca vai para o navegador do produtor.
- O CPF do produtor vem da sessão e não sai do servidor. O CPF de terceiro é usado apenas para localizar a UEP de destino, não é gravado e aparece mascarado no histórico.
- PDFs do SIGEN e da GTA contêm dados pessoais. Eles ficam em `fixtures/private/` e `data/`, ambos fora do git.
- A emissão de GTA fica desligada por padrão (`GTA_EMISSAO_ATIVA=0`). Depois do salvamento, o app nunca repete a operação sozinho.

## Relatar uma falha

Não abra uma issue pública com CPF, telefone, endereço, PDF, foto de animal ou print da tela do SIGEN. Envie um relato privado ao mantenedor pelo perfil do GitHub ([@giuliovalcanaia](https://github.com/giuliovalcanaia)) com:

- versão ou commit afetado;
- passos para reproduzir, sem dados pessoais;
- impacto esperado.

Se a falha envolver a emissão de GTA, não tente reproduzir em produção. Use `GTA_EMISSAO_ATIVA=0` e o modo mock.
