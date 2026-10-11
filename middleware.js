// Vercel Routing Middleware: serves Markdown to agents that ask for it with
// `Accept: text/markdown` (https://acceptmarkdown.com). Browsers and anything
// else that prefers HTML fall through to the static site untouched.

const SITE = 'https://presageretention.com';

// Page path -> Markdown mirror shipped alongside the HTML.
export const MARKDOWN_PAGES = {
  '/': '/index.md',
  '/index': '/index.md',
  '/index.html': '/index.md',
  '/privacy': '/privacy.md',
  '/privacy.html': '/privacy.md',
  '/terms': '/terms.md',
  '/terms.html': '/terms.md',
};

export const NOT_FOUND_MARKDOWN = `# 404: Page not found

There is no page at this address on the Presage Retention website. It may have moved, or the link may be mistyped.

Presage is an email and SMS retention studio for ecommerce brands. Try one of these instead:

- [Home](${SITE}/index.md): services, process, results, and FAQ
- [llms.txt](${SITE}/llms.txt): guide for AI agents, including when to use Presage
- [Sitemap](${SITE}/sitemap.xml): every page on this site
`;

export const config = {
  // Skip static files (anything with an extension) except .html pages.
  matcher: ['/((?!.*\\.(?!html$)[^/]+$).*)'],
};

// Quality value the Accept header gives a media type, honouring wildcards.
function quality(accept, type) {
  const [major] = type.split('/');
  let best = -1;
  let bestSpecificity = -1;
  for (const part of accept.split(',')) {
    const [range, ...params] = part.trim().toLowerCase().split(';');
    const specificity = range === type ? 2 : range === `${major}/*` ? 1 : range === '*/*' ? 0 : -1;
    if (specificity < 0 || specificity < bestSpecificity) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split('=');
      if (key === 'q') q = Number.parseFloat(value);
    }
    if (Number.isNaN(q)) q = 0;
    if (specificity > bestSpecificity || q > best) {
      best = q;
      bestSpecificity = specificity;
    }
  }
  return Math.max(best, 0);
}

export function prefersMarkdown(accept) {
  if (!accept) return false;
  const markdown = quality(accept, 'text/markdown');
  // A bare */* should not turn browsers' HTML into Markdown.
  if (!/text\/markdown/i.test(accept) || markdown <= 0) return false;
  return markdown >= quality(accept, 'text/html');
}

function markdownResponse(body, status, method) {
  return new Response(method === 'HEAD' ? null : body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Robots-Tag': 'noindex',
      Link: `<${SITE}/llms.txt>; rel="describedby"; type="text/plain"`,
    },
  });
}

export default async function middleware(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return;
  if (!prefersMarkdown(request.headers.get('accept'))) return;

  const { pathname } = new URL(request.url);
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const source = MARKDOWN_PAGES[path];
  if (!source) return markdownResponse(NOT_FOUND_MARKDOWN, 404, request.method);

  const file = await fetch(new URL(source, request.url), {
    headers: { Accept: 'text/plain' },
  });
  if (!file.ok) return; // Fall back to HTML rather than serve a broken Markdown page.
  return markdownResponse(await file.text(), 200, request.method);
}
