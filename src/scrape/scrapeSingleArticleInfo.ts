import { JSDOM } from 'jsdom';
import { fetchURL } from '../fetch/fetchURL';
import { PIXIV_BASE_URL } from '../constants';
import { isAxiosError } from 'axios';

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
    if (isAxiosError(error) && error.response?.status === 404) {
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
  // Try multiple selector strategies for breadcrumb links
  const strategies = [
    // Original selector
    () => [
      ...document.querySelectorAll('a[gtm-class=article-breadcrumbs_link]'),
    ],
    // Fallback: look for breadcrumb-related classes
    () => [...document.querySelectorAll('[class*="breadcrumb"] a')],
    // Fallback: look for nav elements with links
    () => [...document.querySelectorAll('nav a')],
    // Fallback: look for any links in a header-like container
    () => [
      ...document.querySelectorAll('[class*="header"] a, [id*="header"] a'),
    ],
  ];

  for (const strategy of strategies) {
    try {
      const links = strategy();
      const headers = links
        .map((a) => a.textContent?.trim() ?? '')
        .filter((text) => text.length > 0);

      if (headers.length > 0) {
        headers.push(tag_name);
        return headers;
      }
    } catch (error) {
      // Continue to next strategy
      continue;
    }
  }

  throw new Error(`No headers found for tag: ${tag_name}`);
}

function getReading(document: Document): string {
  // Try multiple selector strategies as the HTML structure may change
  const strategies = [
    // Original selector
    () =>
      document
        .getElementById('article-content-header')
        ?.querySelector('.my-4.text-text3.typography-12')?.textContent,
    // Fallback: any element with reading-related classes
    () =>
      document
        .getElementById('article-content-header')
        ?.querySelector('[class*="reading"]')?.textContent,
    // Fallback: look for small text elements (typically used for pronunciation)
    () =>
      document
        .getElementById('article-content-header')
        ?.querySelector('.typography-12')?.textContent,
    // Fallback: look for text-text3 class (tertiary text color)
    () =>
      document
        .getElementById('article-content-header')
        ?.querySelector('.text-text3')?.textContent,
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result?.trim()) {
        return result.trim();
      }
    } catch (error) {
      // Continue to next strategy
      continue;
    }
  }

  return '';
}

function getMainText(document: Document): string {
  // Try to get article abstract
  let articleAbstractText = '';
  const abstractStrategies = [
    () => document.getElementById('article-abstract'),
    () => document.querySelector('[id*="abstract"]'),
    () => document.querySelector('[class*="abstract"]'),
  ];

  for (const strategy of abstractStrategies) {
    try {
      const abstractElement = strategy();
      if (abstractElement) {
        articleAbstractText = [...(abstractElement.querySelectorAll('p') ?? [])]
          .map((p) => p.textContent ?? '')
          .filter((text) => text !== '')
          .join('\n');
        if (articleAbstractText) break;
      }
    } catch (error) {
      continue;
    }
  }

  // Try to get first section
  let firstSectionText = '';
  const sectionStrategies = [
    () => document.querySelector('div[data-header-id=h2_0]') as HTMLDivElement,
    () => document.querySelector('[data-header-id="h2_0"]') as HTMLDivElement,
    () => document.querySelector('section:first-of-type') as HTMLElement,
  ];

  for (const strategy of sectionStrategies) {
    try {
      const sectionElement = strategy();
      if (sectionElement) {
        firstSectionText = [...(sectionElement.querySelectorAll('p') ?? [])]
          .map((p) => p.textContent ?? '')
          .filter((text) => text !== '')
          .join('\n');
        if (firstSectionText) break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!articleAbstractText && !firstSectionText) {
    return '';
  }

  return articleAbstractText + '\n\n' + firstSectionText;
}
