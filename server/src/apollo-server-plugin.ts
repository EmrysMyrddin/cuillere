import type { ApolloServerPlugin, GraphQLRequestContextExecutionDidStart, BaseContext } from 'apollo-server-plugin-base'
import { Case, chan, recv, select, send } from '@cuillere/channels'
import { executablePromise, fork } from '@cuillere/core'

import { AsyncTaskExecutorOptions } from './task-executor'
import { CUILLERE_INSTANCE } from './schema'
import { CUILLERE_CHANNELS, CUILLERE_CHANNELS_SUBSCRIBERS } from './channels'

export type ApolloServerPluginArgs = [GraphQLRequestContextExecutionDidStart<BaseContext>]

export function apolloServerPlugin(options: AsyncTaskExecutorOptions<ApolloServerPluginArgs>): ApolloServerPlugin {
  let channels: { [fieldName: string]: any } // FIXME should not be any
  let subscribers: { [key: string]: Set<any> } // FIXME should not be Set<any>

  return {
    requestDidStart({ context }) {
      let didEncounterErrors = false

      context.channels = channels
      // FIXME this isn't executed for subscriptions so...
      context[CUILLERE_CHANNELS_SUBSCRIBERS as any] = subscribers

      return {
        // WORKAROUND: https://github.com/cuillerejs/cuillere/issues/25
        didEncounterErrors() {
          didEncounterErrors = true
        },

        executionDidStart(reqCtx) {
          const taskManager = options.taskManager(reqCtx)

          if (!taskManager) return undefined

          const [task, resolve, reject] = executablePromise()

          taskManager
            .execute(() => task, options.context(reqCtx))
            .catch(() => { /* Avoids unhandled promise rejection */ })

          return () => {
            if (didEncounterErrors) reject(true)
            else resolve()
          }
        },
      }
    },

    serverWillStart({ schema }) {
      // FIXME manage if schema[CUILLERE_CHANNELS] is undefined

      channels = Object.fromEntries(
        schema[CUILLERE_CHANNELS].map(({ fieldName, bufferCapacity }) => [fieldName, chan(bufferCapacity)]),
      )

      subscribers = Object.fromEntries(
        schema[CUILLERE_CHANNELS].map(({ fieldName }) => [fieldName, new Set()]),
      )

      let stopping = false
      let resolveServerWillStop: () => void
      const serverWillStop: Promise<void> = new Promise((resolve) => { resolveServerWillStop = resolve })

      schema[CUILLERE_INSTANCE].call(function* () {
        const stop = chan()

        const cases = Object.entries(channels)
          .map(([fieldName, input]) => [
            recv(input as any),
            function* (value) {
              for (const output of subscribers[fieldName]) {
                yield send(output, { [fieldName]: value })
              }
            },
          ] as Case)

        cases.push([recv(stop), () => { stopping = true }])

        yield fork(async function* () {
          await serverWillStop
          yield send(stop, null)
        })

        while (!stopping) {
          try {
            yield select(...cases)
          } catch (e) {
            // FIXME the loop shouldn't stop even if there's an exception
          }
        }
      })

      return {
        serverWillStop() {
          resolveServerWillStop()
        },
      }
    },
  }
}
