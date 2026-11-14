import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { HttpVersionNotSupportedException } from '../../../../packages/common/exceptions/http-version-not-supported.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'HttpVersionNotSupportedException',
  HttpVersionNotSupportedException,
  HttpStatus.HTTP_VERSION_NOT_SUPPORTED,
  'HTTP Version Not Supported',
);
