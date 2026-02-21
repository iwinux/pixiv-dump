import fetchPixivPage from '../fetch/fetchPixivPage';
import { getTotalPageCount } from './getTotalPageCount';

/**
 * Finds the page number in a category to start scraping
 * from based on the last scraped date.
 * Binary search to find the page number.
 * Finds the page with a date that is more recent than
 * the last scraped date so it comes earlier in the list.
 */
export async function findPageNumberAtDate(
  category: string,
  dateToFind: string,
) {
  const totalPageCount = await getTotalPageCount(category);
  let left = 1;
  let right = totalPageCount;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    try {
      const midPageData = await fetchPixivPage(category, mid);
      // If we got a string (HTML error page), treat as out of range
      if (typeof midPageData === 'string') {
        right = mid;
      } else {
        const midPageDate = new Date(midPageData.articles[0].updated_at);
        if (midPageDate < new Date(dateToFind)) {
          right = mid;
        } else {
          left = mid + 1;
        }
      }
    } catch (error: any) {
      // If we get a 404, this page doesn't exist - treat as upper bound
      if (error.response?.status === 404) {
        right = mid;
      } else {
        // Re-throw other errors
        throw error;
      }
    }
    console.log(`Searching for ${dateToFind} in ${category}: ${left} ${right}`);
  }
  const pageNum = Math.max(left - 1, 1);
  let pageData;
  try {
    pageData = await fetchPixivPage(category, pageNum);
  } catch (error: any) {
    // If final page also doesn't exist, return the calculated pageNum
    if (error.response?.status === 404) {
      console.log(
        `Page ${pageNum} returned 404, using as boundary page`,
      );
      return pageNum;
    }
    throw error;
  }

  // If we got HTML instead of JSON, treat as boundary
  if (typeof pageData === 'string') {
    console.log(
      `Page ${pageNum} returned HTML (likely 404), using as boundary page`,
    );
    return pageNum;
  }

  console.log(
    `Found ${dateToFind} in ${category} at page ${pageNum} with date ${new Date(
      pageData.articles[0].updated_at,
    )}`,
  );
  return pageNum;
}
