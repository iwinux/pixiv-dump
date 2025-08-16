import { JSDOM } from 'jsdom';
import { fetchURL } from '../fetch/fetchURL';
import { PIXIV_BASE_URL } from '../constants';
const pixivArticleURL = (tag_name: string) =>
  `${PIXIV_BASE_URL}a/${encodeURIComponent(tag_name)}`;

/**
 * Scrapes a single Pixiv article page for its reading label, breadcrumb headers, and main text.
 *
 * Builds the article URL from `tag_name`, fetches the page, parses the HTML, and extracts:
 * - `reading`: the small reading label from the article header,
 * - `header`: breadcrumb texts (appended with the original `tag_name`),
 * - `mainText`: concatenated abstract and first section text.
 *
 * @param tag_name - Pixiv tag path used to construct the article URL (e.g., a tag or slug portion)
 * @returns An object with `{ reading, header, mainText }`.
 * @throws Error if required headers are not found (propagates errors from the underlying helpers).
 */
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

/**
 * Extracts breadcrumb header texts from the document and appends the provided tag name.
 *
 * Queries anchor elements with attribute `gtm-class="article-breadcrumbs_link"` and collects their text content.
 * If no breadcrumb anchors are present, an Error is thrown including the `tag_name`.
 *
 * @param tag_name - The original tag name to append to the returned header list.
 * @returns An array of header strings followed by `tag_name`.
 * @throws Error if no breadcrumb headers are found in the document.
 */
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

/**
 * Extracts the article's "reading" text from the header or returns an empty string if not found.
 *
 * Looks for an element with id `article-content-header` and returns the textContent of its
 * child matching the selector `.my-4.text-text3.typography-12`, or `''` when absent.
 *
 * @returns The reading text (or an empty string when the element is missing).
 */
function getReading(document: Document) {
  return (
    document
      .getElementById('article-content-header')
      ?.querySelector('.my-4.text-text3.typography-12')?.textContent || ''
  );
}

/**
 * Extracts the article's main text by concatenating the abstract and the first section.
 *
 * Searches for paragraph (<p>) elements under the element with id `article-abstract` and
 * under the first section container `div[data-header-id=h2_0]`. Non-empty paragraph texts
 * from each area are joined with single newlines. If both areas are empty or missing, an
 * empty string is returned. When at least one area has content, the result is
 * `articleAbstractText + "\n\n" + firstSectionText` (either part may be empty).
 *
 * @param document - The DOM Document of the article page to extract text from.
 * @returns The concatenated main text (possibly empty).
 */
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
