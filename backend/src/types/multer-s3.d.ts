declare module 'multer-s3' {
  import { StorageEngine } from 'multer';
  import { S3Client } from '@aws-sdk/client-s3';
  function multerS3(options: {
    s3: S3Client;
    bucket: string;
    metadata?: (req: any, file: any, cb: any) => void;
    key?: (req: any, file: any, cb: any) => void;
    contentType?: any;
  }): StorageEngine;
  namespace multerS3 {
    const AUTO_CONTENT_TYPE: any;
  }
  export = multerS3;
}
