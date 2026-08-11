const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const dotenv = require("dotenv");
const path = require("path");

// Load .env from the backend root
const envPath = path.resolve(__dirname, '../.env');
console.log("Loading .env from:", envPath);
dotenv.config({ path: envPath });

console.log("\n========================================");
console.log("S3 Configuration Test");
console.log("========================================");
console.log("Bucket:", process.env.AWS_S3_BUCKET_NAME || "❌ Missing");
console.log("Region:", process.env.AWS_REGION || "❌ Missing");
console.log("Access Key ID:", process.env.AWS_ACCESS_KEY_ID ? "✅ Set" : "❌ Missing");
console.log("Secret Access Key:", process.env.AWS_SECRET_ACCESS_KEY ? "✅ Set" : "❌ Missing");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Test 1: Basic S3 Connection
 */
async function testS3Connection() {
  console.log("\n========================================");
  console.log("Test 1: S3 Connection Test");
  console.log("========================================");
  
  try {
    console.log("📤 Sending request to S3...");
    
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      MaxKeys: 5,
    });
    
    const response = await s3Client.send(command);
    console.log("✅ S3 connection successful!");
    console.log(`📁 Bucket contents: ${response.Contents?.length || 0} files found`);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log("\n📄 First few files:");
      response.Contents.slice(0, 3).forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.Key} (${file.Size} bytes)`);
      });
    }
    
    return response.Contents || [];
  } catch (error) {
    console.error("❌ S3 connection failed:", error.message);
    if (error.name === "AccessDenied") {
      console.error("🔒 Access Denied - Check IAM permissions");
      console.error("   Go to AWS Console → IAM → Users → omondibunde32@gmail.com");
      console.error("   Attach AmazonS3FullAccess policy");
    } else if (error.name === "NoSuchBucket") {
      console.error("🪣 Bucket not found - Check bucket name and region");
    } else if (error.name === "InvalidAccessKeyId") {
      console.error("🔑 Invalid Access Key ID - Check your credentials");
    }
    return [];
  }
}

/**
 * Test 2: Signed URL Generation
 */
async function testSignedUrl(fileKey) {
  console.log("\n========================================");
  console.log("Test 2: Signed URL Generation Test");
  console.log("========================================");
  console.log(`📄 File key: ${fileKey}`);
  
  if (!fileKey) {
    console.log("⚠️ No file key provided, skipping test");
    return;
  }
  
  try {
    console.log("🔐 Generating signed URL...");
    
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    console.log("✅ Signed URL generated successfully!");
    console.log(`🔗 URL (truncated): ${url.substring(0, 100)}...`);
    console.log("\n📋 Full URL (copy this to browser to test):");
    console.log(url);
    
    return url;
  } catch (error) {
    console.error("❌ Error generating signed URL:", error.message);
    
    if (error.name === "AccessDenied") {
      console.error("🔒 Access Denied - IAM user needs s3:GetObject permission");
    } else if (error.name === "NoSuchKey") {
      console.error("📁 File not found - Check if the key exists in S3");
      console.error(`   Key attempted: ${fileKey}`);
    } else if (error.message.includes("region")) {
      console.error("🌍 Region mismatch - Check AWS_REGION in .env");
    }
    return null;
  }
}

/**
 * Test 3: Check Specific File
 */
async function testFileExists(fileKey) {
  console.log("\n========================================");
  console.log("Test 3: File Existence Check");
  console.log("========================================");
  console.log(`📄 Checking: ${fileKey}`);
  
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
    });
    
    await s3Client.send(command);
    console.log("✅ File exists in S3!");
    return true;
  } catch (error) {
    console.error("❌ File not found:", error.message);
    
    if (error.name === "NoSuchKey") {
      console.error("📁 The file doesn't exist at this key");
      
      // Try to find similar files
      console.log("\n🔍 Listing files to help find the correct key...");
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: fileKey.split('/').pop() || fileKey,
        MaxKeys: 10,
      });
      
      try {
        const listResponse = await s3Client.send(listCommand);
        if (listResponse.Contents && listResponse.Contents.length > 0) {
          console.log(`Found ${listResponse.Contents.length} files with similar names:`);
          listResponse.Contents.forEach((file) => {
            console.log(`   - ${file.Key}`);
          });
        } else {
          console.log("No similar files found");
        }
      } catch (listError) {
        console.log("Could not list files:", listError.message);
      }
    }
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log("\n🚀 Starting S3 Tests...");
  console.log("========================================\n");
  
  // Test 1: Connection
  const files = await testS3Connection();
  
  if (files && files.length > 0) {
    // Get the first file key for testing
    const testKey = files[0].Key;
    console.log(`\n📌 Using first file for tests: ${testKey}`);
    
    // Test 2: Signed URL
    await testSignedUrl(testKey);
    
    // Test 3: File existence
    await testFileExists(testKey);
    
    // Extra: Check the specific file from your database
    console.log("\n========================================");
    console.log("Test 4: Database File Check");
    console.log("========================================");
    const dbKey = "./storage/f2b43c49-20e1-491c-be76-11438adc3af0.png";
    console.log(`📄 Database key: ${dbKey}`);
    
    const dbFileExists = await testFileExists(dbKey);
    if (dbFileExists) {
      console.log("✅ Database key is correct!");
      await testSignedUrl(dbKey);
    } else {
      console.log("\n💡 The database key doesn't exist in S3.");
      console.log("You need to update the database to match the actual S3 key.");
      console.log("Check the file listing above to find the correct key.");
    }
  } else {
    console.log("\n⚠️ No files found in bucket. Upload a file first.");
  }
  
  console.log("\n========================================");
  console.log("✅ Tests Complete");
  console.log("========================================");
}

// Run all tests
runAllTests();
