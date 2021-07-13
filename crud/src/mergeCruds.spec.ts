import { mergeCruds } from '.'

describe('mergeCruds', () => {
  it('simple case', () => {
    const result = mergeCruds([{
      postgres: {
        pool: {
          schema: { table: { operator } },
        },
      },
    }])

    expect(result).toEqual({
      table: { operator },
      schema: { table: { operator } },
      pool: {
        table: { operator },
        schema: { table: { operator } },
      },
      postgres: {
        table: { operator },
        schema: { table: { operator } },
        pool: {
          table: { operator },
          schema: { table: { operator } },
        },
      },
    })
  })

  it('duplicate fields', () => {
    const result = mergeCruds([{
      postgres: {
        pool: {
          schema: { table: { zob: operator } },
          schema2: { table: { ha: operator } },
        },
      },
    }])

    expect(result).toEqual({
      schema: { table: { zob: operator } },
      schema2: { table: { ha: operator } },
      pool: {
        schema: { table: { zob: operator } },
        schema2: { table: { ha: operator } },
      },
      postgres: {
        schema: { table: { zob: operator } },
        schema2: { table: { ha: operator } },
        pool: {
          schema: { table: { zob: operator } },
          schema2: { table: { ha: operator } },
        },
      },
    })
  })

  it('already defined fields', () => {
    const result = mergeCruds([{
      postgres: {
        pool: {
          test: { test: { test: operator } },
        },
      },
    }])

    expect(result).toEqual({
      test: { test: { test: operator } },
      pool: {
        test: { test: { test: operator } },
      },
      postgres: {
        test: { test: { test: operator } },
        pool: {
          test: { test: { test: operator } },
        },
      },
    })
  })
})

const operator = () => ({ kind: 'test' })
