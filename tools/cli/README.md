# Taskmate CLI

Command-line access to the same task document the web app syncs, for
scripts and agents that need to read or write tasks without a browser.
Reuses `web/src/lib/doc.ts` and `sync.ts` unmodified — a task this CLI adds
merges with the web app exactly like a second device would.

```
npx tsx tools/cli.ts help
```

or, once installed at the repo root: `npm run cli -- <command>`.

## One-time setup: a Google Cloud OAuth client for the CLI

The CLI is a **different OAuth client** than the web app's — it authorizes
itself with Google's Device Authorization Grant (RFC 8628), the flow built
for a process with no browser and no redirect URI of its own: you approve
the request on any device that does have a browser, and the CLI only ever
polls for the result.

1. console.cloud.google.com → the same project the web app's client lives
   in (or a new one — either works, since `drive.file` visibility is
   scoped to the client that created a file, not the project)
2. APIs & Services → Credentials → Create credentials → OAuth client ID
   - Application type: **TVs and Limited Input devices**
3. Copy the Client ID and Client Secret it issues. Yes, a secret — Google
   issues one for this client type too, but it isn't meant to stay
   confidential the way a server's would be; treat it like the client ID.
4. Export both wherever this CLI runs:
   ```
   export TASKMATE_CLI_CLIENT_ID=...
   export TASKMATE_CLI_CLIENT_SECRET=...
   ```
5. `npx tsx tools/cli.ts auth login` — prints a URL and a short code; open
   the URL on any device, enter the code, approve. The CLI polls until
   that happens and stores a refresh token under
   `$XDG_CONFIG_HOME/taskmate-cli` (or `~/.config/taskmate-cli`), mode 600.

## About `--create`

`drive.file` scope grants a client visibility only into files it created
itself or the user opened with it, and that is documented per *client*,
not per Cloud project. In practice this means: the very first time this
CLI's OAuth client looks for the document, it might not see the file the
web app already created — even against the same Google account — simply
because it's a different client.

Rather than guess, the CLI treats "no file found" on a fresh install as a
question, not an answer: every command that would create one refuses,
unless you pass `--create` explicitly:

```
npx tsx tools/cli.ts add "primeira tarefa" --create
```

Only do this if you're sure — either this really is the first sync ever
(no web app data exists yet), or you've confirmed the "no file" result is
correct and starting a fresh document is what you want. `--create` will
not merge with an existing web-app document it simply couldn't see; it
starts an unrelated one.

## Commands

```
auth login                 connect to Google Drive (device flow)
auth status                 show whether currently connected
auth logout                 disconnect and revoke the local token
lists                       list groups and lists, with short ids
list [--list=] [--all]      list tasks (default: inbox, pending only)
add "<title>" [--list=] [--due=YYYY-MM-DD] [--priority=0-3|baixa|media|alta] [--notes=]
done <id>                   mark a task done (accepts a short id prefix)
```

Add `--json` to any read/write command for machine-readable output —
the shape an agent driving this CLI should use instead of parsing the
human-readable text.
