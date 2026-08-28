import { browserName, detectOS } from 'detect-browser';
import ipaddr from 'ipaddr.js';
import { UAParser } from 'ua-parser-js';
import { getIpAddress, stripPort } from '@/lib/ip';

export function getDevice(userAgent: string, screen: string = '') {
  const { device } = UAParser(userAgent);

  const [width] = screen.split('x');

  const type = device?.type || 'desktop';

  if (type === 'desktop' && screen && +width <= 1920) {
    return 'laptop';
  }

  return type;
}

function getRegionCode(country: string, region: string) {
  if (!country || !region) {
    return undefined;
  }

  return region.includes('-') ? region : `${country}-${region}`;
}

type LocationMetadata = { country?: string; regionCode?: string; city?: string };

export function getLocation(ip: string, cf?: LocationMetadata) {
  const cleanIp = stripPort(ip);
  if (!cf || !cleanIp || !ipaddr.isValid(cleanIp) || ipaddr.process(cleanIp).range() !== 'unicast')
    return null;
  const country = cf.country && !['XX', 'T1'].includes(cf.country) ? cf.country : undefined;
  return { country, region: getRegionCode(country, cf.regionCode), city: cf.city };
}

export async function getClientInfo(request: Request, payload: Record<string, any>) {
  const userAgent = payload?.userAgent || request.headers.get('user-agent');
  const ip = payload?.ip || getIpAddress(request.headers);
  const cf = (request as Request & { cf?: LocationMetadata }).cf;
  const location = getLocation(ip, payload?.ip ? undefined : cf);
  const { country, region, city } = location ?? {};
  const browser = payload?.browser ?? browserName(userAgent);
  const os = payload?.os ?? (detectOS(userAgent) as string);
  const device = payload?.device ?? getDevice(userAgent, payload?.screen);

  return { userAgent, browser, os, ip, country, region, city, device };
}

export function hasBlockedIp(clientIp: string) {
  const ignoreIps = process.env.IGNORE_IP;

  if (!clientIp || !ignoreIps) {
    return false;
  }

  const ips = ignoreIps.split(',').map(n => n.trim());

  return ips.some(ip => {
    if (ip === clientIp) {
      return true;
    }

    // CIDR notation
    if (ip.indexOf('/') > 0) {
      try {
        const addr = ipaddr.parse(clientIp);
        const range = ipaddr.parseCIDR(ip);

        if (addr.kind() === range[0].kind() && addr.match(range)) {
          return true;
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return false;
  });
}
