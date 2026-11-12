import { MethodNotAllowedException } from '../../../../packages/common/exceptions/method-not-allowed.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'MethodNotAllowedException',
  Exception: MethodNotAllowedException,
  status: 405,
  defaultMessage: 'Method Not Allowed',
});
