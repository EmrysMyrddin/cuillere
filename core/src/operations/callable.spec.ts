import cuillere, { Cuillere, OperationObject, call, callable } from '..'

describe('callable', () => {
  interface TestOperation extends OperationObject {
    message: string
  }

  const test = callable((message: string): TestOperation => ({
    kind: '@cuillere/test/test',
    message,
  }))

  let cllr: Cuillere

  beforeEach(() => {
    cllr = cuillere({
      namespace: '@cuillere/test',
      handlers: {
        * test({ message }: TestOperation) {
          return `this is a test: "${message}"`
        },
      },
    })
  })

  it('should be handled when yielded', async () => {
    function* testYielded() {
      return yield test('yielded')
    }

    await expect(cllr.call(testYielded)).resolves.toBe('this is a test: "yielded"')
  })

  it('should be handled when called', async () => {
    function* testCalled() {
      return yield call(test, 'called')
    }

    await expect(cllr.call(testCalled)).resolves.toBe('this is a test: "called"')
  })
})
