import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ConflictException } from '../../../../packages/common/exceptions/conflict.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'ConflictException',
  ConflictException,
  HttpStatus.CONFLICT,
  'Conflict',
);
