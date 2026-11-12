import { MisdirectedException } from '../../../../packages/common/exceptions/misdirected.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'MisdirectedException',
  Exception: MisdirectedException,
  status: 421,
  defaultMessage: 'Misdirected',
});
