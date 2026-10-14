import { Footer, Nav, StoreButton } from "./Layout.jsx";
import { blogPages, pages, pageUrl, shareImageFor } from "./content.js";

const base = import.meta.env.BASE_URL;

function hrefFor(slug) {
  return `${base}${slug}/`;
}

function titleFor(slug) {
  return pages.find((page) => page.slug === slug)?.title || slug;
}

function Faqs({ items }) {
  return <div className="faq-list">{items.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>;
}

export function BlogIndex() {
  return (
    <><Nav /><main><header className="content-hero"><div className="wrap content-hero-inner"><span className="kicker">Quick Scan First knowledge base</span><h1>Practical code security before launch.</h1><p>Clear, evidence-led guides for repository security, exposed secrets, authentication, database access, payments and safer releases.</p></div></header><section className="content-section"><div className="wrap"><div className="article-grid">{blogPages.map((page) => <a className="article-card" href={hrefFor(page.slug)} key={page.slug}><img src={`${base}${page.image}`} alt="" width={page.imageWidth} height={page.imageHeight} loading="lazy" decoding="async" /><div><span>{page.kind}</span><h2>{page.title}</h2><p>{page.description}</p><b>Read guide →</b></div></a>)}</div></div></section><section className="knowledge-cta"><div className="wrap"><div><span className="kicker">Use the product</span><h2>Turn the checklist into a repository scan.</h2></div><StoreButton /></div></section></main><Footer /></>
  );
}

export function ContentPage({ page }) {
  const isBlog = page.slug.startsWith("blog/");
  return (
    <><Nav /><main><header className="content-hero"><div className="wrap content-hero-inner"><nav className="breadcrumbs" aria-label="Breadcrumb"><a href={base}>Home</a><span>/</span>{isBlog && <><a href={`${base}blog/`}>Blog</a><span>/</span></>}<span>{page.kind}</span></nav><span className="kicker">{page.kind}</span><h1>{page.title}</h1><p>{page.description}</p><div className="article-meta"><span>By Dean Burt</span><span>Updated {page.updated ? "14 October 2026" : "4 October 2026"}</span><span>Reviewed against Quick Scan First’s implemented checks</span></div></div></header><div className="wrap article-layout"><article className="knowledge-article"><figure className="article-hero-image"><img src={`${base}${page.image}`} alt={page.imageAlt} width={page.imageWidth} height={page.imageHeight} decoding="async" fetchPriority="high" /><figcaption>{page.imageCaption}</figcaption></figure><aside className="direct-answer"><strong>Direct answer</strong><p>{page.answer}</p></aside>{page.sections.map(([heading, copy]) => <section key={heading}><h2>{heading}</h2><p>{copy}</p></section>)}<section><span className="kicker">Questions</span><h2>Frequently asked questions</h2><Faqs items={page.faqs} /></section>{page.sources && <section><h2>Sources and current provider information</h2><p>Reviewed 14 October 2026. Provider capabilities and terms can change.</p><ul>{page.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></section>}<aside className="editorial-note"><strong>How this guide was prepared</strong><p>This page is based on the checks currently implemented by Quick Scan First and practical release-review principles. Product limits are stated directly: automated and AI review can miss issues and does not replace expert security testing.</p></aside></article><aside className="article-aside"><div><span className="kicker">Related</span>{page.related.map((slug) => <a href={hrefFor(slug)} key={slug}>{titleFor(slug)}<span>→</span></a>)}</div><div className="aside-product"><strong>Scan before you ship</strong><p>Review a GitHub repository and open fixes as pull requests you control.</p><StoreButton /></div></aside></div><section className="knowledge-cta"><div className="wrap"><div><span className="kicker">Quick Scan First</span><h2>Give your code one more pair of eyes.</h2></div><StoreButton /></div></section></main><Footer /></>
  );
}

export function setPageMeta(page) {
  const title = `${page.title} | Quick Scan First`;
  const url = pageUrl(page.slug);
  document.title = title;
  setMeta("name", "description", page.description);
  setMeta("property", "og:type", page.slug.startsWith("blog/") ? "article" : "website");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", page.description);
  setMeta("property", "og:url", url);
  setMeta("property", "og:site_name", "Quick Scan First");
  setMeta("property", "og:image", `${pageUrl()}${shareImageFor(page)}`);
  setMeta("property", "og:image:alt", page.imageAlt);
  setMeta("property", "og:image:width", "1200");
  setMeta("property", "og:image:height", "630");
  setMeta("property", "og:image:type", "image/jpeg");
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", page.description);
  setMeta("name", "twitter:image", `${pageUrl()}${shareImageFor(page)}`);
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
  canonical.href = url;
}

function setMeta(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attribute, key); document.head.appendChild(tag); }
  tag.content = content;
}
