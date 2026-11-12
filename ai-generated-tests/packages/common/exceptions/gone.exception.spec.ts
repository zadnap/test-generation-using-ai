import { GoneException } from '../../../../packages/common/exceptions/gone.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'GoneException',
  Exception: GoneException,
  status: 410,
  defaultMessage: 'Gone',
});
