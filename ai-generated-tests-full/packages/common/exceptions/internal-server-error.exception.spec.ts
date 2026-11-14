import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { InternalServerErrorException } from '../../../../packages/common/exceptions/internal-server-error.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'InternalServerErrorException',
  InternalServerErrorException,
  HttpStatus.INTERNAL_SERVER_ERROR,
  'Internal Server Error',
);
