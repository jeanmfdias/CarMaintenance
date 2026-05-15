import { createApp } from './app.js'
import { config } from './config.js'
import { runMigrations } from './db/migrate.js'
import { cleanupAuthState } from './db/index.js'

runMigrations()

// Best-effort cleanup of expired magic-link tokens and revoked/expired
// auth sessions so those tables don't grow unbounded.
try {
  const r = cleanupAuthState()
  if (r.tokens > 0 || r.sessions > 0) {
    console.log(`[server] auth cleanup: ${r.tokens} token(s), ${r.sessions} session(s) removed`)
  }
} catch (e) {
  console.warn('[server] auth cleanup failed:', (e as Error).message)
}

const app = createApp()
app.listen(config.port, () => {
  console.log(
    `[server] listening on http://localhost:${config.port} (${config.nodeEnv}, v${config.version})`
  )
})
