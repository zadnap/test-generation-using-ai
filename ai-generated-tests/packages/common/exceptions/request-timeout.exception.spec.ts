import { RequestTimeoutException } from '../../../../packages/common/exceptions/request-timeout.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'RequestTimeoutException',
  Exception: RequestTimeoutException,
  status: 408,
  defaultMessage: 'Request Timeout',
});
