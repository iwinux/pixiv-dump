import axios, { AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cloudscraper = require('cloudscraper');
import { FETCH_DELAY_MS } from '../constants';

const HTTP_FORBIDDEN = 403;
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
        error.response?.status === HTTP_FORBIDDEN
      ) {
        const setCookieHeader =
          error.response.headers['set-cookie'] ||
          error.response.headers['Set-Cookie'];
        if (!setCookieHeader) {
          // Final attempt with cloudscraper to solve the challenge
          try {
            const body = await cloudscraper.get({
              url,
              headers: { ...baseHeaders, 'User-Agent': ua },
            });
            return {
              data: body,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: { headers: { ...baseHeaders, 'User-Agent': ua } },
              request: {},
            } as AxiosResponse;
          } catch (scrapeError) {
            lastError = scrapeError;
            continue;
          }
        }
        const cookie = Array.isArray(setCookieHeader)
          ? setCookieHeader.join('; ')
          : setCookieHeader;
        if (!cookie || cookie.trim() === '') {
          try {
            const body = await cloudscraper.get({
              url,
              headers: { ...baseHeaders, 'User-Agent': ua },
            });
            return {
              data: body,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: { headers: { ...baseHeaders, 'User-Agent': ua } },
              request: {},
            } as AxiosResponse;
          } catch (scrapeError) {
            lastError = scrapeError;
            continue;
          }
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

  try {
    const body = await cloudscraper.get({
      url,
      headers: { ...baseHeaders, 'User-Agent': USER_AGENTS[0] },
    });
    return {
      data: body,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: { ...baseHeaders, 'User-Agent': USER_AGENTS[0] } },
      request: {},
    } as AxiosResponse;
  } catch (finalError) {
    throw finalError instanceof Error
      ? finalError
      : new Error(`Request failed for ${url}`);
  }
}
