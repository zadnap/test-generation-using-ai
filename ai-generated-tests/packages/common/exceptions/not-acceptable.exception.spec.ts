import { NotAcceptableException } from '../../../../packages/common/exceptions/not-acceptable.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'NotAcceptableException',
  Exception: NotAcceptableException,
  status: 406,
  defaultMessage: 'Not Acceptable',
});
