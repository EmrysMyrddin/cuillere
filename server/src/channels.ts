import { Case, chan, range, recv, select, send } from '@cuillere/channels'
import { SyntaxError, gql } from 'apollo-server-core'
import { GraphQLField, GraphQLInterfaceType, GraphQLObjectType } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { CUILLERE_INSTANCE } from './schema'

export const CUILLERE_CHANNELS = Symbol('CUILLERE_CHANNELS')
export const CUILLERE_CHANNELS_SUBSCRIBERS = Symbol('CUILLERE_CHANNELS_SUBSCRIBERS')

export class ChannelDirective extends SchemaDirectiveVisitor {
  static typeDefs = gql`
    directive @channel(bufferCapacity: Int = 10) on FIELD_DEFINITION
  `

  visitFieldDefinition(field: GraphQLField<any, any>, details: { objectType: GraphQLObjectType | GraphQLInterfaceType}) {
    const { schema } = this

    if (details.objectType.name !== 'Subscription') {
      throw new SyntaxError(`@channel must be used on Subscription fields only, found on ${details.objectType.name}.${field.name}`)
    }

    if (!(CUILLERE_CHANNELS in schema)) {
      Object.defineProperty(schema, CUILLERE_CHANNELS, {
        enumerable: false,
        value: [],
        writable: false,
      })
    }

    const { bufferCapacity } = this.args

    // FIXME throw ?
    // if (field.name in schema[CUILLERE_CHANNELS])

    schema[CUILLERE_CHANNELS].push({ fieldName: field.name, bufferCapacity })

    field.subscribe = (_source, _args, context): AsyncIterableIterator<any> => {
      const ch = chan()
      context[CUILLERE_CHANNELS_SUBSCRIBERS][field.name].add(ch)
      const it = range(ch)

      // FIXME make a class for this implementation
      return {
        [Symbol.asyncIterator]() {
          return this
        },

        async next() {
          return it.next()
        },

        async return() {
          context[CUILLERE_CHANNELS_SUBSCRIBERS][field.name].delete(ch)
          return { done: true, value: null }
        },

        // FIXME throw?
      }
    }
  }
}
