import { Plugin } from '@cuillere/core'
import type { ContextFunction, PluginDefinition, Config as ApolloConfig } from 'apollo-server-core'
import { ApolloServer, ServerRegistration } from 'apollo-server-koa'
import Application from 'koa'

import { apolloServerPlugin } from './apollo-server-plugin'
import { koaMiddleware } from './koa-middleware'
import { defaultContextKey } from './context'
import { CUILLERE_CONTEXT_KEY, CUILLERE_PLUGINS, isCuillereSchema, makeExecutableSchema } from './schema'
import { makeAsyncTaskManagerGetterFromListenerGetters, ServerPlugin } from './server-plugin'
import { CuillereConfig, ServerContext } from './types'

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
        context: ctx => ctx[this.cuillereConfig.contextKey] = {},
        taskManager: makeAsyncTaskManagerGetterFromListenerGetters(listenerGetters),
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
    context: getContextFunction(apolloConfig, config, plugins),
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

function getContextFunction({ context }: ApolloConfig, { contextKey }: CuillereConfig, plugins: ServerPlugin[]): ContextFunction {
  let pluginsContext: ContextFunction

  const pluginsContexts = plugins
    .filter(plugin => plugin.graphqlContext != null)
    .map(plugin => plugin.graphqlContext)
  if (pluginsContexts.length !== 0) {
    pluginsContext = async (arg) => {
      const contexts = await Promise.all(pluginsContexts.map(v => (typeof v === 'function' ? v(arg) : v)))
      return Object.assign({}, ...contexts)
    }
  }

  if (typeof context === 'function') {
    return async arg => ({
      ...await context(arg),
      [contextKey]: arg.ctx?.[contextKey], // FIXME subscriptions?
      ...await pluginsContext?.(arg),
    })
  }

  return async arg => ({
    ...context,
    [contextKey]: arg.ctx?.[contextKey], // FIXME subscriptions?
    ...await pluginsContext?.(arg),
  })
}

function mergeApolloPlugins(apolloConfig: ApolloConfig, config: CuillereConfig, plugins: ServerPlugin[]): PluginDefinition[] {
  const plugin = apolloServerPlugin(config, plugins)

  if (!plugin) return apolloConfig.plugins

  return [
    ...(apolloConfig.plugins ?? []),
    plugin,
  ]
}

function getCuillerePlugins(plugins: ServerPlugin[]): Plugin[] {
  return plugins.flatMap(plugin => plugin.plugins ?? [])
}
