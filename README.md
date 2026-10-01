# Interview Practice

Requires Node 22+.

    npm install
    npm start        # http://localhost:3000

Login: `test` / `test`. Accounts are stored in SQLite (`interview.db`, override with `DB_PATH`).

## Question generation

Set `ANTHROPIC_API_KEY` (optionally `ANTHROPIC_MODEL`) to have Claude write the questions and the role/experience alignment check. Without it, the app falls back to a simple built-in generator.
