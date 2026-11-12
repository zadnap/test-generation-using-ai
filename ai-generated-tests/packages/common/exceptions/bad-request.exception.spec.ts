import { BadRequestException } from '../../../../packages/common/exceptions/bad-request.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'BadRequestException',
  Exception: BadRequestException,
  status: 400,
  defaultMessage: 'Bad Request',
});
