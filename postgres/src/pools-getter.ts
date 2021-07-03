const POOLS_GETTER = Symbol('POOLS_GETTER')

export function getPoolsGetter(ctx: any): PoolsGetter {
  return ctx[POOLS_GETTER]
}

export function setPoolsGetter(ctx: any, poolsGetter: PoolsGetter) {
  ctx[POOLS_GETTER] = poolsGetter
}

export interface PoolsGetter {
  (): string[]
}
