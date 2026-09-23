import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export function imageSources(values) {
  const headers = values[1].map(h => String(h).normalize('NFC').trim().toLowerCase());
  const column = headers.findIndex(h => ['link ảnh url', 'ảnh', 'image_url'].includes(h));
  const sources = new Map();
  if (column < 0) return sources;
  for (const row of values.slice(2)) {
    if (row[headers.indexOf('sales_region_code')] !== 'MIENNAM') continue;
    const id = String(row[headers.indexOf('product_id')]);
    const url = String(row[column] || '').trim();
    if (!url) continue;
    if (sources.has(id) && sources.get(id) !== url) throw new Error(`Conflicting image URLs for product ${id}`);
    sources.set(id, url);
  }
  return sources;
}

export function imageExtension(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255,216,255]))) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())) return 'gif';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (bytes.subarray(4, 8).toString() === 'ftyp' && ['avif','avis'].includes(bytes.subarray(8, 12).toString())) return 'avif';
  throw new Error('Response is not a supported raster image');
}

export async function syncImages(root, products, values, fetchImpl = fetch) {
  const sources = imageSources(values);
  const directory = resolve(root, 'images/sheet');
  await mkdir(directory, {recursive:true});
  const manifestPath = resolve(directory, 'manifest.json');
  let manifest = {};
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const updated = products.map(p => ({...p}));
  const failures = [];
  let downloaded = 0;
  const jobs = updated.filter(p => sources.has(String(p.productId)));
  async function saveImage(id, source, input) {
    imageExtension(input);
    const bytes = await sharp(input, {limitInputPixels:40000000}).rotate().resize(1000,1000,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0,32);
    const image = `images/sheet/${hash}.webp`;
    await writeFile(resolve(root, image), bytes);
    manifest[id] = {source,image,optimized:1}; downloaded++;
    return image;
  }
  async function worker() {
    while (jobs.length) {
      const product = jobs.shift();
      const id = String(product.productId);
      const source = sources.get(id);
      try {
        const url = new URL(source);
        // This is the product-image CDN supplied in Data san; no credentials or arbitrary network targets.
        if (url.protocol !== 'https:' || url.hostname !== 'cdn-gcs.thuocsi.vn' || url.username || url.password || url.port) throw new Error('Unsupported image host');
        const cached = manifest[id];
        if (cached?.source === source && /^images\/sheet\/[a-f0-9]{32}\.(jpg|png|webp|gif|avif)$/.test(cached.image)) {
          try {
            await access(resolve(root, cached.image));
            product.image = cached.optimized === 1 ? cached.image : await saveImage(id, source, await readFile(resolve(root,cached.image)));
            continue;
          } catch {}
        }
        const response = await fetchImpl(url, {signal:AbortSignal.timeout(30000), redirect:'error'});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const limit = 10 * 1024 * 1024;
        if (Number(response.headers.get('content-length')) > limit) throw new Error('Image exceeds 10 MB');
        const chunks = []; let size = 0;
        for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw new Error('Image exceeds 10 MB'); chunks.push(chunk); }
        product.image = await saveImage(id,source,Buffer.concat(chunks));
      } catch(error) { failures.push({productId:id, reason:error.message}); }
    }
  }
  await Promise.all(Array.from({length:6}, worker));
  if (downloaded) await writeFile(manifestPath, JSON.stringify(manifest,null,2)+'\n');
  return {products:updated,downloaded,failures};
}
