import cliProgress from 'cli-progress';
import { prisma } from '..';
import {
  scrapeSingleArticleInfo,
  ArticleNotFoundError,
} from './scrapeSingleArticleInfo';

/**
 * Scrape all readings for articles that have not been scraped yet or have been updated since the last scrape.
 */
export async function scrapeAllIndividualArticles(maxArticles?: number) {
  // Find articles that need individual scraping:
  // 1. Articles never scraped individually (lastScrapedArticle IS NULL) - prioritized first
  // 2. Articles updated since last individual scrape (lastScraped > lastScrapedArticle)
  // We need to use queryRaw because these fields are saved as strings of numbers.

  // Newly never-scraped articles (lastScrapedArticle IS NULL)
  const newlyNeverScraped = await prisma.$queryRaw<Array<{ tag_name: string }>>`
    SELECT tag_name
    FROM PixivArticle
    WHERE lastScrapedArticle IS NULL
    ORDER BY CAST(lastScraped as INTEGER) ASC
  `;

  // Updated articles (lastScrapedArticle IS NOT NULL and lastScraped > lastScrapedArticle)
  const updatedArticles = await prisma.$queryRaw<Array<{ tag_name: string }>>`
    SELECT tag_name
    FROM PixivArticle
    WHERE lastScrapedArticle IS NOT NULL
      AND lastScraped IS NOT NULL
      AND lastScraped GLOB '[0-9]*'
      AND lastScrapedArticle GLOB '[0-9]*'
      AND CAST(lastScraped AS INTEGER) > CAST(lastScrapedArticle AS INTEGER)
    ORDER BY CAST(lastScraped AS INTEGER) ASC,
             tag_name
  `;

  let articles = [...newlyNeverScraped, ...updatedArticles];

  if (maxArticles !== undefined && articles.length > maxArticles) {
    console.log(
      `[scrapeAll] Limiting from ${articles.length} to ${maxArticles} articles (--max-articles)`,
    );
    articles = articles.slice(0, maxArticles);
  }

  console.log(
    `[scrapeAll] Scraping ${articles.length} individual articles (${newlyNeverScraped.length} newly added, ${updatedArticles.length} updated)`,
  );
  if (articles.length === 0) {
    console.log('[scrapeAll] WARNING: No articles to scrape! Checking DB state...');
    const totalCount = await prisma.pixivArticle.count();
    const nullCount = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM PixivArticle WHERE lastScrapedArticle IS NULL
    `;
    console.log(`[scrapeAll] Total articles: ${totalCount}, with NULL lastScrapedArticle: ${JSON.stringify(nullCount)}`);
  } else {
    console.log(`[scrapeAll] First 5 articles to scrape: ${articles.slice(0, 5).map(a => a.tag_name).join(', ')}`);
  }

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

  let progressBarIndex = 0;
  for (const { tag_name } of articles) {
    try {
      const { reading, header, mainText } =
        await scrapeSingleArticleInfo(tag_name);
      console.log(
        `[scrapeAll] Updating ${tag_name}: reading=${reading.substring(0, 30)} header=${JSON.stringify(header).substring(0, 50)} mainText.length=${mainText.length}`,
      );
      await prisma.pixivArticle.update({
        where: { tag_name },
        data: {
          lastScrapedArticle: Date.now().toString(),
          reading,
          header: JSON.stringify(header),
          mainText,
        },
      });
      // Verify the update was persisted
      if (progressBarIndex < 3) {
        const verify = await prisma.pixivArticle.findUnique({
          where: { tag_name },
          select: { mainText: true, lastScrapedArticle: true },
        });
        console.log(
          `[scrapeAll] Verify ${tag_name}: mainText.length=${verify?.mainText?.length ?? 'NULL'} lastScrapedArticle=${verify?.lastScrapedArticle}`,
        );
      }
    } catch (error) {
      if (error instanceof ArticleNotFoundError) {
        console.log(`Article not found, removing from database: ${tag_name}`);
        await prisma.pixivArticle.delete({
          where: { tag_name },
        });
      } else {
        console.error(`[scrapeAll] Error scraping article ${tag_name}: ${error}`);
      }
    }
    progressBarIndex++;
    progressBar.update(progressBarIndex);
    if (progressBarIndex % 1000 === 0) {
      console.log(`Processed ${progressBarIndex} articles`);
    }
    if (progressBarIndex === newlyNeverScraped.length) {
      console.log(`All newly added articles processed`);
    }
  }
  progressBar.stop();
}
