import { GatewayTimeoutException } from '../../../../packages/common/exceptions/gateway-timeout.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'GatewayTimeoutException',
  Exception: GatewayTimeoutException,
  status: 504,
  defaultMessage: 'Gateway Timeout',
});
