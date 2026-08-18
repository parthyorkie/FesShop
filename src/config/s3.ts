import { S3Client } from '@aws-sdk/client-s3';
import { config } from './config';

// Load AWS config from environment
const { AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = config;

// In tests we may not provide real AWS credentials.
// Fall back to a dummy bucket when environment variables are missing.
const region = AWS_REGION || 'us-east-1';
const bucketName = AWS_S3_BUCKET || 'dummy-bucket';

if (!AWS_REGION && !AWS_S3_BUCKET) {
  console.warn('S3 config missing; using dummy bucket for tests');
}

export const s3Client = new S3Client({
  region,
  credentials: AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export const S3_BUCKET = bucketName;
