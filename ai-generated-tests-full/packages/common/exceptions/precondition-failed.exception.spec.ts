import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { PreconditionFailedException } from '../../../../packages/common/exceptions/precondition-failed.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'PreconditionFailedException',
  PreconditionFailedException,
  HttpStatus.PRECONDITION_FAILED,
  'Precondition Failed',
);
