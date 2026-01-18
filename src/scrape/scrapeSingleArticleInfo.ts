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

interface ArticleData {
  yomigana?: string;
  categories?: string[];
  abstract?: string;
  text?: string;
}

interface BreadcrumbItem {
  tagName: string;
  url: string;
}

interface NextDataPageProps {
  swrFallback?: {
    [key: string]: ArticleData | BreadcrumbItem[] | unknown;
  };
}

interface NextData {
  props?: {
    pageProps?: NextDataPageProps;
  };
}

const HTTP_FORBIDDEN = 403;

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

/**
 * Extracts article data from the Next.js __NEXT_DATA__ JSON in the HTML
 */
function extractArticleDataFromHTML(
  html: string,
  tag_name: string,
): {
  articleData: ArticleData | null;
  breadcrumbs: BreadcrumbItem[] | null;
} {
  // Parse HTML to find __NEXT_DATA__ script tag
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const nextDataScript = document.getElementById('__NEXT_DATA__');
  if (!nextDataScript || !nextDataScript.textContent) {
    throw new Error('Could not find __NEXT_DATA__ in page');
  }

  let nextData: NextData;
  try {
    nextData = JSON.parse(nextDataScript.textContent);
  } catch (error) {
    throw new Error(`Failed to parse __NEXT_DATA__: ${error}`);
  }

  const swrFallback = nextData.props?.pageProps?.swrFallback;
  if (!swrFallback) {
    throw new Error('Could not find swrFallback in __NEXT_DATA__');
  }

  // Find the article data key - it contains the literal string '{tagName}' as a placeholder
  // in the API path, and also contains the actual tag name value
  // Example key format: '@"openapi-","/get_article/{tagName}",#params:#query:#lang:"ja",,path:#tagName:"フリーレン",,,,'
  const articleKey = Object.keys(swrFallback).find(
    (key) => key.includes('/get_article/{tagName}') && key.includes(tag_name),
  );

  // Find the breadcrumbs key with the same pattern
  const breadcrumbsKey = Object.keys(swrFallback).find(
    (key) =>
      key.includes('/get_breadcrumbs/{tagName}') && key.includes(tag_name),
  );

  const articleData = articleKey
    ? (swrFallback[articleKey] as ArticleData)
    : null;
  const breadcrumbs = breadcrumbsKey
    ? (swrFallback[breadcrumbsKey] as BreadcrumbItem[])
    : null;

  return { articleData, breadcrumbs };
}

export async function scrapeSingleArticleInfo(tag_name: string) {
  // Fetch the page
  const url = pixivArticleURL(tag_name);
  let response;
  try {
    response = await fetchArticlePage(url, tag_name);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === HTTP_FORBIDDEN) {
      throw error;
    }
    throw error;
  }

  // Extract data from Next.js JSON
  const { articleData, breadcrumbs } = extractArticleDataFromHTML(
    response.data,
    tag_name,
  );

  if (!articleData) {
    throw new Error(`Could not find article data for tag: ${tag_name}`);
  }

  // Extract reading (yomigana)
  const reading = articleData.yomigana || '';

  // Extract headers from breadcrumbs and categories
  const header = getHeaders(breadcrumbs, articleData.categories, tag_name);

  // Extract main text from abstract and text fields
  const mainText = getMainText(articleData);

  return {
    reading,
    header,
    mainText,
  };
}

/**
 * Extracts headers from breadcrumbs and categories
 * Falls back to categories if breadcrumbs are not available
 */
function getHeaders(
  breadcrumbs: BreadcrumbItem[] | null,
  categories: string[] | undefined,
  tag_name: string,
): string[] {
  let headers: string[] = [];

  // Try to use breadcrumbs first
  if (breadcrumbs && breadcrumbs.length > 0) {
    headers = breadcrumbs.map((bc) => bc.tagName);
  }
  // Fall back to categories if breadcrumbs are not available
  else if (categories && categories.length > 0) {
    headers = [...categories];
  }

  // Always add the tag name at the end
  if (!headers.includes(tag_name)) {
    headers.push(tag_name);
  }

  if (!headers.length) {
    throw new Error(`No headers found for tag: ${tag_name}`);
  }

  return headers;
}

/**
 * Extracts main text from article data
 * Combines abstract and the main text
 */
function getMainText(articleData: ArticleData): string {
  const abstract = articleData.abstract || '';
  const text = articleData.text || '';

  // If we have both abstract and text, combine them
  if (abstract && text) {
    return `${abstract}\n\n${text}`;
  }

  // Otherwise return whichever one we have
  return abstract || text || '';
}
