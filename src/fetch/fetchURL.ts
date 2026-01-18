import axios, { AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { FETCH_DELAY_MS } from '../constants';

/**
 * Gets the data from a URL and returns the response.
 */
export async function fetchURL(url: string): Promise<AxiosResponse> {
  await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
  axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
  const baseHeaders = {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en;q=0.9',
    Referer: 'https://www.google.com/',
  };

  const userAgents = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  ];

  let lastError: unknown;

  for (const ua of userAgents) {
    try {
      return await axios.get(url, {
        headers: { ...baseHeaders, 'User-Agent': ua },
      });
    } catch (error) {
      lastError = error;

      // If Cloudflare issued a cookie, try once more with it
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 403 &&
        error.response.headers['set-cookie']?.length
      ) {
        const cookie = error.response.headers['set-cookie'].join('; ');
        try {
          return await axios.get(url, {
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

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}
