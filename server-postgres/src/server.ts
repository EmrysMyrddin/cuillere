import { Plugin } from '@cuillere/core'
import {
  CuillereServer as CuillereServerBase, Config as ApolloConfig, CuillereConfig as CuillereConfigBase, AsyncTaskManager, TransactionManagerType,
} from '@cuillere/server'
import { clientPlugin, getClientManager, PoolConfig, PoolManager } from '@cuillere/postgres'

export interface CuillereConfig {
    contextKey?: string
    poolConfig?: PoolConfig | PoolConfig[]
    poolManager?: PoolManager
    transactionManager?: TransactionManagerType
    plugins?: Plugin[]
}

export class CuillereServer extends CuillereServerBase {
  constructor(apolloConfig: ApolloConfig, config: CuillereConfig) {
    super(
      apolloConfig,
      buildServerConfig(config),
    )
  }
}

function buildServerConfig(config: CuillereConfig): CuillereConfigBase {
  return {
    contextKey: config?.contextKey,
    httpRequestTaskManager() {
      return new AsyncTaskManager(
        getClientManager({
          poolConfig: config?.poolConfig,
          poolManager: config?.poolManager,
          transactionManager: 'read-only',
        }),
      )
    },
    graphqlRequestTaskManager(reqCtx) {
      if (reqCtx.operation.operation !== 'mutation') return null

      return new AsyncTaskManager(
        getClientManager({
          poolConfig: config?.poolConfig,
          poolManager: config?.poolManager,
          transactionManager: config?.transactionManager ?? 'auto',
        }),
      )
    },
    plugins: mergePlugins(config),
  }
}

function mergePlugins(config: CuillereConfig) {
  return [
    clientPlugin(),
    ...(config?.plugins ?? []),
  ]
}
