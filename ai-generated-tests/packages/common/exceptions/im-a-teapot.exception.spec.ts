import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'ImATeapotException',
  Exception: ImATeapotException,
  status: 418,
  defaultMessage: "I'm a teapot",
});
