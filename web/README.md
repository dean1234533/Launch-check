# Quick Scan First marketing website

This web source matches the published product at https://www.dean-da-dev.co.uk/quick-scan-first/. The Chrome extension and API server are separate components.

`npm run build` builds the browser bundles, bundles the React server renderer, then generates complete static HTML for the homepage, product guides, blog and privacy page. Metadata, structured data and sitemap content are generated from the page registry. The build does not call the scanning API or change repositories.

For external-drive builds, set `BUILD_OUTPUT_DIR`, `SSR_OUTPUT_DIR`, `VITE_CACHE_DIR`, `TMPDIR` and `npm_config_cache` to external paths. Run `npm test` for the existing page checks. `npm run preview` serves the production `/quick-scan-first/` base path.

For the current Dean Da Dev hosting setup, copy the reviewed output to the portfolio repository’s `public/quick-scan-first/` directory and deploy that Vercel project. Its aggregate sitemap reads the product sitemap. Preserve existing published media when synchronising the supplied source with the live site.
