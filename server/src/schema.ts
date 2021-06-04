import { cuillere, Cuillere, isGeneratorFunction, Plugin } from '@cuillere/core'
import { GraphQLResolveInfo, GraphQLSchema } from 'graphql'
import {
  IExecutableSchemaDefinition,
  IResolvers,
  addResolveFunctionsToSchema,
  buildSchemaFromTypeDefinitions,
  forEachField,
  makeExecutableSchema as originalMakeExecutableSchema,
} from 'graphql-tools'
import mergeDeep from 'graphql-tools/dist/mergeDeep'
import { defaultContextKey } from './context'
import { wrapFieldResolvers } from './wrap-field-resolvers'

const CUILLERE_SCHEMA = Symbol('CUILLERE_SCHEMA')
export const CUILLERE_PLUGINS = Symbol('CUILLERE_PLUGINS')
export const CUILLERE_INSTANCE = Symbol('CUILLERE_INSTANCE')
export const CUILLERE_CONTEXT_KEY = Symbol('CUILLERE_CONTEXT_KEY')

export interface CuillereSchema extends GraphQLSchema {
  [CUILLERE_SCHEMA]: true
  [CUILLERE_INSTANCE]?: Cuillere
  [CUILLERE_CONTEXT_KEY]?: string
}

export function makeExecutableSchema<TContext extends any>(definition: IExecutableSchemaDefinition<TContext>): CuillereSchema {
  let { resolvers } = definition

  if (resolvers) {
    resolvers = wrapFieldResolvers(resolvers)
    resolvers = addDefaultFieldResolvers(resolvers, definition)
  }

  const schema = originalMakeExecutableSchema({
    ...definition,
    resolvers,
  })

  Object.defineProperties(schema, {
    [CUILLERE_SCHEMA]: {
      enumerable: false,
      value: true,
      writable: false,
    },
    [CUILLERE_PLUGINS]: {
      enumerable: false,
      set(plugins: Plugin[]) {
        Object.defineProperty(this, CUILLERE_INSTANCE, {
          enumerable: false,
          value: cuillere(...plugins),
        })
      },
    },
  })

  return schema as CuillereSchema
}

export function isCuillereSchema(schema: GraphQLSchema): schema is CuillereSchema {
  return CUILLERE_SCHEMA in schema
}

export function assertCuillereSchema(schema: GraphQLSchema, reference = 'schema') {
  if (!isCuillereSchema(schema)) throw new TypeError(`\`${reference}\` should be a \`CuillereSchema\``)
}

// FIXME add a test
export function addDefaultFieldResolvers(resolvers: IResolvers | IResolvers[], definition: IExecutableSchemaDefinition): IResolvers {
  const resolversWithDefaultResolvers = Array.isArray(resolvers) ? resolvers.reduce<IResolvers>(mergeDeep, {}) : resolvers

  const draftSchema = buildSchemaFromTypeDefinitions(definition.typeDefs, definition.parseOptions)

  addResolveFunctionsToSchema({
    schema: draftSchema,
    resolvers: resolversWithDefaultResolvers,
  })

  forEachField(draftSchema, (field, typeName, fieldName) => {
    if (typeName === 'Subscription') return
    if (field.resolve === undefined) {
      if (!(typeName in resolversWithDefaultResolvers)) resolversWithDefaultResolvers[typeName] = {}
      resolversWithDefaultResolvers[typeName][fieldName] = defaultFieldResolver
    }
  })

  return resolversWithDefaultResolvers
}

/**
 * This is based on https://github.com/graphql/graphql-js/blob/960f207390615588111a4cf0238e62403c9c7eed/src/execution/execute.js#L1161
 */
function defaultFieldResolver<TSource, TContext, TArgs = { [argName: string]: any }>(
  source: TSource,
  args: TArgs,
  ctx: TContext,
  info: GraphQLResolveInfo,
) {
  if (isObjectLike(source) || typeof source === 'function') {
    const value = source[info.fieldName]
    if (typeof value === 'function') {
      if (isGeneratorFunction(value)) {
        assertCuillereSchema(info.schema, 'info.schema')
        return info.schema[CUILLERE_INSTANCE].ctx(ctx[info.schema[CUILLERE_CONTEXT_KEY] ?? defaultContextKey]).call(value, args, ctx, info)
      }
      return value(args, ctx, info)
    }
    return value
  }
}

function isObjectLike(value: any): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
