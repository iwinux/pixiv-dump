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

      const httpStatus = flaresolverrResponse.data.solution.status;
      const contentType =
        flaresolverrResponse.data.solution?.headers?.['content-type'] || '';
      let responseBody = flaresolverrResponse.data.solution.response;

      console.log(
        `FlareSolverr response: status=${httpStatus}, contentType=${contentType}, url=${url}`,
      );
      console.log(
        `Response body type: ${typeof responseBody}, length: ${typeof responseBody === 'string' ? responseBody.length : 'N/A'}`,
      );
      if (typeof responseBody === 'string') {
        console.log(
          `First 100 chars: ${responseBody.substring(0, 100)}`,
        );
      }

      // If not successful, throw an error to match axios behavior
      if (httpStatus < 200 || httpStatus >= 300) {
        const error = new Error(`Request failed with status code ${httpStatus}`) as any;
        error.response = {
          status: httpStatus,
          statusText: 'Error',
          data: responseBody,
          headers: flaresolverrResponse.data.solution?.headers || {},
        };
        throw error;
      }

      let data: unknown;

      // Extract JSON from HTML wrapper if present (browser renders JSON in <pre> tags)
      if (
        typeof responseBody === 'string' &&
        responseBody.includes('<pre>') &&
        responseBody.includes('</pre>')
      ) {
        const preMatch = responseBody.match(/<pre>([\s\S]*?)<\/pre>/);
        if (preMatch) {
          console.log(`Extracted JSON from <pre> tags, new length: ${preMatch[1].length}`);
          responseBody = preMatch[1];
        } else {
          console.log(`Failed to extract from <pre> tags despite finding them`);
        }
      }

      // Try to parse as JSON if content-type suggests it or if it looks like JSON
      if (typeof responseBody === 'string') {
        // Check if response looks like JSON
        if (
          contentType.includes('application/json') ||
          (responseBody.trim().startsWith('{') || responseBody.trim().startsWith('['))
        ) {
          try {
            data = JSON.parse(responseBody);
          } catch {
            // If JSON parsing fails, just return the string
            console.warn(`Failed to parse JSON response, returning as string`);
            data = responseBody;
          }
        } else if (responseBody.trim().startsWith('<')) {
          // HTML response - likely an error page, return as-is for caller to handle
          console.warn(
            `Received HTML response instead of JSON - this is likely a Pixiv error page`,
          );
          data = responseBody;
        } else {
          data = responseBody;
        }
      } else {
        data = responseBody;
      }

      // Return a response object compatible with AxiosResponse
      return {
        data,
        status: httpStatus,
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
