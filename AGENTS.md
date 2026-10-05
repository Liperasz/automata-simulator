# AGENTS.md

AFD (deterministic finite automaton) simulator — academic project. Python back end (`automata.py` + `api.py`/Flask) and a static web front end (`front/`, vanilla JS + SVG). All docs and code comments are in Portuguese.

## Run

```bash
pip install -r requirements.txt   # flask==3.1.3 (only dependency)
python api.py                     # serves on http://127.0.0.1:8000
python api.py path/to/automata.json   # optional custom automaton
```

- `.venv/` exists (Python 3.14.7) but Flask is **not installed** in it — install before running.
- `api.py` is the entrypoint; `automata.py` has no `main`.
- No build step for the front end; Flask serves `front/` statically.

## Architecture

- `automata.py` — `Automata` class: load/validate JSON, simulate words. No dependencies.
- `api.py` — Flask layer. Loads the automaton once at startup (only inside `if __name__ == '__main__'`), exposes `GET /api/automaton`, `POST /api/run`, `GET /api/words`.
- `front/` — `index.html`, `app.js`, `style.css`. Draws the state diagram from `/api/automaton` and animates `run` results.

## Gotchas

- `api.py` reads `data/input.txt` (one word per line) for `/api/words`. The front does not read this file itself.

## Contract: back/front

- The front must **not** simulate the automaton or read the JSON itself — it only calls the API and renders. No automaton logic in `front/`.
- `run()` result fields and `reason` values (`not_final_state`, `invalid_symbol`, `undefined_transition`) are a stable contract — documented in `README.md` (section `Resultado de run`).
- The program must be generic: it works with any valid JSON, tested against `data/automata.json` (9 states) and `data/automata.example.json` (2 states). Don't hardcode states A–I.

## Style & Git

- English identifiers/filenames; Portuguese comments. One function per task; constants at top of file.
- Conventional Commits (`feat(front): draw state diagram`), branch names `tipo/descricao-curta`. `main` is protected — work on a branch and open a PR.

## Testing

No test framework or test files exist (`test_automata.py` is referenced in the README but absent). Verify by running the API and exercising a word, or importing `Automata` in a REPL.
