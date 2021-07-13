import type { Middleware, ParameterizedContext, DefaultState, DefaultContext } from 'koa'

import { AsyncTaskExecutorOptions } from './task-executor'

export type KoaMiddlewareArgs = [ParameterizedContext<DefaultState, DefaultContext>]

export function koaMiddleware(options: AsyncTaskExecutorOptions<KoaMiddlewareArgs>): Middleware {
  return async (ctx, next) => {
    const taskManager = options.taskManager(ctx)
    if (taskManager == null) return next()

    try {
      await taskManager.execute(next, options.context(ctx))
    } catch (e) {
      // Avoids unhandled promise rejection
    }
  }
}
