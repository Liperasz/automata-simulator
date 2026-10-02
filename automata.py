import json

# classe principal que instancia o automata
class Automata:

    def __init__(self):

        # variáveis gerais do automata
        self._name = None
        self._states = []
        self._alphabet = []
        self._transitions = {}
        self._final_states = []
        self._initial_state = None

    # le o arquivo json e instancia o automata
    def get_automata(self, file):
        try:
            with open(file, 'r', encoding='utf-8') as input_file:
                automata = json.load(input_file)

            self._name = automata.get('name')
            self._states = automata.get("states", [])
            self._alphabet = automata.get("alphabet", [])
            self._transitions = automata.get("transitions", {})
            self._final_states = automata.get("final_states", [])
            self._initial_state = automata.get("initial_state")

            return True

        except FileNotFoundError:
            print(f"[Erro] O arquivo '{file}' não foi encontrado.")
            return False

        except json.JSONDecodeError as err:
            print(f"[Erro] Falha ao decodificar o JSON no arquivo '{file}': {err}")
            return False

        except Exception as err:
            print(f"[Erro inesperado]: {err}")
            return False

    # verifica se o alfabeto é válido
    def _validate_alphabet(self):

        # o alfabeto não pode estar vazio
        if not self._alphabet:
            print('O alfabeto está vazio')
            return False

        # cada símbolo precisa ser uma string de exatamente um caractere
        for symbol in self._alphabet:
            if not isinstance(symbol, str) or len(symbol) != 1:
                print(f'Símbolo {symbol!r} do alfabeto não é um único caractere')
                return False

        # não pode haver símbolos repetidos
        duplicates = {symbol for symbol in self._alphabet if self._alphabet.count(symbol) > 1}
        if duplicates:
            print(f'O alfabeto contém símbolos repetidos: {sorted(duplicates)}')
            return False

        return True

    # verifica se o estado inicial pertence à lista de estados
    def _validate_initial_state(self):
        if self._initial_state in self._states:
            return True
        else:
            print(f'Estado inicial {self._initial_state} não está na lista de estados {self._states}')
            return False

    # verifica se todos os estados finais pertencem à lista de estados
    def _validate_final_state(self):

        # guarda os finais que não existem na lista de estados
        invalid = [state for state in self._final_states if state not in self._states]

        if not invalid:
            return True
        else:
            print(f'Estados finais {invalid} não estão na lista de estados {self._states}')
            return False

    # verifica as transações
    def _validate_transitions(self):

        # o formato esperado é um dicionário: estado para símbolo para próximo estado
        if not isinstance(self._transitions, dict):
            print('As transições devem ser um dicionário (estado para símbolo para próximo estado)')
            return False

        for source, moves in self._transitions.items():

            # o estado de origem precisa existir
            if source not in self._states:
                print(f'Transição parte do estado {source}, que não está na lista de estados')
                return False

            # as transições de cada estado também precisam ser um dicionário
            if not isinstance(moves, dict):
                print(f'As transições do estado {source} devem ser um dicionário (símbolo para próximo estado)')
                return False

            for symbol, target in moves.items():

                # o símbolo precisa pertencer ao alfabeto
                if symbol not in self._alphabet:
                    print(f'Transição de {source} usa o símbolo {symbol!r}, que não está no alfabeto {self._alphabet}')
                    return False

                # o destino precisa existir
                if target not in self._states:
                    print(f'Transição de {source} com {symbol!r} aponta para {target}, que não está na lista de estados')
                    return False

        return True

    # chama todas as validações
    def validate_definition(self):

        checks = [
            self._validate_alphabet,
            self._validate_initial_state,
            self._validate_final_state,
            self._validate_transitions,
        ]

        for check in checks:
            if not check():
                return False

        return True

    # diz se o símbolo pertence ao alfabeto
    def is_valid_symbol(self, symbol):
        return symbol in self._alphabet

    # diz se o estado é de aceitação
    def is_final(self, state):
        return state in self._final_states

    # devolve o próximo estado
    def get_next_state(self, state, symbol):
        return self._transitions.get(state, {}).get(symbol)

    # devolve o estado inicial
    def get_initial_state(self):
        return self._initial_state

    # executa um passo da simulação
    def step(self, state, symbol):

        # o símbolo precisa pertencer ao alfabeto
        if not self.is_valid_symbol(symbol):
            return {"from": state, "symbol": symbol, "to": None, "error": "invalid_symbol"}

        next_state = self.get_next_state(state, symbol)

        # se não existir transição, o destino é None
        if next_state is None:
            return {"from": state, "symbol": symbol, "to": None, "error": "undefined_transition"}

        return {"from": state, "symbol": symbol, "to": next_state, "error": None}

    # percorre a palavra inteira e monta o resultado
    def run(self, word):

        state = self.get_initial_state()
        steps = []

        for position, symbol in enumerate(word):
            current_step = self.step(state, symbol)

            # se o passo deu erro, para aqui e devolve o percurso parcial
            if current_step["error"] is not None:
                return {
                    "word": word,
                    "accepted": False,
                    "steps": steps,
                    "final_state": state,
                    "reason": current_step["error"],
                    "error_position": position,
                }

            steps.append(current_step)
            state = current_step["to"]

        # a palavra foi lida por completo, então aceita se parou em um estado final
        accepted = self.is_final(state)

        return {
            "word": word,
            "accepted": accepted,
            "steps": steps,
            "final_state": state,
            "reason": None if accepted else "not_final_state",
            "error_position": None,
        }

    # devolve apenas se a palavra é aceita ou não
    def accepts(self, word):
        return self.run(word)["accepted"]

    # devolve o automata como dicionário
    def to_dict(self):
        return {
            "name": self._name,
            "alphabet": list(self._alphabet),
            "states": list(self._states),
            "initial_state": self._initial_state,
            "final_states": list(self._final_states),
            "transitions": {state: dict(moves) for state, moves in self._transitions.items()},
        }

automata = Automata()
automata.get_automata('automata.json')