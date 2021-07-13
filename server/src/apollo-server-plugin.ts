import type {
  ApolloServerPlugin,
  GraphQLRequestContextExecutionDidStart,
  BaseContext,
  GraphQLServiceContext,
  GraphQLServerListener,
} from 'apollo-server-plugin-base'
import { executablePromise } from '@cuillere/core'

import { CuillereConfig, ValueOrPromise } from './types'
import { makeAsyncTaskManagerGetterFromListenerGetters, ServerPlugin } from './server-plugin'
import { GetAsyncTaskManager } from './task-manager'

export type ApolloServerPluginArgs = [GraphQLRequestContextExecutionDidStart<BaseContext>]

export function apolloServerPlugin(config: CuillereConfig, plugins: ServerPlugin[]): ApolloServerPlugin {
  let getTaskManager: GetAsyncTaskManager<ApolloServerPluginArgs>

  const listenerGetters = plugins.flatMap(plugin => plugin.graphqlRequestListeners ?? [])
  if (listenerGetters.length !== 0) getTaskManager = makeAsyncTaskManagerGetterFromListenerGetters(listenerGetters)

  let serverWillStart: (service: GraphQLServiceContext) => ValueOrPromise<GraphQLServerListener>

  const serverWillStarts = plugins
    .filter(plugin => plugin.serverWillStart != null)
    .map(plugin => plugin.serverWillStart)
  if (serverWillStarts.length !== 0) {
    serverWillStart = async (srvCtx) => {
      const srvListeners = await Promise.all(serverWillStarts.map(fn => fn(srvCtx)))
      const serverWillStops = srvListeners
        .filter((srvListener): srvListener is GraphQLServerListener => srvListener != null)
        .filter(srvListener => srvListener.serverWillStop != null)
        .map(srvListener => srvListener.serverWillStop)
      if (serverWillStops.length === 0) return
      return {
        async serverWillStop() {
          await Promise.all(serverWillStops.map(fn => fn()))
        },
      }
    }
  }

  if (getTaskManager == null && serverWillStart == null) return null

  function getContext(reqCtx: GraphQLRequestContextExecutionDidStart<BaseContext>) {
    return reqCtx.context[config.contextKey] = {}
  }

  return {
    serverWillStart,

    requestDidStart() {
      let didEncounterErrors = false

      return {
        // WORKAROUND: https://github.com/cuillerejs/cuillere/issues/25
        didEncounterErrors() {
          didEncounterErrors = true
        },

        executionDidStart(reqCtx) {
          const taskManager = getTaskManager(reqCtx)

          if (!taskManager) return undefined

          const [task, resolve, reject] = executablePromise()

          taskManager
            .execute(() => task, getContext(reqCtx))
            .catch(() => { /* Avoids unhandled promise rejection */ })

          return () => {
            if (didEncounterErrors) reject(true)
            else resolve()
          }
        },
      }
    },
  }
}
