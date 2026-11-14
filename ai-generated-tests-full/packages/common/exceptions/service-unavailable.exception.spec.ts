import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ServiceUnavailableException } from '../../../../packages/common/exceptions/service-unavailable.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'ServiceUnavailableException',
  ServiceUnavailableException,
  HttpStatus.SERVICE_UNAVAILABLE,
  'Service Unavailable',
);
