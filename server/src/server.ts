import { Plugin } from '@cuillere/core'
import type { ContextFunction, PluginDefinition, Config as ApolloConfig } from 'apollo-server-core'
import { ApolloServer, ServerRegistration } from 'apollo-server-koa'
import Application from 'koa'
import { ExecutionParams } from 'subscriptions-transport-ws' // FIXME this package is deprecated, use graphql-ws

import { apolloServerPlugin, ApolloServerPluginArgs } from './apollo-server-plugin'
import { CUILLERE_CHANNELS, ChannelDirective } from './channels'
import { defaultContextKey } from './context'
import { koaMiddleware, KoaMiddlewareArgs } from './koa-middleware'
import { CUILLERE_CONTEXT_KEY, CUILLERE_PLUGINS, assertCuillereSchema, makeExecutableSchema } from './schema'
import { GetAsyncTaskManager } from './task-manager'

export interface CuillereConfig {
  contextKey?: string
  subscriptionTaskManager?: GetAsyncTaskManager<[{ connection: ExecutionParams }]>
  httpRequestTaskManager?: GetAsyncTaskManager<KoaMiddlewareArgs>
  graphqlRequestTaskManager?: GetAsyncTaskManager<ApolloServerPluginArgs>
  plugins: Plugin[]
}

export class CuillereServer extends ApolloServer {
  private cuillereConfig: CuillereConfig

  constructor(apolloConfig: ApolloConfig, config: CuillereConfig) {
    super(buildApolloConfig(defaultConfig(config), apolloConfig))

    this.cuillereConfig = defaultConfig(config)
  }

  applyMiddleware(serverRegistration: ServerRegistration) {
    const { httpRequestTaskManager: taskManager, contextKey } = this.cuillereConfig

    if (taskManager) {
      serverRegistration.app.use(koaMiddleware({
        context: ctx => ctx[contextKey] = {}, // eslint-disable-line no-return-assign
        taskManager,
      }))
    }

    super.applyMiddleware(serverRegistration)
  }

  listen(...args: Parameters<typeof Application.prototype.listen>) {
    const app = new Application()

    this.applyMiddleware({ app })

    const server = app.listen(...args)

    // FIXME not sure about this...
    this.installSubscriptionHandlers(server)

    return server
  }
}

function defaultConfig(config: CuillereConfig): CuillereConfig {
  return {
    ...config,
    contextKey: config.contextKey ?? defaultContextKey,
  }
}

function buildApolloConfig(config: CuillereConfig, apolloConfig: ApolloConfig): ApolloConfig {
  const apolloConfigOverride: ApolloConfig = {
    ...apolloConfig,
    plugins: mergePlugins(config, apolloConfig),
  }

  if (apolloConfigOverride.schema) {
    assertCuillereSchema(apolloConfigOverride.schema, 'apolloConfig.schema')
  } else {
    apolloConfigOverride.schema = makeExecutableSchema({
      parseOptions: apolloConfigOverride.parseOptions,
      resolvers: apolloConfigOverride.resolvers,
      schemaDirectives: mergeDirectives(apolloConfigOverride),
      typeDefs: mergeTypeDefs(apolloConfigOverride),
    })
  }

  apolloConfigOverride.schema[CUILLERE_PLUGINS] = config.plugins
  Object.defineProperty(apolloConfigOverride.schema, CUILLERE_CONTEXT_KEY, {
    enumerable: false,
    value: config.contextKey,
  })

  apolloConfigOverride.context = getContextFunction(config, apolloConfigOverride)

  return apolloConfigOverride
}

function getContextFunction({ contextKey }: CuillereConfig, { context } : ApolloConfig): ContextFunction {
  const originalContext = typeof context === 'function' ? context : () => context

  return async arg => ({
    ...await originalContext(arg),
    [contextKey]: arg.ctx?.[contextKey],
  })
}

function mergePlugins(config: CuillereConfig, { plugins } : ApolloConfig): PluginDefinition[] {
  const plugin = getApolloServerPlugin(config)

  if (plugin == null) return plugins

  return [
    ...(plugins ?? []),
    plugin,
  ]
}

function mergeTypeDefs({ typeDefs }: ApolloConfig) {
  if (typeDefs == null) return typeDefs

  const mergedTypeDefs = Array.isArray(typeDefs) ? [...typeDefs] : [typeDefs]

  mergedTypeDefs.push(ChannelDirective.typeDefs)

  return mergedTypeDefs
}

function mergeDirectives({ schemaDirectives }: ApolloConfig) {
  const mergedDirectives = schemaDirectives == null ? {} : { ...schemaDirectives }

  mergedDirectives.channel = ChannelDirective

  return mergedDirectives
}

function getApolloServerPlugin(config: CuillereConfig) {
  const { graphqlRequestTaskManager: taskManager, contextKey } = config

  if (!taskManager) return null

  return apolloServerPlugin({
    context: reqCtx => reqCtx.context[contextKey] = {}, // eslint-disable-line no-return-assign
    taskManager,
  })
}
