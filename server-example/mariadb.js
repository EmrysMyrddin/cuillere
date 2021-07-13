import cuillere from '@cuillere/core'
import { connectionPlugin, DEFAULT_POOL, getConnectionManager, PoolManager, query } from '@cuillere/mariadb'
import { taskManagerPlugin } from '@cuillere/server'

const poolConfig = {
  host: 'localhost',
  port: 33061,
  database: 'contacts',
  user: 'contacts',
  password: 'password',
}

export const poolManager = new PoolManager(poolConfig)

function* ensureDatabases() {
  yield* ensureDatabase('contacts')

  yield query({
    sql: `
          CREATE TABLE IF NOT EXISTS phones (
            id MEDIUMINT AUTO_INCREMENT NOT NULL PRIMARY KEY,
            number TEXT NOT NULL
          )
        `,
    pool: 'contacts',
  })
}

function* ensureDatabase(name) {
  yield query({ sql: `CREATE DATABASE IF NOT EXISTS ${name}` })
  yield query({ sql: `CREATE USER IF NOT EXISTS ${name} IDENTIFIED BY 'password'` })
  yield query({ sql: `GRANT ALL PRIVILEGES ON ${name}.* TO ${name}` })
}

export const initMariadb = () => cuillere(
  taskManagerPlugin(
    getConnectionManager({
      poolManager: new PoolManager([
        {
          name: DEFAULT_POOL,
          host: 'localhost',
          port: 33061,
          database: 'mysql',
          user: 'root',
          password: 'password',
        },
        {
          name: 'contacts',
          ...poolConfig,
        },
      ]),
      transactionManager: 'none',
    }),
  ),
  connectionPlugin(),
).call(ensureDatabases)
