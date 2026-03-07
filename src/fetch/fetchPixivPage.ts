import { AxiosError } from 'axios';
import { fetchURL } from './fetchURL';
import { PIXIV_BASE_URL } from '../constants';

const pixivPage = (category: string, page: number) =>
  `${PIXIV_BASE_URL}${
    category ? 'category/' + category : ''
  }?json=1&page=${page}`;

function isPixivNotFoundHtml(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  return (
    /<title>\s*NotFound\s/i.test(raw) ||
    /<body[^>]*id=["']page-notfound["']/i.test(raw)
  );
}

async function fetchPixivPage(
  category: string,
  page: number,
): Promise<PixivPageResponse> {
  const url = pixivPage(category, page);
  const response = await fetchURL(url);

  const rawData = response.data;

  if (isPixivNotFoundHtml(rawData)) {
    const notFoundResponse = { ...response, status: 404, statusText: 'Not Found' };
    throw new AxiosError(
      `Pixiv page not found (soft-404): ${url}`,
      'ERR_BAD_REQUEST',
      response.config,
      undefined,
      notFoundResponse,
    );
  }

  if (!rawData.meta) {
    throw new Error(`Missing meta in response: ${JSON.stringify(rawData)}`);
  }
  if (rawData.meta.all_count == undefined) {
    throw new Error(
      `Missing all_count in response: ${JSON.stringify(rawData.meta)}`,
    );
  }
  if (rawData.meta.count === undefined) {
    throw new Error(
      `Missing count in response: ${JSON.stringify(rawData.meta)}`,
    );
  }
  if (rawData.meta.page == undefined) {
    throw new Error(
      `Missing page in response: ${JSON.stringify(rawData.meta)}`,
    );
  }
  if (!Array.isArray(rawData.articles)) {
    throw new Error(`Missing articles in response: ${JSON.stringify(rawData)}`);
  }

  return response.data;
}

export default fetchPixivPage;
