import { test, expect } from 'bun:test';
import { scrapeSingleArticleInfo } from '../scrape/scrapeSingleArticleInfo';

test('scrapeSingleArticleInfo should not return null values for フリーレン', async () => {
  const frierenTag = 'フリーレン';
  const { reading, header, mainText } =
    await scrapeSingleArticleInfo(frierenTag);

  // Log values for verification in GitHub Actions
  console.log('Reading:', reading);
  console.log('Header:', header);
  console.log('Main text length:', mainText?.length || 0);
  console.log(
    'Main text preview:',
    mainText?.substring(0, 100) || '(empty)',
  );

  expect(reading).toBeTruthy();
  expect(mainText).toBeTruthy();
  expect(Array.isArray(header)).toBe(true);
  expect(header.length).toBeGreaterThan(0);
});
