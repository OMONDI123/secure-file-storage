declare module 'multer-s3' {
  import { S3Client } from '@aws-sdk/client-s3';
  import { StorageEngine } from 'multer';

  interface MulterS3Options {
    s3: S3Client;
    bucket: string | ((req: any, file: any, cb: (err: any, bucket: string) => void) => void);
    acl?: string;
    contentType?: ((req: any, file: any, cb: (err: any, mime?: string) => void) => void) | string; // ✅ Allow string
    key?: (req: any, file: any, cb: (err: any, key?: string) => void) => void;
    metadata?: (req: any, file: any, cb: (err: any, metadata?: any) => void) => void;
    cacheControl?: string;
    serverSideEncryption?: string;
    sseKmsKeyId?: string;
    storageClass?: string;
    tags?: (req: any, file: any) => any;
  }

  function multerS3(options: MulterS3Options): StorageEngine;
  export = multerS3;
}
