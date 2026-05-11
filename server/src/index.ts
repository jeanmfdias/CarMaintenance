import { createApp } from './app.js'
import { config } from './config.js'
import { runMigrations } from './db/migrate.js'

runMigrations()

const app = createApp()
app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port} (${config.nodeEnv})`)
})
