import { PayloadTooLargeException } from '../../../../packages/common/exceptions/payload-too-large.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'PayloadTooLargeException',
  Exception: PayloadTooLargeException,
  status: 413,
  defaultMessage: 'Payload Too Large',
});
