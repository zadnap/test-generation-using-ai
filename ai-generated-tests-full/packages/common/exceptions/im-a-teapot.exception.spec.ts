import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'ImATeapotException',
  ImATeapotException,
  HttpStatus.I_AM_A_TEAPOT,
  "I'm a teapot",
);
