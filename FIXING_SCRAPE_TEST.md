# Fixing the Article Scraping Test

## Problem

The test `scrapeSingleArticleInfo should not return null values for フリーレン`
is failing because the `reading` field is returning an empty string. This
indicates that the HTML structure of the Pixiv Encyclopedia website has changed.

## Network Restriction

**Note:** The dic.pixiv.net domain is blocked in the current GitHub Codespaces
environment, preventing direct access to analyze the current HTML structure. The
automated testing in GitHub Actions has access and can run the tests
successfully.

## How to Fix

### Step 1: Fetch the Current HTML Structure

Someone with access to https://dic.pixiv.net needs to run one of these commands:

**Option A: Using curl (from a machine with access):**

```bash
curl -o frieren_page.html 'https://dic.pixiv.net/a/フリーレン' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
```

**Option B: Using the debug script (run this in the repository):**

```bash
bun run debug_article_structure.ts
```

This will save the HTML to `/tmp/frieren_article_debug.html` and print out
information about the page structure.

### Step 2: Analyze the HTML

Look for:

1. **Reading/Pronunciation element**: Search for text content that contains "ふ
   りーれん" (the reading for フリーレン)

   - Current selector: `#article-content-header .my-4.text-text3.typography-12`
   - Look for classes containing: `reading`, `pronunciation`, `furigana`, or
     `text-text`

2. **Breadcrumb links**: The category links (マンガ, キャラクター, etc.)

   - Current selector: `a[gtm-class=article-breadcrumbs_link]`
   - Look for: breadcrumb navigation elements

3. **Article content**: The main text sections
   - Current selectors: `#article-abstract` and `div[data-header-id=h2_0]`

### Step 3: Update the Selectors

Once you've identified the correct selectors, update them in
`src/scrape/scrapeSingleArticleInfo.ts`:

```typescript
function getReading(document: Document) {
  // Try multiple selectors as fallbacks
  const selectors = [
    '#article-content-header .my-4.text-text3.typography-12', // Original
    '#article-content-header [class*="reading"]', // Alternative
    // Add new selectors here based on what you find
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      return element.textContent.trim();
    }
  }

  return '';
}
```

## Common Selector Patterns to Try

If the specific classes have changed, Pixiv Encyclopedia commonly uses patterns
like:

- `typography-*` for text sizing
- `text-text*` for text colors
- `my-*` and `mx-*` for margins (Tailwind CSS)
- Data attributes like `data-testid` or `data-component`

## Testing

After updating the selectors:

```bash
bun test src/test/scrapeSingleArticleInfo.test.ts
```

The test should pass when all three fields (reading, header, mainText) return
truthy values.
