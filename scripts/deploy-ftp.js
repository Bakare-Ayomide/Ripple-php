import * as ftp from "basic-ftp";
import * as path from "path";
import * as fs from "fs";

async function deploy() {
  console.log("-----------------------------------------");
  console.log("🚀 Starting Ripple FTP cPanel Deployment");
  console.log("-----------------------------------------");

  const client = new ftp.Client();
  client.ftp.verbose = false; // We will handle our own clean, detailed logging

  const ftpHost = "131.153.147.178";
  const ftpUser = "ripple@ripple.zerolord.com";
  const ftpPassword = process.env.FTP_PASSWORD || "@F33rinimicinode";

  try {
    const uploadPlan = [];
    const distPath = path.join(process.cwd(), "dist");

    // 1. Crawl 'dist' directory for built frontend client assets
    if (fs.existsSync(distPath)) {
      function crawl(dirPath, remoteDir) {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const localFilePath = path.join(dirPath, item);
          const remoteFilePath = path.posix.join(remoteDir, item);
          if (fs.statSync(localFilePath).isDirectory()) {
            crawl(localFilePath, remoteFilePath);
          } else {
            uploadPlan.push({
              local: localFilePath,
              remoteDir: remoteDir,
              remoteFile: item,
              remoteFull: remoteFilePath.startsWith("./") ? remoteFilePath : "./" + remoteFilePath
            });
          }
        }
      }
      crawl(distPath, ".");
    } else {
      throw new Error("Local build 'dist' directory not found. Please run 'npm run build' first before deploying.");
    }

    // 2. Add backend PHP API entrypoint
    const apiPhpPath = path.join(process.cwd(), "api.php");
    if (fs.existsSync(apiPhpPath)) {
      uploadPlan.push({
        local: apiPhpPath,
        remoteDir: "backend",
        remoteFile: "api.php",
        remoteFull: "./backend/api.php"
      });
    }

    // 3. Add .htaccess redirection rules
    const htaccessPath = path.join(process.cwd(), ".htaccess");
    if (fs.existsSync(htaccessPath)) {
      uploadPlan.push({
        local: htaccessPath,
        remoteDir: ".",
        remoteFile: ".htaccess",
        remoteFull: "./.htaccess"
      });
    }

    // Print the proposed plan for immediate verification as requested by the user
    console.log("\n=================================================================");
    console.log("📋 PROPOSED DEPLOYMENT UPLOAD PREVIEW");
    console.log("=================================================================");
    for (const item of uploadPlan) {
      console.log(`📍 Source: ${path.relative(process.cwd(), item.local)}`);
      console.log(`   ➡️ Target:  ${item.remoteFull}`);
    }
    console.log("\n📁 Directories to verify/create:");
    console.log("   - ./uploads");
    console.log("   - ./posts");
    console.log("   - ./backend");
    console.log("=================================================================\n");

    console.log(`🔒 Connecting to ${ftpHost} as ${ftpUser}...`);
    let connected = false;
    try {
      client.ftp.timeout = 10000; // 10 seconds timeout for TLS handshake
      await client.access({
        host: ftpHost,
        user: ftpUser,
        password: ftpPassword,
        port: 21,
        secure: true,
        secureOptions: {
          rejectUnauthorized: false
        }
      });
      console.log("✅ Secure FTPS Connection established.");
      connected = true;
    } catch (tlsErr) {
      console.warn(`⚠️ Secure connection attempt failed (${tlsErr.message}). Retrying over standard FTP...`);
      client.close();
    }

    if (!connected) {
      await client.access({
        host: ftpHost,
        user: ftpUser,
        password: ftpPassword,
        port: 21,
        secure: false
      });
      console.log("✅ Standard FTP Connection established.");
    }

    // Ensure stateful base folder environments are setup
    console.log("📂 Verifying stateful public directories on cPanel...");
    await client.ensureDir("uploads");
    await client.ensureDir("posts");
    await client.ensureDir("backend");

    console.log("📤 Starting secure sequential file uploads...");
    for (const item of uploadPlan) {
      console.log(`🚀 Uploading: [Local] ${path.relative(process.cwd(), item.local)}`);
      console.log(`   ➡️  To Remote Path: ${item.remoteFull}`);
      
      // Ensure specific target directory exists and navigate into it
      await client.ensureDir(item.remoteDir);
      // Upload under the current target directory
      await client.uploadFrom(item.local, item.remoteFile);
    }

    console.log("\n=========================================");
    console.log("🎉 SUCCESS! Deployment of Ripple is complete.");
    console.log("🌐 Live URL: https://ripple.zerolord.com");
    console.log("=========================================");

  } catch (err) {
    console.error("\n❌ Deployment failed:", err);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
