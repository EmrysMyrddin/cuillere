import { cuillere } from '@cuillere/core'
import { ServerContext, ServerPlugin, taskManagerPlugin } from '@cuillere/server'
import { registerCrudProvider } from '@cuillere/crud'

import { getClientManager } from './client-manager'
import { PostgresConfig } from './config'
import { buildCrud } from './crud'
import { postgresPlugin } from './plugin'
import { PoolManager } from './pool-manager'

export function postgresServerPlugin(config: PostgresConfig) {
  const poolManager = config?.poolManager ?? new PoolManager(config?.poolConfig)

  let serverWillStart: () => { serverWillStop: () => Promise<void> }
  if (!config?.poolManager) {
    serverWillStart = () => ({
      async serverWillStop() {
        await poolManager.end()
      },
    })
  }

  return (srvCtx: ServerContext): ServerPlugin => {
    registerCrudProvider(srvCtx, 'postgres', {
      build() {
        return cuillere(
          // FIXME using taskManagerPlugin means cuillere/server is not a devDependency anymore
          taskManagerPlugin(
            getClientManager({
              poolManager,
              transactionManager: 'read-only',
            }),
          ),
          postgresPlugin(),
        ).call(buildCrud)
      },
    })

    return {
      httpRequestListeners() {
        return getClientManager({
          poolManager,
          transactionManager: 'read-only',
        })
      },
      graphqlRequestListeners(reqCtx) {
        if (reqCtx.operation.operation !== 'mutation') return
        return getClientManager({
          poolManager,
          transactionManager: config?.transactionManager ?? 'auto',
        })
      },
      plugins: postgresPlugin(),
      serverWillStart,
    }
  }
}
