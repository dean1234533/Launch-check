import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App.jsx";
import { BlogIndex, ContentPage, setPageMeta } from "./ContentPages.jsx";
import { findPage, SITE_URL } from "./content.js";

const cleanPath = window.location.pathname.replace(/^\/quick-scan-first\/?/, "").replace(/^\//, "").replace(/\/$/, "");
const page = findPage(window.location.pathname);

if (page) setPageMeta(page);
else if (cleanPath === "blog") {
  document.title = "Code security guides | Quick Scan First";
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", `${SITE_URL}/blog/`);
}

createRoot(document.getElementById("root")).render(page ? <ContentPage page={page} /> : cleanPath === "blog" ? <BlogIndex /> : <App />);
