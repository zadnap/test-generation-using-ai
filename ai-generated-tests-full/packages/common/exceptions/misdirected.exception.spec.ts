import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { MisdirectedException } from '../../../../packages/common/exceptions/misdirected.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'MisdirectedException',
  MisdirectedException,
  HttpStatus.MISDIRECTED,
  'Misdirected',
);
