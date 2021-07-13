import type { PoolConnection } from 'mariadb'
import type { TaskListener, TransactionManagerType } from '@cuillere/server'

import { PoolManager, DEFAULT_POOL } from './pool-manager'
import { setQueryHandler } from './query-handler'
import type { QueryOptions } from './query-options'
import { setConnectionGetter } from './connection-getter'
import { TransactionManager, getTransactionManager } from './transaction-manager'

export function getConnectionManager({ poolManager, transactionManager }: ConnectionManagerOptions): ConnectionManager {
  if (!poolManager) throw TypeError('Connection manager needs one of poolConfig or poolManager')

  let transactionManagerType = transactionManager
  if (transactionManagerType === 'auto') transactionManagerType = Object.keys(poolManager.pools).length === 1 ? 'default' : 'two-phase'

  return new ConnectionManagerImpl(poolManager, getTransactionManager(transactionManagerType))
}

export interface ConnectionManagerOptions {
  poolManager: PoolManager
  transactionManager?: TransactionManagerType
}

export interface ConnectionManager extends TaskListener {
  end(): Promise<void>
}

class ConnectionManagerImpl implements ConnectionManager {
  private poolManager: PoolManager

  private transactionManager: TransactionManager

  private connections: Record<string, Promise<PoolConnection>>

  constructor(poolManager: PoolManager, transactionManager: TransactionManager) {
    this.poolManager = poolManager
    this.transactionManager = transactionManager
    this.connections = {}
  }

  initialize(ctx: any) {
    setConnectionGetter(ctx, name => this.getConnection(name))
    setQueryHandler(ctx, query => this.query(query))
  }

  private async query(query: QueryOptions) {
    if (query.usePoolQuery) return this.poolManager.query(query)
    return (await this.getConnection(query.pool)).query(query)
  }

  private getConnection(name = DEFAULT_POOL) {
    if (!(name in this.connections)) {
      this.connections[name] = this.poolManager.connect(name)
      if (this.transactionManager) this.connections[name] = this.transactionManager.connect(this.connections[name])
    }
    return this.connections[name]
  }

  async preComplete(result: any) {
    await this.transactionManager?.preComplete?.(await this.getConnections(), result)
  }

  async complete(result: any) {
    await this.transactionManager?.complete(await this.getConnections(), result)
  }

  async error(error: any) {
    await this.transactionManager?.error(await this.getConnections(), error)
  }

  async finalize() {
    for (const connection of await this.getConnections()) connection.release()
    this.connections = {}
  }

  private getConnections() {
    return Promise.all(Object.values(this.connections))
  }

  public end() {
    return this.poolManager.end()
  }
}
