import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config.js';

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.AWS_REGION,
    });
  }
  return client;
}

