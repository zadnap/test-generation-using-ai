import { NotImplementedException } from '../../../../packages/common/exceptions/not-implemented.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'NotImplementedException',
  Exception: NotImplementedException,
  status: 501,
  defaultMessage: 'Not Implemented',
});
