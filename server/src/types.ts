import { ServerPlugin } from './server-plugin'

export interface CuillereConfig {
  contextKey?: string
  plugins?: ((srvCtx: ServerContext) => ServerPlugin)[]
}

export type ServerContext = Map<any, any>

export type OneOrMany<T> = T | T[]

export type ValueOrPromise<T> = T | Promise<T>
