import { UnprocessableEntityException } from '../../../../packages/common/exceptions/unprocessable-entity.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'UnprocessableEntityException',
  Exception: UnprocessableEntityException,
  status: 422,
  defaultMessage: 'Unprocessable Entity',
});
