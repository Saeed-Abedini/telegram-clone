import { S3 } from "aws-sdk";

const uploadFile = async (file: File) => {
  try {
    const s3 = new S3({
      accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY,
      secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_KEY,
      endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT,
      s3ForcePathStyle: true,
    });
    const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("S3 bucket name is not defined");
    }

    const uniqueFileName = `${file.name}-${Date.now()}`;

    const params = {
      Bucket: bucketName,
      Key: encodeURIComponent(uniqueFileName),
      Body: file,
    };

    await s3.upload(params).promise();

    const permanentSignedUrl = s3.getSignedUrl("getObject", {
      Bucket: bucketName,
      Key: encodeURIComponent(uniqueFileName),
      Expires: 31536000000,
    });

    return permanentSignedUrl;
  } catch (error) {
    console.error("Upload failed:", error);
  }
};

export default uploadFile;
