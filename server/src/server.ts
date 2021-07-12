import { Plugin } from '@cuillere/core'
import type { ContextFunction, PluginDefinition, Config as ApolloConfig } from 'apollo-server-core'
import { ApolloServer, ServerRegistration } from 'apollo-server-koa'
import Application from 'koa'

import { apolloServerPlugin } from './apollo-server-plugin'
import { AsyncTaskManager, TaskListener } from './task-manager'
import { koaMiddleware } from './koa-middleware'
import { defaultContextKey } from './context'
import { CUILLERE_CONTEXT_KEY, CUILLERE_PLUGINS, isCuillereSchema, makeExecutableSchema } from './schema'
import { ServerPlugin } from './server-plugin'

export interface CuillereConfig {
  contextKey?: string
  plugins?: ((srvCtx: ServerContext) => ServerPlugin)[]
}

export type ServerContext = Map<any, any>

export class CuillereServer extends ApolloServer {
  private cuillereConfig: CuillereConfig

  private serverContext: ServerContext

  private serverPlugins: ServerPlugin[]

  constructor(apolloConfig: ApolloConfig, configInput: CuillereConfig) {
    const config = defaultConfig(configInput)
    const srvCtx: ServerContext = new Map()
    const plugins: ServerPlugin[] = config.plugins?.map(plugin => plugin(srvCtx)) ?? []

    super(buildApolloConfig(apolloConfig, config, plugins))

    this.cuillereConfig = config
    this.serverContext = srvCtx
    this.serverPlugins = plugins
  }

  applyMiddleware(serverRegistration: ServerRegistration) {
    const listenerGetters = this.serverPlugins.flatMap(plugin => plugin.httpRequestListeners ?? [])

    if (listenerGetters.length !== 0) {
      serverRegistration.app.use(koaMiddleware({
        context: ctx => ctx[this.cuillereConfig.contextKey] = {}, // eslint-disable-line no-return-assign
        taskManager(...args) {
          const listeners = listenerGetters
            .map(listenerGetter => listenerGetter(...args))
            .filter((listener): listener is TaskListener => listener != null)
          if (listeners.length === 0) return
          return new AsyncTaskManager(...listeners)
        },
      }))
    }

    super.applyMiddleware(serverRegistration)
  }

  listen(...args: Parameters<typeof Application.prototype.listen>) {
    const app = new Application()

    this.applyMiddleware({ app })

    return app.listen(...args)
  }
}

function defaultConfig(config: CuillereConfig): CuillereConfig {
  return {
    ...config,
    contextKey: config.contextKey ?? defaultContextKey,
  }
}

function buildApolloConfig(apolloConfig: ApolloConfig, config: CuillereConfig, plugins: ServerPlugin[]): ApolloConfig {
  const apolloConfigOverride: ApolloConfig = {
    ...apolloConfig,
    context: getContextFunction(apolloConfig, config),
    plugins: mergeApolloPlugins(apolloConfig, config, plugins),
  }

  if (apolloConfig.schema) {
    if (!isCuillereSchema(apolloConfig.schema)) {
      throw new Error('To make an executable schema, please use `makeExecutableSchema` from `@cuillere/server`.')
    }
  } else {
    apolloConfigOverride.schema = makeExecutableSchema({
      parseOptions: apolloConfig.parseOptions,
      resolvers: apolloConfig.resolvers,
      schemaDirectives: apolloConfig.schemaDirectives, // possibility to add directives...
      typeDefs: apolloConfig.typeDefs, // possibility to extend typeDefs...
    })
  }

  apolloConfigOverride.schema[CUILLERE_PLUGINS] = getCuillerePlugins(plugins)
  apolloConfigOverride.schema[CUILLERE_CONTEXT_KEY] = config.contextKey

  return apolloConfigOverride
}

function getContextFunction({ context } : ApolloConfig, { contextKey }: CuillereConfig): ContextFunction {
  if (typeof context === 'function') {
    return async arg => ({
      ...await context(arg),
      [contextKey]: arg.ctx?.[contextKey], // FIXME subscriptions?
    })
  }

  return ({ ctx }) => ({
    ...context,
    [contextKey]: ctx?.[contextKey], // FIXME subscriptions?
  })
}

function mergeApolloPlugins(apolloConfig: ApolloConfig, config: CuillereConfig, plugins: ServerPlugin[]): PluginDefinition[] {
  const plugin = getApolloServerPlugin(config, plugins)

  if (!plugin) return plugins

  return [
    ...(apolloConfig.plugins ?? []),
    plugin,
  ]
}

function getApolloServerPlugin(config: CuillereConfig, plugins: ServerPlugin[]) {
  const listenerGetters = plugins.flatMap(plugin => plugin.graphqlRequestListeners ?? [])

  if (listenerGetters.length === 0) return null

  return apolloServerPlugin({
    context: reqCtx => reqCtx.context[config.contextKey] = {}, // eslint-disable-line no-return-assign
    taskManager(...args) {
      const listeners = listenerGetters
        .map(listenerGetter => listenerGetter(...args))
        .filter((listener): listener is TaskListener => listener != null)
      if (listeners.length === 0) return
      return new AsyncTaskManager(...listeners)
    },
  })
}

function getCuillerePlugins(plugins: ServerPlugin[]): Plugin[] {
  return plugins.flatMap(plugin => plugin.plugins ?? [])
}
