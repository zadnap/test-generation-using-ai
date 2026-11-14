import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { UnauthorizedException } from '../../../../packages/common/exceptions/unauthorized.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'UnauthorizedException',
  UnauthorizedException,
  HttpStatus.UNAUTHORIZED,
  'Unauthorized',
);
