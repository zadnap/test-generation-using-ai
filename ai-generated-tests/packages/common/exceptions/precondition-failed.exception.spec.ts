import { PreconditionFailedException } from '../../../../packages/common/exceptions/precondition-failed.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'PreconditionFailedException',
  Exception: PreconditionFailedException,
  status: 412,
  defaultMessage: 'Precondition Failed',
});
