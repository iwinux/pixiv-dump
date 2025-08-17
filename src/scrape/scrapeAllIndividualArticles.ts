import cliProgress from 'cli-progress';
import { prisma } from '..';
import { scrapeSingleArticleInfo } from './scrapeSingleArticleInfo';

/**
 * Scrape all readings for articles that have not been scraped yet or have been updated since the last scrape.
 */
export async function scrapeAllIndividualArticles() {
  // Find articles that need individual scraping:
  // 1. Articles never scraped individually (lastScrapedArticle IS NULL) - prioritized first
  // 2. Articles updated since last individual scrape (lastScraped > lastScrapedArticle)
  // We need to use queryRaw because these fields are saved as strings of numbers.
  const articles = await prisma.$queryRaw<Array<{ tag_name: string }>>`
    SELECT tag_name
    FROM PixivArticle
    WHERE lastScrapedArticle IS NULL
      OR (
        lastScraped IS NOT NULL
        AND lastScrapedArticle IS NOT NULL
        AND lastScraped GLOB '[0-9]*'
        AND lastScrapedArticle GLOB '[0-9]*'
        AND CAST(lastScraped AS INTEGER) > CAST(lastScrapedArticle AS INTEGER)
      )
    ORDER BY lastScrapedArticle IS NULL DESC, tag_name
  `;

  console.log(`Scraping ${articles.length} individual articles`);

  const progressBar = new cliProgress.SingleBar(
    {
      format:
        'Progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} Articles',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  progressBar.start(articles.length, 0);

  let i = 0;
  for (const { tag_name } of articles) {
    try {
      const { reading, header, mainText } =
        await scrapeSingleArticleInfo(tag_name);
      await prisma.pixivArticle.update({
        where: { tag_name },
        data: {
          lastScrapedArticle: Date.now().toString(),
          reading,
          header: JSON.stringify(header),
          mainText,
        },
      });
    } catch (error) {
      console.error(`Error scraping article ${tag_name}: ${error}`);
    }
    i++;
    progressBar.update(i);
  }
  progressBar.stop();
}
