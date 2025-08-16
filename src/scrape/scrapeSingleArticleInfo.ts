import { JSDOM } from 'jsdom';
import { fetchURL } from '../fetch/fetchURL';
import { PIXIV_BASE_URL } from '../constants';
const pixivArticleURL = (tag_name: string) =>
  `${PIXIV_BASE_URL}a/${encodeURIComponent(tag_name)}`;

export async function scrapeSingleArticleInfo(tag_name: string) {
  // Fetch the page
  const url = pixivArticleURL(tag_name);
  const response = await fetchURL(url);
  const dom = new JSDOM(response.data);
  const document = dom.window.document;
  const reading = getReading(document);
  const header = getHeaders(document, tag_name);
  const mainText = getMainText(document);

  return {
    reading,
    header,
    mainText,
  };
}

function getHeaders(document: Document, tag_name: string): string[] {
  const headers = [
    ...document.querySelectorAll('a[gtm-class=article-breadcrumbs_link]'),
  ].map((a) => a.textContent);
  if (!headers.length) {
    throw new Error(`No headers found for tag: ${tag_name}`);
  }
  headers.push(tag_name);
  return headers;
}

function getReading(document: Document) {
  return (
    document
      .getElementById('article-content-header')
      ?.querySelector('.my-4.text-text3.typography-12')?.textContent || ''
  );
}

function getMainText(document: Document): string {
  const articleAbstractText = [
    ...(document.getElementById('article-abstract')?.querySelectorAll('p') ??
      []),
  ]
    .map((p) => p.textContent)
    .join('\n');

  const firstSection = document.querySelector(
    'div[data-header-id=h2_0]',
  ) as HTMLDivElement;
  const firstSectionText = [...(firstSection?.querySelectorAll('p') ?? [])]
    .map((p) => p.textContent)
    .join('\n');

  if (!articleAbstractText && !firstSectionText) {
    return '';
  }

  return articleAbstractText + '\n\n' + firstSectionText;
}
