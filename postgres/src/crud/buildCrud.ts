import { all } from '@cuillere/core'
import { Crud, Database, Provider } from '@cuillere/crud'

import { getPools, query } from '../plugin'

export function* buildCrud() {
  const postgres: Provider = {}

  const pools = yield getPools()

  yield all(pools.map(function* (pool: string) {
    postgres[pool] = yield buildDatabaseCrud(pool)
  }))

  return { postgres } as Crud
}

function* buildDatabaseCrud(pool: string) {
  const databaseCrud: Database = {}

  const { rows: tables } = yield query({
    text: `
      SELECT table_schema AS schema, table_name AS table
      FROM information_schema.tables
      WHERE table_schema NOT LIKE 'pg_%'
      AND table_schema <> 'information_schema'
    `,
    pool,
  })

  for (const { table, schema } of tables) {
    if (!(schema in databaseCrud)) databaseCrud[schema] = {}
    databaseCrud[schema][table] = yield buildTableCrud(pool, schema, table)
  }

  return databaseCrud
}

function* buildTableCrud(pool: string, schema: string, table: string) {
  const { rows: columns } = yield query({
    text: `
      SELECT column_name AS name, data_type AS type
      FROM information_schema.columns
      WHERE table_schema = $1
      AND table_name = $2
    `,
    values: [schema, table],
    pool,
  })

  return {
    * get(id: any) {
      const { rows } = yield query({
        text: `
          SELECT ${columns.map(({ name }) => `"${name}"`).join(', ')}
          FROM "${schema}"."${table}"
          WHERE id = $1
        `,
        values: [id],
        pool,
      })

      return rows[0]
    },
  }
}
