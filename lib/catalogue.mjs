import { readFile, writeFile, copyFile, rename, mkdir, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function validateProducts(input) {
  if (!Array.isArray(input) || input.length > 200) throw invalid('The catalogue must contain an array of up to 200 products.');
  const ids = new Set();
  return input.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid('Product ' + (index + 1) + ' is not an object.');
    function text(key, max = 300, required = false) {
      const value = item[key] ?? '';
      if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
        throw invalid('Product ' + (index + 1) + ': please check the ' + key + ' field.');
      }
      return value.trim();
    }
    const id = text('id', 80, true);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || ids.has(id)) throw invalid('Each product needs a unique ID using lowercase letters, numbers, and hyphens.');
    ids.add(id);
    if (!['service', 'app'].includes(item.category)) throw invalid('Choose a valid category for ' + id + '.');
    if (item.active !== undefined && typeof item.active !== 'boolean') throw invalid('Product visibility must be true or false.');
    const rawPrice = item.price;
    const price = rawPrice === null || rawPrice === undefined || rawPrice === '' ? null : Number(rawPrice);
    if (price !== null && (!['string', 'number'].includes(typeof rawPrice) || !Number.isFinite(price) || price < 0 || price > 1000000)) {
      throw invalid('Price must be blank or a number between 0 and 1,000,000.');
    }
    const features = item.features ?? [];
    if (!Array.isArray(features) || features.length > 15 || features.some(f => typeof f !== 'string' || !f.trim() || f.length > 300)) {
      throw invalid('Use up to 15 features, with one nonempty feature per line.');
    }
    const image = text('image', 1500);
    if (image) {
      const local = /^\/?assets\/[a-zA-Z0-9_./% -]+$/.test(image) && !image.includes('..');
      let remote = false;
      try { remote = new URL(image).protocol === 'https:'; } catch { /* Local asset path. */ }
      if (!local && !remote) throw invalid('Use an assets/ image path or a full HTTPS image URL.');
    }
    const icon = text('icon', 80) || 'fa-gamepad';
    if (!/^fa-[a-z0-9-]+$/.test(icon)) throw invalid('Use an icon name such as fa-gamepad or fa-heart.');
    return {
      id, category: item.category, active: item.active !== false,
      name: text('name', 160, true), subtitle: text('subtitle', 200),
      badge: text('badge', 60), description: text('description', 2400, true),
      features: features.map(f => f.trim()), price,
      billing: text('billing', 160) || (price === null ? 'price confirmed before booking' : 'starting rate'),
      icon, ...(image ? { image } : {}),
      ...(item.whatsappMsg ? { whatsappMsg: text('whatsappMsg', 2000) } : {})
    };
  });
}

export function createProductStore(file) {
  let writes = Promise.resolve();
  async function read() {
    const raw = await readFile(file, 'utf8');
    const products = validateProducts(JSON.parse(raw.replace(/^\uFEFF/, '')));
    return { products, version: createHash('sha256').update(raw).digest('hex') };
  }
  function save(input, version) {
    const operation = writes.catch(() => {}).then(async () => {
      const products = validateProducts(input);
      const current = await read();
      if (!version || version !== current.version) {
        throw invalid('The catalogue changed in another tab. Reload the page before saving again.', 409);
      }
      const temporary = file + '.' + randomUUID() + '.tmp';
      try {
        await mkdir(dirname(file), { recursive: true });
        await copyFile(file, file + '.bak');
        await writeFile(temporary, JSON.stringify(products, null, 2) + '\n', 'utf8');
        await rename(temporary, file);
      } finally {
        await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
      return read();
    });
    writes = operation;
    return operation;
  }
  return { read, save };
}
