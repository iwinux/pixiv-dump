import { test, expect } from 'bun:test';
import { scrapeSingleArticleInfo } from '../scrape/scrapeSingleArticleInfo';

test('scrapeSingleArticleInfo should not return null values for フリーレン', async () => {
  const frierenTag = 'フリーレン';
  const { reading, header, mainText } =
    await scrapeSingleArticleInfo(frierenTag);

  console.log('scrapeSingleArticleInfo result', {
    reading,
    header,
    mainTextLength: mainText?.length ?? 0,
    mainTextSample: mainText?.slice(0, 200) ?? '',
  });

  expect(reading).toBeTruthy();
  expect(mainText).toBeTruthy();
  expect(Array.isArray(header)).toBe(true);
  expect(header.length).toBeGreaterThan(0);
});
