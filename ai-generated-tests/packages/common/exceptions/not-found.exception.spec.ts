import { NotFoundException } from '../../../../packages/common/exceptions/not-found.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'NotFoundException',
  Exception: NotFoundException,
  status: 404,
  defaultMessage: 'Not Found',
});
