import { GeneratorFunction } from '../generator'
import { call } from './call'
import { Operation, Wrapper, isKind, isOperation } from './operation'

export function fork<Args extends any[], R>(func: GeneratorFunction<Args, R>, ...args: Args): Wrapper<Operation>
export function fork<Args extends any[], R>(operation: Operation): Wrapper<Operation>

export function fork<Args extends any[], R>(arg0: Operation | GeneratorFunction<Args, R>, ...args: Args) {
  return { kind: 'fork', operation: isOperation(arg0) ? arg0 : call(arg0, ...args) }
}

export const isFork = isKind<Wrapper>('fork')
