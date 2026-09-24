import { next, rewrite } from '@vercel/edge';

export const config = {
  // api/ aur koi bhi file jismein extension ho (css/js/png/xml) -> middleware skip
  matcher: '/((?!api/|.*\\.[a-zA-Z0-9]+$).*)',
};

const MOBILE_UA =
  /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile/i;

// Sirf wo paths jinka mobile version m/ mein maujood hai.
// build-mobile.py ye list khud update karta hai -- MOBILE_READY markers ke beech.
// MOBILE_READY:START
const MOBILE_READY = new Set([
  '/',
  '/about',
  '/contact',
  '/cookies',
  '/data-processing',
  '/fashion',
  '/fashion/sector-solutions',
  '/food-beverage',
  '/food/app/manus',
  '/food/app/motus',
  '/food/app/nexus',
  '/food/app/numerus',
  '/food/app/pos',
  '/food/app/scorecard',
  '/food/food-beverage',
  '/food/food-beverage-solutions',
  '/food/solutions/beverages-drinks',
  '/food/solutions/cafe-coffee-bakery',
  '/food/solutions/casual-dining',
  '/food/solutions/cloud-kitchen-delivery-only',
  '/food/solutions/fine-dining-premium',
  '/food/solutions/health-wellness-specialty-diets',
  '/food/solutions/ice-cream-desserts-sweets',
  '/food/solutions/institutional-b2b-food-service',
  '/food/solutions/niche-experience-concepts',
  '/food/solutions/quick-service-street-food',
  '/meet-iris',
  '/privacy',
  '/resources',
  '/resources/apparel-rtw',
  '/resources/balanced-scorecard-for-multi-outlet-fb',
  '/resources/beverages-drinks',
  '/resources/buyers-guide-evaluating-an-ai-decision-platform',
  '/resources/cafe-bakery',
  '/resources/casual-dining',
  '/resources/cloud-kitchen',
  '/resources/cosmetics',
  '/resources/ethnic-bridal-couture',
  '/resources/fabric-textiles',
  '/resources/fine-dining',
  '/resources/footwear',
  '/resources/health-wellness',
  '/resources/ice-cream-desserts',
  '/resources/inside-the-cogs-control-center',
  '/resources/institutional-b2b',
  '/resources/kids-teens',
  '/resources/kitchen-display-that-runs-the-line',
  '/resources/manus-workforce-operations-management',
  '/resources/motus-supply-chain-inventory-movement',
  '/resources/nexus-integration-connectivity-hub',
  '/resources/niche-experience',
  '/resources/numerus-cfo-ledger-platform',
  '/resources/pos-point-of-sale-integration',
  '/resources/quick-service-street-food',
  '/resources/scheduling-is-a-cost-lever-not-just-a-headache',
  '/resources/sportswear',
  '/resources/the-real-cost-of-manual-reconciliation',
  '/resources/why-cogs-drifts-before-anyone-notices',
  '/resources/why-pos-data-alone-cant-tell-you-whats-happening',
  '/terms',
]);
// MOBILE_READY:END

export default function middleware(request) {
  const url  = new URL(request.url);
  const path = url.pathname;
  const host = (request.headers.get('host') || '').toLowerCase();

  // Double safety -- matcher ke ilawa yahan bhi guard
  if (path.startsWith('/api/') || /\.[a-zA-Z0-9]+$/.test(path)) return next();

  const cookie       = request.headers.get('cookie') || '';
  const wantsDesktop = /(?:^|;\s*)zv=desktop/.test(cookie);
  const wantsMobile  = /(?:^|;\s*)zv=mobile/.test(cookie);

  const isMobileHost = host.startsWith('m.');
  const ready        = MOBILE_READY.has(path);

  // ---- m.zentallio.com par request aayi
  if (isMobileHost) {
    // user ne "Desktop site" click kiya, ya is page ka mobile version nahi bana
    if (wantsDesktop || !ready) {
      return Response.redirect(`https://zentallio.com${path}${url.search}`, 302);
    }
    // URL wahi rehta hai, andar se /m/* serve hota hai
    // Har target ek asli file hai (m/home.html, m/about.html ...) -- koi
    // directory-index guesswork nahi.
    return rewrite(new URL(path === '/' ? '/m/home' : `/m${path}`, request.url));
  }

  // ---- zentallio.com par mobile device aaya
  const ua = request.headers.get('user-agent') || '';
  if (ready && !wantsDesktop && (wantsMobile || MOBILE_UA.test(ua))) {
    return Response.redirect(`https://m.zentallio.com${path}${url.search}`, 302);
  }

  return next();
}
