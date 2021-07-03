import { Plugin, OperationObject } from '@cuillere/core'

import { getQueryHandler } from '../query-handler'
import type { QueryConfig } from '../query-config'
import { getClientGetter } from '../client-getter'
import { getPoolsGetter } from '../pools-getter'

const namespace = '@cuillere/postgres'

export function clientPlugin(): Plugin {
  return {
    namespace,

    handlers: {
      async* getClient({ name }: GetClient, ctx) {
        const getClient = getClientGetter(ctx)
        if (!getClient) throw new Error('No client getter in context, you probably forgot to setup a client manager')
        return getClient(name)
      },

      async* query({ config }: Query, ctx) {
        const queryHandler = getQueryHandler(ctx)
        if (!queryHandler) throw new Error('No query handler in context, you probably forgot to setup a client manager')
        return queryHandler(config)
      },

      async* getPools(_: OperationObject, ctx) {
        const getPools = getPoolsGetter(ctx)
        if (!getPools) throw new Error('No pools getter in context, you probably forgot to setup a client manager')
        return getPools()
      },
    },
  }
}

export interface GetClient extends OperationObject {
  name?: string
}

export function getClient(name?: string): GetClient {
  return { kind: `${namespace}/getClient`, name }
}

export interface Query extends OperationObject {
  config: QueryConfig
}

export function query(config: QueryConfig): Query {
  return { kind: `${namespace}/query`, config }
}

export function getPools(): OperationObject {
  return { kind: `${namespace}/getPools` }
}
