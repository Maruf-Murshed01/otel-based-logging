/**
 * Request Context Extractor
 *
 * Extracts structured client + HTTP metadata from an incoming Express request.
 * The returned object is spread directly into log attributes — fully reusable
 * across any Express route without modification.
 *
 * Fields returned:
 *   http.*      — hostname, route, method
 *   client.*    — browser, browser_version, os, device, anonymized IP, country
 *   express.*   — route, handler_type
 *   user.*      — id and name (empty until auth middleware populates them)
 *
 * No npm packages beyond express are required.
 */

import { Request } from 'express';

export function getClientContext(req: Request, handlerType: string = 'REST') {
  const ua = req.headers['user-agent'] || '';
  const ip = (req.ip || '').replace(/^::ffff:/, '');

  const browser =
    ua.includes('Edg')     ? 'Edge'    :
    ua.includes('Chrome')  ? 'Chrome'  :
    ua.includes('Firefox') ? 'Firefox' :
    ua.includes('Safari')  ? 'Safari'  : 'Unknown';

  const browserVersionMatch =
    ua.match(/Edg\/([\d.]+)/)     ||
    ua.match(/Chrome\/([\d.]+)/)  ||
    ua.match(/Firefox\/([\d.]+)/) ||
    ua.match(/Version\/([\d.]+)/);
  const browserVersion = browserVersionMatch?.[1] || '';

  const os =
    ua.includes('Windows')                        ? 'Windows' :
    ua.includes('Macintosh')                      ? 'macOS'   :
    ua.includes('Android')                        ? 'Android' :
    ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'     :
    ua.includes('Linux')                          ? 'Linux'   : 'Unknown';

  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? 'mobile' : 'desktop';

  const ipParts = ip.split('.');
  const ipAnonymized = ipParts.length === 4
    ? `${ipParts[0]}.${ipParts[1]}.xx.xx`
    : ip;

  return {
    'http.hostname':          req.hostname,
    'http.route':             req.path,
    'http.method':            req.method,
    'client.browser':         browser,
    'client.browser_version': browserVersion,
    'client.os':              os,
    'client.device':          device,
    'client.ip_anonymized':   ipAnonymized,
    'client.country':         '',  // populated when GeoIP is available
    'express.route':          req.path,
    'express.handler_type':   handlerType,
    'user.id':                '',  // populated when auth middleware is available
    'user.name':              '',  // populated when auth middleware is available
  };
}
