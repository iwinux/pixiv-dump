import axios, { AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { FETCH_DELAY_MS } from '../constants';

/**
 * Gets the data from a URL and returns the response.
 * Uses FlareSolverr to bypass Cloudflare challenges when available.
 */
export async function fetchURL(url: string): Promise<AxiosResponse> {
  await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
  axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

  const flaresolverrUrl = process.env.FLARESOLVERR_URL;

  if (flaresolverrUrl) {
    // Use FlareSolverr to bypass Cloudflare
    try {
      const flaresolverrResponse = await axios.post(flaresolverrUrl, {
        cmd: 'request.get',
        url: url,
        maxTimeout: 60000,
      });

      if (flaresolverrResponse.data.status !== 'ok') {
        throw new Error(
          `FlareSolverr error: ${flaresolverrResponse.data.message}`,
        );
      }

      const contentType =
        flaresolverrResponse.data.solution?.headers?.['content-type'] || '';
      let data: unknown;

      if (contentType.includes('application/json')) {
        data = JSON.parse(flaresolverrResponse.data.solution.response);
      } else {
        data = flaresolverrResponse.data.solution.response;
      }

      // Return a response object compatible with AxiosResponse
      return {
        data,
        status: flaresolverrResponse.data.solution.status,
        statusText: 'OK',
        headers: flaresolverrResponse.data.solution?.headers || {},
        config: {} as any,
      };
    } catch (error) {
      console.error(
        'FlareSolverr request failed, falling back to direct axios request',
      );
    }
  }

  // Fallback to direct axios request
  const response = await axios.get(url);
  return response;
}
