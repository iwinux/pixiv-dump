import axios, { AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { FETCH_DELAY_MS } from '../constants';

const httpClient = axios.create();
axiosRetry(httpClient, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const USER_AGENTS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

/**
 * Gets the data from a URL and returns the response.
 */
export async function fetchURL(url: string): Promise<AxiosResponse> {
  await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
  const baseHeaders = {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en;q=0.9',
    Referer: 'https://www.google.com/',
  };

  let lastError: unknown;

  for (const ua of USER_AGENTS) {
    try {
      return await httpClient.get(url, {
        headers: { ...baseHeaders, 'User-Agent': ua },
      });
    } catch (error) {
      lastError = error;

      // If Cloudflare issued a cookie, try once more with it
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 403
      ) {
        const setCookieHeader =
          error.response.headers['set-cookie'] ||
          error.response.headers['Set-Cookie'];
        const cookie = Array.isArray(setCookieHeader)
          ? setCookieHeader.join('; ')
          : setCookieHeader;
        if (!cookie || cookie.trim() === '') {
          continue;
        }
        try {
          return await httpClient.get(url, {
            headers: {
              ...baseHeaders,
              'User-Agent': ua,
              Cookie: cookie,
            },
          });
        } catch (retryErr) {
          lastError = retryErr;
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Request failed for ${url}`);
}
