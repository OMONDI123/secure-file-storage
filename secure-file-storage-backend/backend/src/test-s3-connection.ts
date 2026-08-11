const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const path = require("path");

// Load .env from the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log("Testing S3 connection...");
console.log("Bucket:", process.env.AWS_S3_BUCKET_NAME);
console.log("Region:", process.env.AWS_REGION);
console.log("Access Key ID:", process.env.AWS_ACCESS_KEY_ID ? "✅ Set" : "❌ Missing");
console.log("Secret Access Key:", process.env.AWS_SECRET_ACCESS_KEY ? "✅ Set" : "❌ Missing");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testS3Connection() {
  try {
    console.log("\n📤 Sending request to S3...");
    
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      MaxKeys: 1,
    });
    
    const response = await s3Client.send(command);
    console.log("✅ S3 connection successful!");
    console.log("📁 Bucket contents:", response.Contents?.length || 0, "files found");
    
    if (response.Contents && response.Contents.length > 0) {
      console.log("📄 First file:", response.Contents[0].Key);
    }
  } catch (error) {
    console.error("❌ S3 connection failed:", error.message);
    if (error.name === "AccessDenied") {
      console.error("🔒 Access Denied - Check IAM permissions");
    } else if (error.name === "NoSuchBucket") {
      console.error("🪣 Bucket not found - Check bucket name and region");
    } else if (error.name === "InvalidAccessKeyId") {
      console.error("🔑 Invalid Access Key ID - Check your credentials");
    }
  }
}

testS3Connection();
