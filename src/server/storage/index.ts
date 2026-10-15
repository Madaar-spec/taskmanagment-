// التخزين: مجلد محلي في التطوير، بواجهة قابلة للاستبدال بتخزين كائنات S3 (القسم 8)
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AwsClient } from 'aws4fetch';

export interface StorageDriver {
  put(key: string, data: Uint8Array, mimeType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}

class LocalStorage implements StorageDriver {
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('invalid storage key');
    return full;
  }
  async put(key: string, data: Uint8Array) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.resolve(key)));
  }
}

/** متوافق مع Amazon S3 وأي تخزين بواجهة S3 (مثل Supabase Storage أو MinIO) */
class S3Storage implements StorageDriver {
  private readonly client: AwsClient;
  constructor(
    private readonly endpoint: string,
    private readonly bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new AwsClient({ accessKeyId, secretAccessKey, region, service: 's3' });
  }
  private url(key: string) {
    return `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  async put(key: string, data: Uint8Array, mimeType: string) {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body: Buffer.from(data),
      headers: { 'content-type': mimeType },
    });
    if (!res.ok) throw new Error(`S3 put failed: ${res.status}`);
  }
  async get(key: string) {
    const res = await this.client.fetch(this.url(key));
    if (!res.ok) throw new Error(`S3 get failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  if (process.env.STORAGE_DRIVER === 's3') {
    driver = new S3Storage(
      process.env.S3_ENDPOINT ?? '',
      process.env.S3_BUCKET ?? '',
      process.env.S3_REGION || 'us-east-1',
      process.env.S3_ACCESS_KEY_ID ?? '',
      process.env.S3_SECRET_ACCESS_KEY ?? '',
    );
  } else {
    driver = new LocalStorage(path.resolve(process.env.STORAGE_LOCAL_DIR || './storage'));
  }
  return driver;
}

export function newStorageKey(taskId: string, fileName: string) {
  const ext = path.extname(fileName).replace(/[^.\w]/g, '').slice(0, 10);
  return `tasks/${taskId}/${randomUUID()}${ext}`;
}
