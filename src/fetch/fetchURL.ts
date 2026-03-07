import axios, { AxiosError, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { FETCH_DELAY_MS } from '../constants';

let cachedCookies: string | null = null;
let cachedUserAgent: string | null = null;

/**
 * Solves the Cloudflare challenge via FlareSolverr and caches
 * the resulting cookies and user-agent for direct axios requests.
 */
async function solveChallenge(
  flaresolverrUrl: string,
  targetUrl: string,
): Promise<void> {
  const response = await axios.post(flaresolverrUrl, {
    cmd: 'request.get',
    url: targetUrl,
    maxTimeout: 60000,
  });

  if (response.data.status !== 'ok') {
    throw new Error(`FlareSolverr error: ${response.data.message}`);
  }

  const solution = response.data.solution;
  cachedUserAgent = solution.userAgent || null;
  cachedCookies =
    solution.cookies
      ?.map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ') || null;
}

/**
 * Gets the data from a URL and returns the response.
 * When FLARESOLVERR_URL is set, solves the Cloudflare challenge once
 * and reuses cookies/user-agent for subsequent direct requests.
 */
export async function fetchURL(url: string): Promise<AxiosResponse> {
  await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
  axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

  const flaresolverrUrl = process.env.FLARESOLVERR_URL;
  if (!flaresolverrUrl) {
    return axios.get(url);
  }

  if (!cachedCookies) {
    await solveChallenge(flaresolverrUrl, url);
  }

  try {
    return await axios.get(url, {
      headers: {
        ...(cachedCookies && { Cookie: cachedCookies }),
        ...(cachedUserAgent && { 'User-Agent': cachedUserAgent }),
      },
    });
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 403) {
      // Cookies expired or were rejected — re-solve and retry once
      await solveChallenge(flaresolverrUrl, url);
      return axios.get(url, {
        headers: {
          ...(cachedCookies && { Cookie: cachedCookies }),
          ...(cachedUserAgent && { 'User-Agent': cachedUserAgent }),
        },
      });
    }
    throw error;
  }
}
