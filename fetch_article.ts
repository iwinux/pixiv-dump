import { fetchURL } from './src/fetch/fetchURL';
import { PIXIV_BASE_URL } from './src/constants';
import * as fs from 'fs';

const tag_name = 'フリーレン';
const url = `${PIXIV_BASE_URL}a/${encodeURIComponent(tag_name)}`;

async function main() {
  try {
    const response = await fetchURL(url);
    fs.writeFileSync('/tmp/frieren_article.html', response.data);
    console.log('Saved to /tmp/frieren_article.html');
    console.log('Content length:', response.data.length);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
