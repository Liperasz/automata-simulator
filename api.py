import os
import sys

from flask import Flask, jsonify, request, send_from_directory

from automata import Automata

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONT_DIR = os.path.join(BASE_DIR, 'front')
WORDS_FILE = os.path.join(BASE_DIR, 'data', 'input.txt')
DEFAULT_AUTOMATA = os.path.join(BASE_DIR, 'data', 'automata.json')

HOST = '127.0.0.1'
PORT = 8000

app = Flask(__name__, static_folder=None)
automata = Automata()
load_error = None


def load_automata(path):
    global load_error
    if not automata.get_automata(path):
        load_error = f"Não foi possível ler o autômato em '{path}'."
        return
    if not automata.validate_definition():
        load_error = f"A definição do autômato em '{path}' é inválida."


def read_words():
    if not os.path.exists(WORDS_FILE):
        return []
    with open(WORDS_FILE, 'r', encoding='utf-8') as file:
        lines = [line.strip() for line in file]
    return [line for line in lines if line]


def unavailable():
    return jsonify({'error': load_error}), 503


@app.get('/')
def index():
    return send_from_directory(FRONT_DIR, 'index.html')


@app.get('/<path:name>')
def assets(name):
    return send_from_directory(FRONT_DIR, name)


@app.get('/api/automaton')
def get_automaton():
    if load_error:
        return unavailable()
    return jsonify(automata.to_dict())


@app.post('/api/run')
def run_word():
    if load_error:
        return unavailable()
    body = request.get_json(silent=True) or {}
    word = body.get('word')
    if not isinstance(word, str):
        return jsonify({'error': 'O campo "word" é obrigatório e deve ser texto.'}), 400
    return jsonify(automata.run(word))


@app.get('/api/words')
def get_words():
    return jsonify(read_words())


if __name__ == '__main__':
    load_automata(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_AUTOMATA)
    print(f'Abra http://{HOST}:{PORT} no navegador')
    app.run(host=HOST, port=PORT)
