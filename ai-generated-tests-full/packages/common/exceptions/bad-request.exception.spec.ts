import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { BadRequestException } from '../../../../packages/common/exceptions/bad-request.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'BadRequestException',
  BadRequestException,
  HttpStatus.BAD_REQUEST,
  'Bad Request',
);
