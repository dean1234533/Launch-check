import { renderToStaticMarkup } from 'react-dom/server';
import { App, faqs } from './App.jsx';
import { BlogIndex, ContentPage } from './ContentPages.jsx';
import { Privacy } from './Privacy.jsx';
export { faqs };
export function renderPage(kind, page) {
  return renderToStaticMarkup(kind === 'home' ? <App /> : kind === 'blog' ? <BlogIndex /> : kind === 'privacy' ? <Privacy /> : <ContentPage page={page} />);
}
