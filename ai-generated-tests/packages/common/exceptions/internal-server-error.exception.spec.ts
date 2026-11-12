import { InternalServerErrorException } from '../../../../packages/common/exceptions/internal-server-error.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'InternalServerErrorException',
  Exception: InternalServerErrorException,
  status: 500,
  defaultMessage: 'Internal Server Error',
});
