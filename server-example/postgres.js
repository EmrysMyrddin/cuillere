import cuillere from '@cuillere/core'
import { postgresPlugin, DEFAULT_POOL, getClientManager, PoolManager, query } from '@cuillere/postgres'
import { taskManagerPlugin } from '@cuillere/server'

export const poolConfig = [
  {
    name: 'people',
    host: 'localhost',
    port: 54321,
    database: 'people',
    user: 'people',
    password: 'password',
  },
  {
    name: 'geo',
    host: 'localhost',
    port: 54321,
    database: 'geo',
    user: 'geo',
    password: 'password',
  },
]

const poolManager = new PoolManager(poolConfig)

function* ensureDatabase(name) {
  const { rowCount } = yield query({ text: 'SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1', values: [name] })
  if (rowCount === 0) {
    yield query({ text: `CREATE DATABASE ${name}` })
    yield query({ text: `CREATE USER ${name} WITH ENCRYPTED PASSWORD 'password'` })
    yield query({ text: `GRANT ALL PRIVILEGES ON DATABASE ${name} TO ${name}` })
  }
}

function* ensureDatabases() {
  yield* ensureDatabase('people')

  // FIXME champ adresse
  yield query({
    text: `
          CREATE TABLE IF NOT EXISTS people (
            id SERIAL NOT NULL PRIMARY KEY,
            firstname TEXT NOT NULL,
            lastname TEXT NOT NULL
          )
        `,
    pool: 'people',
  })

  //  FIXME relation NN téléphone

  yield* ensureDatabase('geo')

  yield query({
    text: `
          CREATE TABLE IF NOT EXISTS addresses (
            id SERIAL NOT NULL PRIMARY KEY,
            number TEXT NOT NULL,
            street TEXT NOT NULL,
            postalcode TEXT NOT NULL,
            city TEXT NOT NULL
          )
        `,
    pool: 'geo',
  })
}

export const initPostgres = async () => {
  const poolManager = new PoolManager([
    {
      name: DEFAULT_POOL,
      host: 'localhost',
      port: 54321,
      database: 'postgres',
      user: 'postgres',
      password: 'password',
    },
    ...poolConfig,
  ])

  try {
    await cuillere(
      taskManagerPlugin(
        getClientManager({
          poolManager,
          transactionManager: 'none',
        }),
      ),
      postgresPlugin(),
    ).call(ensureDatabases)
  } finally {
    await poolManager.end()
  }
}
