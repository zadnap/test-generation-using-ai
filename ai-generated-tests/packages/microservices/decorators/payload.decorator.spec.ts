import { PARAM_ARGS_METADATA } from '../../../../packages/microservices/constants.js';
import { Payload } from '../../../../packages/microservices/decorators/payload.decorator.js';
import { RpcParamtype } from '../../../../packages/microservices/enums/rpc-paramtype.enum.js';

class TestPipe {
  public transform(value: unknown) {
    return value;
  }
}

const schema = { parse: (value: unknown) => value };

const payloadKey = (index: number) => `${RpcParamtype.PAYLOAD}:${index}`;
const metadataOf = (target: Function, key = 'test') =>
  Reflect.getMetadata(PARAM_ARGS_METADATA, target, key);

/**
 * CFG / C3 of Payload: the exported function has no decisions of its own; it
 * forwards `(propertyOrPipe, optionsOrPipe, ...pipes)` to
 * createPipesRpcParamDecorator. Every documented argument shape is exercised:
 * no data, property key, pipe class, pipe instance, property + pipes,
 * options object with schema and options object with pipes.
 */
describe('Payload', () => {
  it('registers an empty payload entry without arguments', () => {
    class Controller {
      public test(@Payload() payload: any) {}
    }

    expect(metadataOf(Controller)).toEqual({
      [payloadKey(0)]: { index: 0, data: undefined, pipes: [] },
    });
  });

  it('treats an explicit undefined exactly like no argument', () => {
    class Controller {
      public test(@Payload(undefined) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });

  it('extracts a single property from the payload', () => {
    class Controller {
      public test(@Payload('data') payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: 'data',
      pipes: [],
    });
  });

  it('registers a pipe class', () => {
    class Controller {
      public test(@Payload(TestPipe) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: undefined,
      pipes: [TestPipe],
    });
  });

  it('registers a pipe instance', () => {
    const pipe = new TestPipe();
    class Controller {
      public test(@Payload(pipe) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: undefined,
      pipes: [pipe],
    });
  });

  it('registers a property together with a pipe instance', () => {
    const pipe = new TestPipe();
    class Controller {
      public test(@Payload('data', pipe) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: 'data',
      pipes: [pipe],
    });
  });

  it('registers a property together with several pipes in order', () => {
    const pipe = new TestPipe();
    class Controller {
      public test(@Payload('data', pipe, TestPipe) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: 'data',
      pipes: [pipe, TestPipe],
    });
  });

  it('registers an explicit undefined property together with a pipe', () => {
    const pipe = new TestPipe();
    class Controller {
      public test(@Payload(undefined, pipe) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: undefined,
      pipes: [pipe],
    });
  });

  it('registers a schema passed as the only argument', () => {
    class Controller {
      public test(@Payload({ schema }) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
      schema,
    });
  });

  it('registers pipes carried inside the options object', () => {
    class Controller {
      public test(@Payload({ schema, pipes: [TestPipe] }) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: undefined,
      pipes: [TestPipe],
      schema,
    });
  });

  it('registers a property together with an options object', () => {
    class Controller {
      public test(@Payload('data', { schema }) payload: any) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: 'data',
      pipes: [],
      schema,
    });
  });

  it('registers a property with options pipes and extra positional pipes', () => {
    class Controller {
      public test(
        @Payload('data', { schema, pipes: [TestPipe] }) payload: any,
      ) {}
    }

    expect(metadataOf(Controller)[payloadKey(0)]).toEqual({
      index: 0,
      data: 'data',
      pipes: [TestPipe],
      schema,
    });
  });

  it('does not mistake a pipe instance exposing a schema field for options', () => {
    class SchemaAwarePipe {
      public schema = schema;
      public transform(value: unknown) {
        return value;
      }
    }
    const pipe = new SchemaAwarePipe();
    class Controller {
      public test(@Payload(pipe) payload: any) {}
    }

    const entry = metadataOf(Controller)[payloadKey(0)];

    expect(entry.data).toBeUndefined();
    expect(entry.pipes).toEqual([pipe]);
    expect(entry.schema).toBeUndefined();
  });

  it('keeps one entry per decorated parameter on the same method', () => {
    class Controller {
      public test(
        @Payload() first: any,
        @Payload('data') second: any,
        @Payload(TestPipe) third: any,
      ) {}
    }

    const metadata = metadataOf(Controller);

    expect(Object.keys(metadata).sort()).toEqual([
      payloadKey(0),
      payloadKey(1),
      payloadKey(2),
    ]);
    expect(metadata[payloadKey(1)].data).toBe('data');
    expect(metadata[payloadKey(2)].pipes).toEqual([TestPipe]);
  });

  it('returns a parameter decorator for every overload', () => {
    expect(Payload()).toBeTypeOf('function');
    expect(Payload('data')).toBeTypeOf('function');
    expect(Payload(TestPipe)).toBeTypeOf('function');
    expect(Payload({ schema })).toBeTypeOf('function');
  });
});
