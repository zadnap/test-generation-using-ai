import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { MethodNotAllowedException } from '../../../../packages/common/exceptions/method-not-allowed.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'MethodNotAllowedException',
  MethodNotAllowedException,
  HttpStatus.METHOD_NOT_ALLOWED,
  'Method Not Allowed',
);
