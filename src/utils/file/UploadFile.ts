import { S3 } from "aws-sdk";
import compressImage from "./CompressImage";

const checkNetworkConnectivity = async (): Promise<boolean> => {
  if (!navigator.onLine) {
    return false; // No internet connection detected by browser
  }
  // Try to ping a reliable server to check actual connectivity
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
    await fetch("https://www.google.com/favicon.ico", {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.error("Network check failed:", error);
    return false;
  }
};

const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
) => {
  let uploadFile: File = file;

  if (file.type.match("image.*")) {
    uploadFile = await compressImage(file);
  }

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

    const uniqueFileName = `${Date.now()}-${uploadFile.name}`;
    const url = file.type.match("image.*") ? "images/" : "voices/";
    const params = {
      Bucket: bucketName,
      Key: url + encodeURIComponent(uniqueFileName),
      Body: uploadFile,
    };

    if (onProgress) {
      const upload = s3.upload(params);
      upload.on("httpUploadProgress", (progress) => {
        if (progress.total) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          onProgress(percent);
        }
      });
      await upload.promise();
    } else {
      await s3.upload(params).promise();
    }

    const permanentSignedUrl = s3.getSignedUrl("getObject", {
      Bucket: bucketName,
      Key: url + encodeURIComponent(uniqueFileName),
      Expires: 31536000000,
    });

    return permanentSignedUrl;
  } catch (error) {
    console.error("Upload failed:", error);
  }
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds

const uploadFileWithRetry = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error?: string; downloadUrl?: string }> => {
  const isConnected = await checkNetworkConnectivity();
  if (!isConnected) {
    return {
      success: false,
      error:
        "Network connection unavailable. Please check your internet connection.",
    };
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const result = await uploadFile(file, onProgress);
      return { success: true, downloadUrl: result };
    } catch (error: unknown) {
      if (i < MAX_RETRIES - 1) {
        console.warn(
          `Upload failed, retrying in ${
            RETRY_DELAY_MS / 1000
          } seconds... (Attempt ${i + 1}/${MAX_RETRIES})`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.error("Max retries reached. Upload failed permanently.", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Upload failed permanently.",
        };
      }
    }
  }
  return { success: false, error: "Unknown error during upload." };
};

export default uploadFileWithRetry;
