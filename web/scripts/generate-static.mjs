import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { blogPages, pages, pageUrl, shareImageFor, SITE_URL, UPDATED } from "../src/content.js";

const root = new URL("..", import.meta.url).pathname;
const dist = resolve(process.env.BUILD_OUTPUT_DIR || join(root, "dist"));
const ssr = resolve(process.env.SSR_OUTPUT_DIR || join(dirname(dist), "quick-scan-ssr"));
const { renderPage, faqs: homeFaqs } = await import(new URL(`file://${ssr}/entry-server.js`));
const template = await readFile(join(dist, "index.html"), "utf8");

const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function schemaFor(page) {
  const isArticle = page.slug.startsWith("blog/");
  const graph = [
    {
      "@type": "WebPage",
      "@id": `${pageUrl(page.slug)}#webpage`,
      url: pageUrl(page.slug),
      name: page.title,
      description: page.description,
      primaryImageOfPage: { "@type": "ImageObject", url: `${SITE_URL}/${page.image}`, width: page.imageWidth, height: page.imageHeight, caption: page.imageCaption },
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#software` },
      inLanguage: "en-GB",
      dateModified: page.updated || UPDATED,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Quick Scan First", item: `${SITE_URL}/` },
        ...(isArticle ? [{ "@type": "ListItem", position: 2, name: "Security guides", item: `${SITE_URL}/blog/` }] : []),
        { "@type": "ListItem", position: isArticle ? 3 : 2, name: page.title, item: pageUrl(page.slug) },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: page.faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
    },
  ];
  if (isArticle) graph.push({
    "@type": "Article",
    "@id": `${pageUrl(page.slug)}#article`,
    headline: page.title,
    description: page.description,
    image: { "@type": "ImageObject", url: `${SITE_URL}/${page.image}`, width: page.imageWidth, height: page.imageHeight, caption: page.imageCaption },
    datePublished: UPDATED,
    dateModified: page.updated || UPDATED,
    author: { "@type": "Person", name: "Dean Burt", url: "https://www.dean-da-dev.co.uk/about" },
    publisher: { "@type": "Organization", name: "Quick Scan First", url: `${SITE_URL}/` },
    mainEntityOfPage: { "@id": `${pageUrl(page.slug)}#webpage` },
    inLanguage: "en-GB",
  });
  return { "@context": "https://schema.org", "@graph": graph };
}

function staticPage(page) { return renderPage("content", page); }

function documentFor(page) {
  const title = `${page.title} | Quick Scan First`;
  const url = pageUrl(page.slug);
  let html = template
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escape(page.description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${page.slug.startsWith("blog/") ? "article" : "website"}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escape(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escape(page.description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${SITE_URL}/${shareImageFor(page)}" />`)
    .replace(/<meta property="og:image:alt" content="[^"]*"\s*\/?>/, `<meta property="og:image:alt" content="${escape(page.imageAlt)}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escape(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escape(page.description)}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${SITE_URL}/${shareImageFor(page)}" />`)
    .replace("</head>", `<script type="application/ld+json">${JSON.stringify(schemaFor(page)).replaceAll("<", "\\u003c")}</script>\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${staticPage(page)}</div>`);
  return html;
}

function blogIndexHtml() {
  const description = "Practical Quick Scan First guides for GitHub repository security, exposed API keys, database access and safer pre-launch code review.";
  const cards = blogPages.map((page) => `<a class="article-card" href="${pageUrl(page.slug)}"><img src="/quick-scan-first/${page.image}" alt="" width="${page.imageWidth}" height="${page.imageHeight}" loading="lazy" decoding="async" /><div><span>${escape(page.kind)}</span><h2>${escape(page.title)}</h2><p>${escape(page.description)}</p><b>Read guide →</b></div></a>`).join("");
  const schema = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Quick Scan First security guides", url: `${SITE_URL}/blog/`, description, hasPart: blogPages.map((page) => ({ "@type": "Article", headline: page.title, url: pageUrl(page.slug) })) };
  return template
    .replace(/<title>.*?<\/title>/, "<title>Code security guides | Quick Scan First</title>")
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${SITE_URL}/blog/" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, '<meta property="og:title" content="Code security guides | Quick Scan First" />')
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${SITE_URL}/blog/" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${SITE_URL}/${shareImageFor(blogPages[0])}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, '<meta name="twitter:title" content="Code security guides | Quick Scan First" />')
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${description}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${SITE_URL}/${shareImageFor(blogPages[0])}" />`)
    .replace("</head>", `<script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${renderPage("blog")}</div>`);
}

async function output(path, content) {
  const target = join(dist, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

for (const page of pages) await output(`${page.slug}/index.html`, documentFor(page));
await output("blog/index.html", blogIndexHtml());

const urls = [
  [`${SITE_URL}/`, "1.0", "2026-10-14"],
  ...pages.map(page => [pageUrl(page.slug), page.slug.startsWith("blog/") ? "0.7" : "0.9", page.updated || UPDATED]),
  [`${SITE_URL}/blog/`, "0.8", "2026-10-14"],
  [`${SITE_URL}/privacy.html`, "0.3", UPDATED],
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([url, priority, modified]) => `  <url><loc>${url}</loc><lastmod>${modified}</lastmod><priority>${priority}</priority></url>`).join("\n")}\n</urlset>\n`;
await output("sitemap.xml", sitemap);
await output("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await output("llms.txt", `# Quick Scan First\n\n> Quick Scan First is a Chrome extension for pre-launch GitHub repository review. It checks for exposed secrets, unsafe database access, vulnerable dependencies, missing authentication and ownership checks, payment risks and production configuration problems.\n\n## Product\n${pages.filter(page => !page.slug.startsWith("blog/")).map(page => `- [${page.title}](${pageUrl(page.slug)})`).join("\n")}\n- [Quick Scan First](${SITE_URL}/)\n- [GitHub repository security scanner](${SITE_URL}/github-repository-security-scanner/)\n- [Pre-launch code review](${SITE_URL}/pre-launch-code-review/)\n- [Exposed API key scanner](${SITE_URL}/exposed-api-key-scanner/)\n- [Privacy policy](${SITE_URL}/privacy.html)\n\n## Guides\n${blogPages.map((page) => `- [${page.title}](${pageUrl(page.slug)})`).join("\n")}\n\n## Important limitations\nQuick Scan First is a second pair of eyes, not a penetration test, formal security audit or security guarantee. AI findings and generated pull requests require human review.\n`);

const homeSchema = { "@context": "https://schema.org", "@graph": [
  { "@type": "WebPage", url: `${SITE_URL}/`, name: "GitHub Security Scanner for AI Code | Quick Scan First", inLanguage: "en-GB", dateModified: "2026-10-14", isPartOf: { "@id": `${SITE_URL}/#website` }, about: { "@id": `${SITE_URL}/#software` } },
  { "@type": "FAQPage", mainEntity: homeFaqs.map(([q,a]) => ({ "@type": "Question", name:q, acceptedAnswer:{ "@type":"Answer", text:a } })) },
] };
await output('index.html', template.replace('<div id="root"></div>', `<div id="root">${renderPage('home')}</div>`).replace('</head>', `<script type="application/ld+json">${JSON.stringify(homeSchema).replaceAll('<','\\u003c')}</script></head>`));
const privacy = await readFile(join(dist,'privacy.html'),'utf8');
await output('privacy.html', privacy.replace('<div id="root"></div>', `<div id="root">${renderPage('privacy')}</div>`));

console.log(`Generated ${pages.length + 1} static content pages, sitemap.xml, robots.txt and llms.txt.`);
