# automata-simulator

Simulador de AFD (autômato finito determinístico) em Python. A definição do autômato fica em um arquivo JSON, então é possível trocar de autômato sem alterar o código.

O projeto foi feito como trabalho acadêmico: construir o AFD equivalente a um AFND e simular sua execução.

## Status

* Núcleo do simulador (leitura, validação e simulação): pronto.
* Interface gráfica com diagrama de estados e execução passo a passo: em desenvolvimento.

## Estrutura

```
dfa-simulator/
├── README.md
├── automata.py
├── test_automata.py
└── data/
    ├── automata.json
    ├── automata.example.json
    └── input.txt
```

| Arquivo | Descrição |
|---|---|
| `automata.py` | Classe `Automata`: carrega, valida e simula o autômato |
| `test_automata.py` | Script de teste manual, que imprime os resultados |
| `data/automata.json` | Autômato usado no trabalho |
| `data/automata.example.json` | Exemplo comentado, para criar o seu próprio autômato |
| `data/input.txt` | Palavras para testar no autômato |

## Requisitos

Python 3. Não há dependências externas.

## Autômato incluído

O arquivo `data/automata.json` é o AFD obtido pela conversão de um AFND com os estados q0 a q4.

* Alfabeto: `0` e `1`
* Estados: A, B, C, D, E, F, G, H, I
* Estado inicial: A
* Estados finais: D, E, F, G, H, I

Ele aceita as palavras que contêm `00` ou `11`.

## Como criar o seu próprio autômato

Copie `data/automata.example.json` e altere os valores. O arquivo tem estes campos:

| Campo | Descrição |
|---|---|
| `name` | Nome do autômato. Texto livre |
| `alphabet` | Lista de símbolos válidos. Cada símbolo tem um único caractere |
| `states` | Lista com o nome de cada estado |
| `initial_state` | Estado onde a leitura começa |
| `final_states` | Lista dos estados de aceitação |
| `transitions` | Para cada estado, o próximo estado de cada símbolo |

Exemplo (número par de zeros):

```json
{
  "name": "even_number_of_zeros",
  "alphabet": ["0", "1"],
  "states": ["q0", "q1"],
  "initial_state": "q0",
  "final_states": ["q0"],
  "transitions": {
    "q0": { "0": "q1", "1": "q0" },
    "q1": { "0": "q0", "1": "q1" }
  }
}
```

Regras verificadas por `validate_definition`:

* O alfabeto não pode ser vazio, repetir símbolos ou ter símbolos com mais de um caractere.
* O estado inicial e os estados finais precisam estar em `states`.
* Toda transição precisa partir de um estado existente, usar um símbolo do alfabeto e chegar a um estado existente.

Em um AFD, todo estado deve ter uma transição para cada símbolo do alfabeto. Essa regra ainda não é verificada pelo programa.

Chaves extras no JSON, como as que começam com underscore no arquivo de exemplo, são ignoradas.

## Métodos principais

| Método | O que faz |
|---|---|
| `get_automata(file)` | Lê o arquivo JSON. Devolve `True` ou `False` |
| `validate_definition()` | Valida a definição carregada. Devolve `True` ou `False` |
| `step(state, symbol)` | Executa um passo e devolve o registro do passo |
| `run(word)` | Simula a palavra inteira e devolve o resultado |
| `accepts(word)` | Devolve `True` se a palavra é aceita, senão `False` |
| `to_dict()` | Devolve a definição do autômato como dicionário |
| `is_valid_symbol(symbol)` | Diz se o símbolo está no alfabeto |
| `is_final(state)` | Diz se o estado é final |
| `get_next_state(state, symbol)` | Devolve o próximo estado, ou `None` se não houver transição |
| `get_initial_state()` | Devolve o estado inicial |

## Resultado de `run`

`run` devolve um dicionário:

```python
{
    "word": "01",
    "accepted": False,
    "steps": [
        {"from": "A", "symbol": "0", "to": "B", "error": None},
        {"from": "B", "symbol": "1", "to": "C", "error": None}
    ],
    "final_state": "C",
    "reason": "not_final_state",
    "error_position": None
}
```

| Campo | Descrição |
|---|---|
| `word` | Palavra testada |
| `accepted` | `True` se a palavra foi aceita |
| `steps` | Passos executados, em ordem |
| `final_state` | Estado em que a leitura parou |
| `reason` | Motivo da rejeição, ou `None` se aceita |
| `error_position` | Posição do símbolo com problema, ou `None` |

Valores possíveis de `reason`:

| Valor | Significado |
|---|---|
| `not_final_state` | A palavra foi lida por completo, mas terminou em um estado não final |
| `invalid_symbol` | A palavra tem um símbolo que não está no alfabeto |
| `undefined_transition` | Não existe transição para o estado e símbolo atuais |

Quando há erro, `steps` contém só os passos feitos antes do problema, e `error_position` indica a posição do símbolo (começando em 0).