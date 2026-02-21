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
      });

      if (flaresolverrResponse.data.status !== 'ok') {
        throw new Error(
          `FlareSolverr error: ${flaresolverrResponse.data.message}`,
        );
      }

      const contentType =
        flaresolverrResponse.data.solution?.headers?.['content-type'] || '';
      let responseBody = flaresolverrResponse.data.solution.response;
      let data: unknown;

      // Extract JSON from HTML wrapper if present (browser renders JSON in <pre> tags)
      if (
        typeof responseBody === 'string' &&
        responseBody.includes('<pre>') &&
        responseBody.includes('</pre>')
      ) {
        const preMatch = responseBody.match(/<pre>([\s\S]*?)<\/pre>/);
        if (preMatch) {
          responseBody = preMatch[1];
        }
      }

      // Try to parse as JSON if content-type suggests it or if it looks like JSON
      if (typeof responseBody === 'string') {
        if (
          contentType.includes('application/json') ||
          (responseBody.trim().startsWith('{') || responseBody.trim().startsWith('['))
        ) {
          try {
            data = JSON.parse(responseBody);
          } catch {
            data = responseBody;
          }
        } else {
          data = responseBody;
        }
      } else {
        data = responseBody;
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
        'FlareSolverr request failed, falling back to direct axios request:',
        error,
      );
    }
  }

  // Fallback to direct axios request
  const response = await axios.get(url);
  return response;
}
