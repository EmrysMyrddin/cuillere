import { Middleware } from "./middleware"
import {getLocation, call, cancel, fork, Run} from '../cuillere'

const BATCHED_CALL = Symbol('BATCHED_CALL')
const BATCH_CTX = Symbol('BATCH_CTX')

interface Context {
  [BATCH_CTX]?: Map<any, BatchEntry>
}

interface BatchedCall {
  [BATCHED_CALL]: true,
  fn: any,
  args: any[],
  location: string,
}

const isBatchedCall = (operation: any): operation is BatchedCall =>
  operation && operation[BATCHED_CALL]

export const batchedCall = (fn: any, ...args: any[]): BatchedCall => ({
  [BATCHED_CALL]: true,
  fn,
  args,
  location: getLocation()
})

const EXECUTE_BATCH = Symbol('EXECUTE_BATCH')

interface ExecuteBatch {
  [EXECUTE_BATCH]: true,
  fn: any
}

const isExecuteBatch = (operation: any): operation is ExecuteBatch =>
  operation && operation[EXECUTE_BATCH]

const executeBatch = (fn): ExecuteBatch => ({
  [EXECUTE_BATCH]: true,
  fn
})

interface BatchEntry {
  fork: Run
  resolves: ((res: any) => void)[]
  args: any[][]
}

async function* delayBatchExecution(delay: number, fn: any) {
  await new Promise(resolve => setTimeout(resolve, delay))
  yield executeBatch(fn)
}

export const batchMiddelware = ({ timeout = 10 } = {}): Middleware =>
  function* batchMiddelware(operation, ctx: Context, next) {
    if(!ctx[BATCH_CTX]) ctx[BATCH_CTX] = new Map<any, BatchEntry>()

    if(isBatchedCall(operation)) {
      const newFork = yield fork(call(delayBatchExecution, timeout, operation.fn))

      let entry: any
      if(ctx[BATCH_CTX].has(operation.fn)) {
        entry = ctx[BATCH_CTX].get(operation.fn)
        cancel(entry.fork)
      } else {
        entry = { resolves: [], args: [], fork: newFork }
        ctx[BATCH_CTX].set(operation.fn, entry)
      }

      entry.fork = newFork
      entry.args.push(operation.args)
      return new Promise(resolve => entry.resolves.push(resolve))
    }

    if(isExecuteBatch(operation)) {
      const entry = ctx[BATCH_CTX].get(operation.fn)
      const result = yield call(operation.fn, ...entry.args)
      entry.resolves.forEach((resolve, i) => resolve(result[i]))
      return
    }

    return yield next(operation)
  }