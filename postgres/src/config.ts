import { TransactionManagerType } from '@cuillere/server'

import { PoolConfig, PoolManager } from './pool-manager'

export type PostgresConfig = {
  poolConfig?: PoolConfig | PoolConfig[]
  poolManager?: PoolManager
  transactionManager?: TransactionManagerType
}
