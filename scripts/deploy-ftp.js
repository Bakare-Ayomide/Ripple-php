import * as ftp from "basic-ftp";
import * as path from "path";
import * as fs from "fs";

async function runDeployment() {
  console.log("-----------------------------------------");
  console.log("🚀 Starting Ripple FTP cPanel Deployment");
  console.log("-----------------------------------------");

  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    console.log("🔒 Connecting with explicit FTPS (Port 21)...");
    await client.access({
      host: "ftp.zerolord.com",
      user: "ripple@ripple.zerolord.com",
      password: "@f33rinimi",
      port: 21,
      secure: true,
      secureOptions: {
        rejectUnauthorized: false
      }
    });
    console.log("✅ Secure FTPS Connection established.");
  } catch (secErr) {
    const errorMsg = secErr instanceof Error ? secErr.message : String(secErr);
    console.warn(`⚠️ Secure connection failed: ${errorMsg}`);
    console.log("🔌 Retrying with standard plain FTP connection...");
    try {
      await client.access({
        host: "ftp.zerolord.com",
        user: "ripple@ripple.zerolord.com",
        password: "@f33rinimi",
        port: 21,
        secure: false
      });
      console.log("✅ Plain FTP Connection established.");
    } catch (err) {
      const finalMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ FTP Connection failed: ${finalMsg}`);
      process.exit(1);
    }
  }

  const remoteRootDir = "/home/zerolord/public_html/ripple.zerolord.com";
  console.log(`📁 Navigating to target directory: ${remoteRootDir}`);

  try {
    await client.ensureDir(remoteRootDir);
    
    console.log("🖥️ Uploading frontend static assets from 'dist' directory to root...");
    const distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      throw new Error(`Local build 'dist' directory not found. Please run 'npm run build' first.`);
    }
    
    // ensureDir is at remoteRootDir, uploadFromDir transfers files recursively maintaining hierarchy
    await client.uploadFromDir(distPath);
    console.log("✅ All compiled files inside 'dist' uploaded to root.");

    console.log("⚙️ Uploading backend files to /backend subfolder...");
    const backendRemoteDir = `${remoteRootDir}/backend`;
    await client.ensureDir(backendRemoteDir);
    
    const apiPhpPath = path.join(process.cwd(), "api.php");
    if (fs.existsSync(apiPhpPath)) {
      console.log("📤 Uploading api.php to /backend/api.php...");
      await client.uploadFrom(apiPhpPath, "api.php");
      console.log("✅ api.php uploaded successfully under /backend.");
    } else {
      console.warn("⚠️ Local api.php file not found, skipping.");
    }

    // Go back to remote root to upload HTACCESS and create posts directory
    await client.ensureDir(remoteRootDir);

    const htaccessPath = path.join(process.cwd(), ".htaccess");
    if (fs.existsSync(htaccessPath)) {
      console.log("📤 Uploading .htaccess...");
      await client.uploadFrom(htaccessPath, ".htaccess");
      console.log("✅ .htaccess uploaded successfully at root.");
    } else {
      console.warn("⚠️ Local .htaccess file not found, skipping.");
    }

    // Pre-create public directories to prevent first-run errors
    console.log("📂 Ensuring public folders '/uploads' and '/posts' exist on remote server...");
    await client.ensureDir(`${remoteRootDir}/uploads`);
    await client.ensureDir(`${remoteRootDir}/posts`);

    console.log("\n=========================================");
    console.log("🎉 SUCCESS! Deployment of Ripple is complete.");
    console.log(`🌐 Live URL: https://ripple.zerolord.com`);
    console.log("=========================================");

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Deployment failed with error: ${errorMsg}`);
    process.exit(1);
  } finally {
    client.close();
  }
}

runDeployment();
