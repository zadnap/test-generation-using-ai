import { ServiceUnavailableException } from '../../../../packages/common/exceptions/service-unavailable.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'ServiceUnavailableException',
  Exception: ServiceUnavailableException,
  status: 503,
  defaultMessage: 'Service Unavailable',
});
