import { UnsupportedMediaTypeException } from '../../../../packages/common/exceptions/unsupported-media-type.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'UnsupportedMediaTypeException',
  Exception: UnsupportedMediaTypeException,
  status: 415,
  defaultMessage: 'Unsupported Media Type',
});
