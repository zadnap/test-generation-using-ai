import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { GatewayTimeoutException } from '../../../../packages/common/exceptions/gateway-timeout.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'GatewayTimeoutException',
  GatewayTimeoutException,
  HttpStatus.GATEWAY_TIMEOUT,
  'Gateway Timeout',
);
