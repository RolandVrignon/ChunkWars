import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Environment variables are configured correctly

const s3Client = new S3Client({
  region: process.env.AWS_REGION as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json();
    console.log("S3_UPLOAD_API: Received request for:", { filename, contentType });

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Filename and contentType are required" }, { status: 400 });
    }

    const uniqueFilename = `${uuidv4()}-${filename}`;
    console.log('S3_UPLOAD_API: Generated filename:', uniqueFilename)

    const putCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME as string,
      Key: uniqueFilename,
      ContentType: contentType,
    });

    const getCommand = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME as string,
      Key: uniqueFilename,
    });

    const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 600 });
    const viewUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 600 });
    console.log("S3_UPLOAD_API: Generated URLs:", { uploadUrl, viewUrl });

    return NextResponse.json({ uploadUrl, viewUrl });
  } catch (error) {
    console.error("Error creating presigned URL", error);
    return NextResponse.json({ error: "Failed to create presigned URL" }, { status: 500 });
  }
}