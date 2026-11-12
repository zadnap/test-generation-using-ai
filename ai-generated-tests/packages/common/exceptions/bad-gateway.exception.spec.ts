import { BadGatewayException } from '../../../../packages/common/exceptions/bad-gateway.exception.js';
import { registerExceptionTests } from './exception-test.helper.js';

registerExceptionTests({
  name: 'BadGatewayException',
  Exception: BadGatewayException,
  status: 502,
  defaultMessage: 'Bad Gateway',
});
