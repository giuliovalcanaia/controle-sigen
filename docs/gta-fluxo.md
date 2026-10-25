# Fluxo de emissão de GTA

Mapa técnico da tela `Saída de Animais e GTA` do SIGEN+, levantado em
25/10/2026 e usado pelo driver `apps/api/src/sigen/gta.ts`.

Nenhum dado pessoal real aparece aqui. Os exemplos usam códigos genéricos.

## Onde fica a tela

- URL: `/DSA.Areas.Movimentacao/SaidaAnimais`
- A SPA carrega a tela dentro de `iframe#iframeMain` (menu **Movimentação →
  Saída de Animais e GTA**).
- A página é **ExtJS 3.4.0**, não Angular. O driver abre a SPA, clica no menu e
  trabalha no frame; abrir a URL direto não inicializa os globais da tela.

## Componentes principais

| Componente | Papel |
|---|---|
| `dtRegistro` | data do registro (hoje, somente leitura) |
| `dtSaida` | data da saída (`dd/MM/yyyy`) |
| `dtValidade` | validade da GTA (`dd/MM/yyyy`) |
| `cbLocalDestino` | `DE` = Dentro do Estado; `FE` = Fora do Estado |
| `cbMotivoSaida` | `TR` = Propriedade; `AB` = Agroindústria; `EV` = Evento |
| `cbTipoGta` | `NO` = Normal; `CO` = Contingência; `SS` = Substitutiva |
| `UnidadeExploracaoOrigem_cbUnidadeExploracao` | produtor/UEP de origem |
| `UnidadeExploracaoDestino_cbUnidadeExploracao` | produtor/UEP de destino |
| `cbFinalidadeGta` | finalidade (17 opções) |
| `cbMeioTransporteGta` | transporte (`1` = RODOVIÁRIO) |
| `cbNrManejo` | busca do animal pelo Nº Manejo (6 dígitos) |
| `gdrBrincos` | grade dos animais incluídos |
| `nrNotaFiscal`, `nrPlaca`, `nrLacre`, `dsObservacao` | opcionais |
| `nrDocumentoRegistro` | CPF/CNPJ do responsável (preenchido pela sessão) |

## Sequência que o driver executa

1. **Data da saída**: preenche `dtSaida` e dispara `change`. O callback
   `carregarDataUep` revela `cbLocalDestino`/`cbMotivoSaida` e carrega as
   opções. Sem esse callback a tela fica sem os campos de destino.
2. **Destino**: `cbLocalDestino = DE` e `cbMotivoSaida = TR`.
3. **Origem/destino**: lê o CPF em `nrDocumentoRegistro` (ou
   `window.pessoaUsuario.nrDocumento`), chama `doQuery(cpf, true)` no combo e
   seleciona o registro cujo `id_unidade_exploracao` foi resolvido no servidor
   e cuja espécie é `BOVINO`.
4. **Finalidade/transporte**: seleciona pelo texto (`ENGORDA`,
   `RODOVIÁRIO`) e guarda os IDs para a conferência.
5. **Animais**: para cada manejo, `cbNrManejo.setRawValue(manejo)` +
   `doQuery(manejo, true)`. A própria consulta inclui o animal em `gdrBrincos`.
   O driver lê `nrBrincoNovo` da última linha e compara com o brinco oficial
   de 15 dígitos; se não bater, aborta antes de salvar.
6. **Opcionais**: `nrNotaFiscal`, `nrPlaca`, `nrLacre`, `dsObservacao`.
7. **Conferência**: `window.getRecord()` devolve o payload completo. O driver
   confere origem, destino, finalidade, transporte, datas, município e a lista
   de brincos oficiais.
8. **Permissão**: `POST .../SaidaAnimais/VerificarPermissaoApoio` (somente
   leitura) devolve `exigeAnexo`, `exigeSenha`, `exigeDescricao` e
   `exigeJustificativaBloqueio`. Se qualquer um for verdadeiro, nada é salvo.
9. **Salvar**: `POST .../SaidaAnimais/Add` com o JSON do `getRecord()`.
10. **Número**: `GET .../SaidaAnimais/Get/<id>` devolve
    `data.gta.dsSerieGta` e `data.gta.nrSequenciaGta`.
11. **PDF**: `POST .../SaidaAnimais/Print` com o campo `idSaidaAnimais`
    (form-urlencoded). Se vier `application/pdf`, o arquivo é guardado em
    `data/gta/<id>.pdf`.

## Endpoints de apoio

| Endpoint | Método | Uso |
|---|---|---|
| `/DSA.Cadastros/UnidadeExploracao/QuickSearch` | **POST** (form) | busca UEPs por CPF/CNPJ |
| `/DSA.Tabelas/FinalidadeGta/ListaFinalidadesMotivoSaida` | GET | opções de finalidade |
| `/DSA.Distribuicao/Brinco/ListaAnimaisEmCampo` | GET | busca animal por manejo |
| `/DSA.Areas.Movimentacao/SaidaAnimais/VerificarPermissaoApoio` | POST JSON | requisitos extras |
| `/DSA.Areas.Movimentacao/SaidaAnimais/Add` | POST JSON | **cria a GTA** |
| `/DSA.Areas.Movimentacao/SaidaAnimais/Get/<id>` | GET | número/série e PDF disponível |
| `/DSA.Areas.Movimentacao/SaidaAnimais/Print` | POST form | PDF da GTA |

## Cuidados que o código assume

- `getRecord()` devolve `dtSaida`/`dtValidade` como objetos `Date`, não
  strings. A comparação usa o fuso `America/Sao_Paulo`.
- Os stores de `cbLocalDestino`, `cbMotivoSaida` e `cbFinalidadeGta` carregam
  de forma assíncrona. O driver espera `store.getCount() > 0` antes de
  selecionar.
- O listener de `change` de `dtSaida` precisa existir antes do preenchimento.
  O driver espera por ele e tem um fallback que dispara o evento uma vez.
- A consulta de manejo **já inclui** o animal na grade. Não há botão
  “adicionar”.
- O CPF do responsável vem da própria sessão (`nrDocumentoRegistro`). Não é
  enviado ao navegador do produtor nem gravado em log.
- Depois do `Add`, qualquer falha ambígua vira `incerta`; o app nunca repete o
  salvamento sozinho.
- O endpoint `QuickSearch` é POST. Um GET devolve 404 em HTML.

## Verificação somente leitura

```bash
npm run sigen:gta:check
```

Abre a tela, confere os componentes e o listener da data. Não preenche e não
salva. Rode depois de atualizações do SIGEN e antes de habilitar a emissão.
