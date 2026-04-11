import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StorageService {
	private readonly client: S3Client;
	private readonly bucket: string;

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
	}

	async generatePresignedUploadUrl(
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

	async deleteObject(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
		);
	}
}
