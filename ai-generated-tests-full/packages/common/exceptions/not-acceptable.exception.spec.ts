import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { NotAcceptableException } from '../../../../packages/common/exceptions/not-acceptable.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'NotAcceptableException',
  NotAcceptableException,
  HttpStatus.NOT_ACCEPTABLE,
  'Not Acceptable',
);
