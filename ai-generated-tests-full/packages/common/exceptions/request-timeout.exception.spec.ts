import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { RequestTimeoutException } from '../../../../packages/common/exceptions/request-timeout.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'RequestTimeoutException',
  RequestTimeoutException,
  HttpStatus.REQUEST_TIMEOUT,
  'Request Timeout',
);
