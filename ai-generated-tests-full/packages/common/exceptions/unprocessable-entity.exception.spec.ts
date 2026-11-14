import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { UnprocessableEntityException } from '../../../../packages/common/exceptions/unprocessable-entity.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'UnprocessableEntityException',
  UnprocessableEntityException,
  HttpStatus.UNPROCESSABLE_ENTITY,
  'Unprocessable Entity',
);
