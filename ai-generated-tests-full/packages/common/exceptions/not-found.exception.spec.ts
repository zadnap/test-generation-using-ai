import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { NotFoundException } from '../../../../packages/common/exceptions/not-found.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'NotFoundException',
  NotFoundException,
  HttpStatus.NOT_FOUND,
  'Not Found',
);
