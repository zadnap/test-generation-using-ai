import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { NotImplementedException } from '../../../../packages/common/exceptions/not-implemented.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'NotImplementedException',
  NotImplementedException,
  HttpStatus.NOT_IMPLEMENTED,
  'Not Implemented',
);
