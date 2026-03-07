import axios, { AxiosError, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { FETCH_DELAY_MS } from '../constants';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Extracts the actual response data from FlareSolverr's HTML-wrapped response.
 * For JSON endpoints, the browser wraps JSON in <pre> tags with HTML-encoded entities.
 * For HTML endpoints, returns the HTML as-is.
 */
function extractResponseData(html: string): any {
  // Try parsing as JSON directly first
  try {
    return JSON.parse(html);
  } catch {}

  // Try to extract JSON from <pre> tags (browser wraps raw JSON in HTML)
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch) {
    try {
      return JSON.parse(decodeHtmlEntities(preMatch[1]));
    } catch {}
  }

  // Return as-is (HTML page)
  return html;
}

/**
 * Gets the data from a URL and returns the response.
 * When FLARESOLVERR_URL is set, routes every request through FlareSolverr
 * to bypass Cloudflare's managed challenge.
 */
export async function fetchURL(url: string): Promise<AxiosResponse> {
  await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));

  const flaresolverrUrl = process.env.FLARESOLVERR_URL;
  if (!flaresolverrUrl) {
    axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
    return axios.get(url);
  }

  const response = await axios.post(flaresolverrUrl, {
    cmd: 'request.get',
    url,
    maxTimeout: 60000,
  });

  if (response.data.status !== 'ok') {
    throw new Error(`FlareSolverr error: ${response.data.message}`);
  }

  const solution = response.data.solution;
  const status = solution.status;
  const rawResponse = solution.response;
  const rawType = typeof rawResponse;
  const rawLen = rawType === 'string' ? rawResponse.length : JSON.stringify(rawResponse).length;
  console.log(
    `[fetchURL] url=${url} status=${status} rawType=${rawType} rawLen=${rawLen} rawPreview=${(rawType === 'string' ? rawResponse : JSON.stringify(rawResponse)).substring(0, 150)}`,
  );
  const data = extractResponseData(solution.response);
  const dataType = typeof data;
  console.log(
    `[fetchURL] after extractResponseData: dataType=${dataType} isString=${typeof data === 'string'} len=${typeof data === 'string' ? data.length : JSON.stringify(data).length}`,
  );

  const axiosResponse: AxiosResponse = {
    data,
    status,
    statusText: status === 200 ? 'OK' : `HTTP ${status}`,
    headers: solution.headers || {},
    config: {} as any,
  };

  if (status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
      {} as any,
      null,
      axiosResponse,
    );
  }

  return axiosResponse;
}
