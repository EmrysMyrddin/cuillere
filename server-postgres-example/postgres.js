import { buildCrud, cuillere, clientPlugin, DEFAULT_POOL, getClientManager, mergeCruds, PoolManager, query, taskManagerPlugin } from '@cuillere/server-postgres'

const poolConfig = [
  {
    name: 'identity',
    host: 'localhost',
    port: 54321,
    database: 'identity',
    user: 'identity',
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

export const poolManager = new PoolManager(poolConfig)

function* ensureDatabase(name) {
  const { rowCount } = yield query({ text: 'SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1', values: [name] })
  if (rowCount === 0) {
    yield query({ text: `CREATE DATABASE ${name}` })
    yield query({ text: `CREATE USER ${name} WITH ENCRYPTED PASSWORD 'password'` })
    yield query({ text: `GRANT ALL PRIVILEGES ON DATABASE ${name} TO ${name}` })
  }
}

function* ensureDatabases() {
  yield* ensureDatabase('geo')
  yield* ensureDatabase('identity')

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

  yield query({
    text: `
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL NOT NULL PRIMARY KEY,
        firstname TEXT NOT NULL,
        lastname TEXT NOT NULL,
        "addressId" INT NOT NULL
      )
    `,
    pool: 'identity',
  })
}

export const initPostgres = () => cuillere(
  taskManagerPlugin(
    getClientManager({
      poolConfig: [
        {
          name: DEFAULT_POOL,
          host: 'localhost',
          port: 54321,
          database: 'postgres',
          user: 'postgres',
          password: 'password',
        },
        ...poolConfig,
      ],
      transactionManager: 'none',
    }),
  ),
  clientPlugin(),
).call(ensureDatabases)

export const initCrud = () => cuillere(
  taskManagerPlugin(
    getClientManager({ poolManager }),
  ),
  clientPlugin(),
).call(function* () {
  return mergeCruds(yield buildCrud())
})
