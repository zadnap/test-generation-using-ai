import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { UnsupportedMediaTypeException } from '../../../../packages/common/exceptions/unsupported-media-type.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'UnsupportedMediaTypeException',
  UnsupportedMediaTypeException,
  HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  'Unsupported Media Type',
);
