import { ForbiddenException } from '../../../../packages/common/exceptions/forbidden.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'ForbiddenException',
  Exception: ForbiddenException,
  status: 403,
  defaultMessage: 'Forbidden',
});
