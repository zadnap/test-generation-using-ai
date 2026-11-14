import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { GoneException } from '../../../../packages/common/exceptions/gone.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'GoneException',
  GoneException,
  HttpStatus.GONE,
  'Gone',
);
