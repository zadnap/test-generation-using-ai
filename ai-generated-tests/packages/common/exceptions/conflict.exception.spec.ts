import { ConflictException } from '../../../../packages/common/exceptions/conflict.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'ConflictException',
  Exception: ConflictException,
  status: 409,
  defaultMessage: 'Conflict',
});
