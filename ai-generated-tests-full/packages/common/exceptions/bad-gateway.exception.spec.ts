import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { BadGatewayException } from '../../../../packages/common/exceptions/bad-gateway.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'BadGatewayException',
  BadGatewayException,
  HttpStatus.BAD_GATEWAY,
  'Bad Gateway',
);
