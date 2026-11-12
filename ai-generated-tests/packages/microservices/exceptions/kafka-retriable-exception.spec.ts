import { GrpcStatus } from '../../../../packages/microservices/enums/grpc-status.enum.js';
import { GrpcException } from '../../../../packages/microservices/exceptions/grpc-exception.js';
import { KafkaRetriableException } from '../../../../packages/microservices/exceptions/kafka-retriable-exception.js';
import { RpcException } from '../../../../packages/microservices/exceptions/rpc-exception.js';

/**
 * CFG / C3 of KafkaRetriableException.getError: single return, no decisions.
 * The returned value is the exception itself, which is the control signal the
 * Kafka driver (and BaseRpcExceptionFilter) use to redeliver the message.
 */
describe('KafkaRetriableException.getError', () => {
  it('returns the very same instance for a string payload', () => {
    const exception = new KafkaRetriableException('retry me');

    const error = exception.getError();

    expect(error).toBe(exception);
    expect(error).toBeInstanceOf(KafkaRetriableException);
  });

  it('returns the very same instance for an object payload', () => {
    const exception = new KafkaRetriableException({ reason: 'db down' });

    expect(exception.getError()).toBe(exception);
  });

  it('keeps the Error contract inherited from RpcException', () => {
    const exception = new KafkaRetriableException('retry me');

    expect(exception).toBeInstanceOf(RpcException);
    expect(exception).toBeInstanceOf(Error);
    expect(exception.message).toBe('retry me');
  });

  it('is not confused with a GrpcException body shape', () => {
    const exception = new KafkaRetriableException('retry me');

    expect(exception instanceof GrpcException).toBe(false);
    expect((exception.getError() as any).code).toBeUndefined();
  });

  it('reports the payload when the nested error is already an RpcException', () => {
    const inner = new RpcException({ code: GrpcStatus.ABORTED });
    const exception = new KafkaRetriableException(inner);

    expect(exception.getError()).toBe(exception);
  });
});
