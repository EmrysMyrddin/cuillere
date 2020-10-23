import { GraphQLDate, GraphQLDateTime } from 'graphql-iso-date'
import { query } from '@cuillere/postgres'

const simpleResolvers = {
  Query: {
    * hello(_, { name }) {
      const { rows: [{ now }] } = yield query({ text: 'SELECT NOW()', pool: 'people' })
      return `Hello ${name} (${now})`
    },
    wait: async () => new Promise(resolve => setTimeout(resolve, 5000)),
    * now() {
      const { rows: [{ now }] } = yield query({ text: 'SELECT NOW()', pool: 'geo' })
      return now
    },
  },
}

export const resolvers = [
  { Date: GraphQLDate, DateTime: GraphQLDateTime },
  simpleResolvers,
]
