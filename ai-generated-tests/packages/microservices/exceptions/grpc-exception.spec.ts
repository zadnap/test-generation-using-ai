import { GrpcStatus } from '../../../../packages/microservices/enums/grpc-status.enum.js';
import {
  GrpcAbortedException,
  GrpcAlreadyExistsException,
  GrpcCancelledException,
  GrpcDataLossException,
  GrpcDeadlineExceededException,
  GrpcException,
  GrpcFailedPreconditionException,
  GrpcInternalException,
  GrpcInvalidArgumentException,
  GrpcNotFoundException,
  GrpcOutOfRangeException,
  GrpcPermissionDeniedException,
  GrpcResourceExhaustedException,
  GrpcUnauthenticatedException,
  GrpcUnavailableException,
  GrpcUnimplementedException,
  GrpcUnknownException,
} from '../../../../packages/microservices/exceptions/grpc-exception.js';

type GrpcCtor = new (message?: string) => GrpcException;

const SUB_CLASSES: Array<[string, GrpcCtor, GrpcStatus, string]> = [
  [
    'GrpcCancelledException',
    GrpcCancelledException,
    GrpcStatus.CANCELLED,
    'Cancelled',
  ],
  ['GrpcUnknownException', GrpcUnknownException, GrpcStatus.UNKNOWN, 'Unknown'],
  [
    'GrpcInvalidArgumentException',
    GrpcInvalidArgumentException,
    GrpcStatus.INVALID_ARGUMENT,
    'Invalid argument',
  ],
  [
    'GrpcDeadlineExceededException',
    GrpcDeadlineExceededException,
    GrpcStatus.DEADLINE_EXCEEDED,
    'Deadline exceeded',
  ],
  [
    'GrpcNotFoundException',
    GrpcNotFoundException,
    GrpcStatus.NOT_FOUND,
    'Not found',
  ],
  [
    'GrpcAlreadyExistsException',
    GrpcAlreadyExistsException,
    GrpcStatus.ALREADY_EXISTS,
    'Already exists',
  ],
  [
    'GrpcPermissionDeniedException',
    GrpcPermissionDeniedException,
    GrpcStatus.PERMISSION_DENIED,
    'Permission denied',
  ],
  [
    'GrpcResourceExhaustedException',
    GrpcResourceExhaustedException,
    GrpcStatus.RESOURCE_EXHAUSTED,
    'Resource exhausted',
  ],
  [
    'GrpcFailedPreconditionException',
    GrpcFailedPreconditionException,
    GrpcStatus.FAILED_PRECONDITION,
    'Failed precondition',
  ],
  ['GrpcAbortedException', GrpcAbortedException, GrpcStatus.ABORTED, 'Aborted'],
  [
    'GrpcOutOfRangeException',
    GrpcOutOfRangeException,
    GrpcStatus.OUT_OF_RANGE,
    'Out of range',
  ],
  [
    'GrpcUnimplementedException',
    GrpcUnimplementedException,
    GrpcStatus.UNIMPLEMENTED,
    'Unimplemented',
  ],
  [
    'GrpcInternalException',
    GrpcInternalException,
    GrpcStatus.INTERNAL,
    'Internal',
  ],
  [
    'GrpcUnavailableException',
    GrpcUnavailableException,
    GrpcStatus.UNAVAILABLE,
    'Unavailable',
  ],
  [
    'GrpcDataLossException',
    GrpcDataLossException,
    GrpcStatus.DATA_LOSS,
    'Data loss',
  ],
  [
    'GrpcUnauthenticatedException',
    GrpcUnauthenticatedException,
    GrpcStatus.UNAUTHENTICATED,
    'Unauthenticated',
  ],
];

/**
 * CFG / C3 of the GrpcException constructor: no decisions; the default
 * parameter only supplies GrpcStatus.UNKNOWN when the code is omitted.
 */
describe('GrpcException (constructor)', () => {
  it('keeps the message and defaults the code to UNKNOWN', () => {
    const exception = new GrpcException('failure');

    expect(exception).toBeInstanceOf(Error);
    expect(exception.message).toBe('failure');
    expect(exception.getCode()).toBe(GrpcStatus.UNKNOWN);
  });

  it('keeps an explicit code, including the OK value 0', () => {
    const exception = new GrpcException('ok', GrpcStatus.OK);

    expect(exception.getCode()).toBe(GrpcStatus.OK);
  });
});

/** CFG / C3 of getCode: single return, no decisions. */
describe('GrpcException.getCode', () => {
  it.each([
    ['default', new GrpcException('x'), GrpcStatus.UNKNOWN],
    [
      'custom',
      new GrpcException('x', GrpcStatus.NOT_FOUND),
      GrpcStatus.NOT_FOUND,
    ],
    ['zero', new GrpcException('x', GrpcStatus.OK), GrpcStatus.OK],
  ])('returns the %s code', (_label, exception, expected) => {
    expect(exception.getCode()).toBe(expected);
  });
});

/** CFG / C3 of getError: single return, no decisions. */
describe('GrpcException.getError', () => {
  it.each([
    [
      'default code',
      new GrpcException('boom'),
      { code: GrpcStatus.UNKNOWN, message: 'boom' },
    ],
    [
      'explicit code',
      new GrpcException('boom', GrpcStatus.INTERNAL),
      { code: GrpcStatus.INTERNAL, message: 'boom' },
    ],
    [
      'empty message',
      new GrpcException('', GrpcStatus.ABORTED),
      { code: GrpcStatus.ABORTED, message: '' },
    ],
  ])('returns the body for %s', (_label, exception, expected) => {
    expect(exception.getError()).toEqual(expected);
  });
});

/**
 * CFG / C3 of the Grpc*Exception subclass constructors: the `message = ...`
 * default parameter is the only decision-shaped construct (true/false).
 */
describe('Grpc*Exception subclass constructors', () => {
  it.each(SUB_CLASSES)(
    '%s applies its default message and status',
    (_name, Ctor, code, message) => {
      const exception = new Ctor();

      expect(exception).toBeInstanceOf(GrpcException);
      expect(exception.message).toBe(message);
      expect(exception.getCode()).toBe(code);
      expect(exception.getError()).toEqual({ code, message });
    },
  );

  it.each(SUB_CLASSES)(
    '%s keeps a custom message and its status',
    (_name, Ctor, code) => {
      const exception = new Ctor('custom message');

      expect(exception.message).toBe('custom message');
      expect(exception.getCode()).toBe(code);
      expect(exception.getError()).toEqual({
        code,
        message: 'custom message',
      });
    },
  );

  it.each(SUB_CLASSES)(
    '%s treats an empty string as a provided message',
    (_name, Ctor, code) => {
      const exception = new Ctor('');

      expect(exception.message).toBe('');
      expect(exception.getError()).toEqual({ code, message: '' });
    },
  );
});
