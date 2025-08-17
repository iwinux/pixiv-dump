import { JSDOM } from 'jsdom';
import { fetchURL } from '../fetch/fetchURL';
import { PIXIV_BASE_URL } from '../constants';
import { AxiosError } from 'axios';

const pixivArticleURL = (tag_name: string) =>
  `${PIXIV_BASE_URL}a/${encodeURIComponent(tag_name)}`;

export class ArticleNotFoundError extends Error {
  constructor(tag_name: string) {
    super(`Article not found: ${tag_name}`);
    this.name = 'ArticleNotFoundError';
  }
}

async function fetchArticlePage(url: string, tag_name: string) {
  try {
    const response = await fetchURL(url);
    return response;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      throw new ArticleNotFoundError(tag_name);
    }
    throw error;
  }
}

export async function scrapeSingleArticleInfo(tag_name: string) {
  // Fetch the page
  const url = pixivArticleURL(tag_name);
  const response = await fetchArticlePage(url, tag_name);
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
  ].map((a) => a.textContent ?? '');
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
    .map((p) => p.textContent ?? '')
    .filter((text) => text !== '')
    .join('\n');

  const firstSection = document.querySelector(
    'div[data-header-id=h2_0]',
  ) as HTMLDivElement;
  const firstSectionText = [...(firstSection?.querySelectorAll('p') ?? [])]
    .map((p) => p.textContent ?? '')
    .filter((text) => text !== '')
    .join('\n');

  if (!articleAbstractText && !firstSectionText) {
    return '';
  }

  return articleAbstractText + '\n\n' + firstSectionText;
}
