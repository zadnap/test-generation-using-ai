import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { PayloadTooLargeException } from '../../../../packages/common/exceptions/payload-too-large.exception.js';
import { describeHttpException } from './http-exception-test.helper.js';

describeHttpException(
  'PayloadTooLargeException',
  PayloadTooLargeException,
  HttpStatus.PAYLOAD_TOO_LARGE,
  'Payload Too Large',
);
