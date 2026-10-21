# Resume Maker — Preview Run Doc

## Reproduce uncommitted artifacts

No artifacts to reproduce. The `.env` file already exists in the main checkout with the required `GROQ_API_KEY`.

## Run the server

Port: 3000 (default from `.env`). Start detached on Windows using PowerShell
(stdout and stderr MUST go to different files):

```
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules\@dotenvx\dotenvx\src\cli\dotenvx.js','run','--','node.exe','server.js' -RedirectStandardOutput 'C:\Users\lekhe\Documents\My-projects\Web Dev\resume-maker\.freebuff\preview.log' -RedirectStandardError 'C:\Users\lekhe\Documents\My-projects\Web Dev\resume-maker\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```

Notes learned the hard way:

- On Windows the launching command may not return within a 30s tool timeout
  (the child keeps the redirected handles open). The server still starts —
  don't assume failure; verify instead.
- Confirm the server: `curl http://localhost:3000/health` (expect 200 + JSON),
  and `powershell -NoProfile -Command "Get-Process -Id <pid>"`.
- If port 3000 is occupied, find the holder with
  `netstat -ano | findstr :3000` and kill it (`taskkill /PID <pid> /F`) only if
  it is a stale instance of this app — never kill unrelated processes.
- Restart after editing `server.js`; static files under `public/` are served
  fresh without a restart.

Health check: `GET /health` returns JSON with status, uptime, memory usage, and version.

App behavior notes (for verification):

- `/preview` (the app's preview) requires a session with generated data — a
  bare visit redirects to `/`. `/preview.html` (static) loads the page without
  a session and is the easiest way to see the iframe loader behave: with no
  data it should show "⚠️ No generated resume found…" inside each iframe,
  never an infinite "Loading...".
- The strict CSP (`script-src 'self'`) blocks inline scripts — page logic must
  stay in external files (`/js/*.js`). `frame-src` is `'self' blob:`: do NOT
  add `about:srcdoc`/`about:blank`, they are invalid CSP source expressions
  and Chrome logs warnings; srcdoc frames inherit the policy via `'self'`.
