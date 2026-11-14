import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ForbiddenException } from '../../../../packages/common/exceptions/forbidden.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'ForbiddenException',
  ForbiddenException,
  HttpStatus.FORBIDDEN,
  'Forbidden',
);
