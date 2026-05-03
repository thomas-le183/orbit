import {
  CreateBucketCommand,
  DeleteObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>("STORAGE_ENDPOINT");
    const forcePathStyle =
      config.get<string>("STORAGE_FORCE_PATH_STYLE") === "true";

    this.client = new S3Client({
      region: config.getOrThrow<string>("STORAGE_REGION"),
      credentials: {
        accessKeyId: config.getOrThrow<string>("STORAGE_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow<string>("STORAGE_SECRET_KEY"),
      },
      ...(endpoint ? { endpoint, forcePathStyle } : {}),
    });

    this.bucket = config.getOrThrow<string>("STORAGE_BUCKET");

    const storageEndpoint = config.get<string>("STORAGE_ENDPOINT") ?? "";
    this.publicBaseUrl = `${storageEndpoint}/${this.bucket}`;
  }

  async onModuleInit() {
    await this.ensureBucketExists();
    await this.ensurePublicReadPolicy();
  }

  private async ensureBucketExists() {
    try {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.bucket }),
      );
      this.logger.log(`Bucket "${this.bucket}" created`);
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? "";
      if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
        this.logger.warn(`Could not create bucket: ${name}`);
      }
    }
  }

  private async ensurePublicReadPolicy() {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: [
            `arn:aws:s3:::${this.bucket}/avatars/*`,
            `arn:aws:s3:::${this.bucket}/logos/*`,
          ],
        },
      ],
    });
    try {
      await this.client.send(
        new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: policy }),
      );
      this.logger.log(`Public-read policy applied to avatars/* and logos/*`);
    } catch (err: unknown) {
      this.logger.warn(
        `Could not set bucket policy (configure manually if needed): ${(err as Error).message}`,
      );
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async generateBrowserPresignedUrl(
    key: string,
    mimeType: string,
    expiresIn = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    fileSize: number,
    expiresIn = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: fileSize,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
