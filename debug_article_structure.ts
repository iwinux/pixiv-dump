/**
 * Debug script to analyze the HTML structure of a Pixiv article page.
 * Run this with: bun run debug_article_structure.ts
 *
 * This will help identify the correct selectors when the page structure changes.
 */

import { JSDOM } from 'jsdom';
import { fetchURL } from './src/fetch/fetchURL';
import { PIXIV_BASE_URL } from './src/constants';

const tag_name = 'フリーレン';
const url = `${PIXIV_BASE_URL}a/${encodeURIComponent(tag_name)}`;

async function debugArticleStructure() {
  try {
    console.log(`Fetching article: ${url}\n`);
    const response = await fetchURL(url);
    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Debug: Check if article-content-header exists
    const headerElement = document.getElementById('article-content-header');
    console.log('=== HEADER ELEMENT ===');
    console.log('exists:', !!headerElement);
    if (headerElement) {
      console.log(
        'innerHTML (first 500 chars):',
        headerElement.innerHTML.substring(0, 500),
      );
      console.log('\nAll children with classes:');
      const children = headerElement.querySelectorAll('*');
      children.forEach((child, i) => {
        if (child.className) {
          console.log(
            `  ${i}: <${child.tagName.toLowerCase()}> class="${child.className}"`,
          );
          if (child.textContent && child.textContent.trim().length < 50) {
            console.log(`     text: "${child.textContent.trim()}"`);
          }
        }
      });
    }

    // Debug: Check for breadcrumbs
    console.log('\n=== BREADCRUMBS ===');
    const breadcrumbs = document.querySelectorAll(
      'a[gtm-class=article-breadcrumbs_link]',
    );
    console.log('count:', breadcrumbs.length);
    breadcrumbs.forEach((bc, i) => {
      console.log(`  ${i}: "${bc.textContent}"`);
    });

    // Try alternative breadcrumb selectors
    const altBreadcrumbs1 = document.querySelectorAll(
      '[class*="breadcrumb"] a',
    );
    console.log(
      '\nAlternative breadcrumbs ([class*="breadcrumb"] a):',
      altBreadcrumbs1.length,
    );

    // Debug: Check for article abstract
    console.log('\n=== ARTICLE ABSTRACT ===');
    const abstractElement = document.getElementById('article-abstract');
    console.log('exists:', !!abstractElement);
    if (abstractElement) {
      const paragraphs = abstractElement.querySelectorAll('p');
      console.log('paragraph count:', paragraphs.length);
      paragraphs.forEach((p, i) => {
        console.log(`  ${i}: "${p.textContent?.substring(0, 100)}..."`);
      });
    }

    // Debug: Check for first section
    console.log('\n=== FIRST SECTION ===');
    const firstSection = document.querySelector('div[data-header-id=h2_0]');
    console.log('exists:', !!firstSection);
    if (firstSection) {
      const paragraphs = firstSection.querySelectorAll('p');
      console.log('paragraph count:', paragraphs.length);
    }

    // Look for any elements that might contain reading/pronunciation
    console.log('\n=== POTENTIAL READING ELEMENTS ===');
    const potentialReadings = document.querySelectorAll(
      '[class*="reading"], [class*="pronunciation"], [class*="text-text"]',
    );
    console.log(
      'Found elements with reading-related classes:',
      potentialReadings.length,
    );
    potentialReadings.forEach((el, i) => {
      console.log(
        `  ${i}: <${el.tagName.toLowerCase()}> class="${el.className}"`,
      );
      if (el.textContent && el.textContent.trim().length < 100) {
        console.log(`     text: "${el.textContent.trim()}"`);
      }
    });

    // Save HTML for manual inspection
    const fs = await import('fs');
    const htmlPath = '/tmp/frieren_article_debug.html';
    fs.writeFileSync(htmlPath, response.data);
    console.log(`\n✅ Full HTML saved to: ${htmlPath}`);
    console.log('\nYou can inspect this file to find the correct selectors.');
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

debugArticleStructure();
