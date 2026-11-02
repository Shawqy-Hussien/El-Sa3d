import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface StorageUpload {
  originalName: string;
  buffer: Buffer;
  mimeType?: string;
}

export interface StorageAdapter {
  uploadFile(file: StorageUpload): Promise<string>;
  deleteFile(url: string): Promise<void>;
}

export class LocalDiskStorageAdapter implements StorageAdapter {
  constructor(
    private readonly rootDir = path.resolve(
      process.cwd(),
      'storage',
      'uploads',
    ),
  ) {}

  async uploadFile(file: StorageUpload): Promise<string> {
    await fs.mkdir(this.rootDir, { recursive: true });
    const ext = path.extname(file.originalName) || '.bin';
    const fileName = `${randomUUID()}${ext}`;
    const target = path.join(this.rootDir, fileName);
    await fs.writeFile(target, file.buffer);
    return `/uploads/${fileName}`;
  }

  async deleteFile(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return;
    const target = path.join(this.rootDir, path.basename(url));
    await fs.rm(target, { force: true });
  }
}

export class S3CompatibleStorageAdapter implements StorageAdapter {
  private readonly client: S3Client;

  constructor(
    private readonly endpoint: string,
    private readonly bucket: string,
    region: string,
    accessKeyId?: string,
    secretAccessKey?: string,
    private readonly publicUrl?: string,
  ) {
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  async uploadFile(file: StorageUpload): Promise<string> {
    const extension = path.extname(file.originalName) || '.bin';
    const key = `${randomUUID()}${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
      }),
    );
    return this.publicUrl
      ? `${this.publicUrl.replace(/\/$/, '')}/${key}`
      : `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
  }

  async deleteFile(url: string): Promise<void> {
    const key = url.split('/').pop();
    if (!key) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
