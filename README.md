# Interview Practice

Requires Node 22+.

    npm install
    npm start        # http://localhost:3000

Login: `test` / `test`. Accounts are stored in SQLite (`interview.db`, override with `DB_PATH`).

## Question generation

Questions come from a built-in generator. A Claude-powered path exists but is switched off; enable it with `USE_CLAUDE=1` and `ANTHROPIC_API_KEY`.
