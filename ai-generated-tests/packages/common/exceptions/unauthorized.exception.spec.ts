import { UnauthorizedException } from '../../../../packages/common/exceptions/unauthorized.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'UnauthorizedException',
  Exception: UnauthorizedException,
  status: 401,
  defaultMessage: 'Unauthorized',
});
