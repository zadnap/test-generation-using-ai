import { HttpVersionNotSupportedException } from '../../../../packages/common/exceptions/http-version-not-supported.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'HttpVersionNotSupportedException',
  Exception: HttpVersionNotSupportedException,
  status: 505,
  defaultMessage: 'HTTP Version Not Supported',
});
