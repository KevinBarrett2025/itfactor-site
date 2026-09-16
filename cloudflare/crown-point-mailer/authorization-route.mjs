import UPNGModule from '@pdf-lib/upng';
import * as pdfLib from 'pdf-lib';
import AUTHORIZATION_TEMPLATE from '../../jcp-crown-point/social-media-authorization/approved-authorization.pdf';
import { handleAuthorization } from './authorization-mailer.mjs';

export function handleAuthorizationRoute(request, env) {
  return handleAuthorization(request, env, {
    pdfLib,
    upng: UPNGModule.default || UPNGModule,
    templateBytes: AUTHORIZATION_TEMPLATE,
  });
}
