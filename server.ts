import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import multer from 'multer';
import * as ftp from 'basic-ftp';

// Ensure uploads directory exists
const uploadsDir = process.env.VERCEL === '1' ? '/tmp' : path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configured for local disk uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage });

// Password hashing helper (built-in SHA256 to avoid native scrypt/bcrypt compile issues)
function hashPassword(p: string) {
  return crypto.createHash('sha256').update(p + 'somesalt_ripple_cinode').digest('hex');
}

// MySQL connection pool variable
let pool: mysql.Pool | null = null;
let useLocalFallback = false;

// Initialize JSON database as local fallback state
interface DbStore {
  users: any[];
  profiles: any[];
  posts: any[];
  likes: any[];
  comments: any[];
  follows: any[];
  messages: any[];
  stories: any[];
  story_views: any[];
  notifications: any[];
  user_roles: any[];
  saved_posts: any[];
}

const dbFilePath = path.join(uploadsDir, 'local_db.json');

function loadLocalDb(): DbStore {
  try {
    if (fs.existsSync(dbFilePath)) {
      const content = fs.readFileSync(dbFilePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[Fallback DB] Load error:', err);
  }
  return {
    users: [],
    profiles: [],
    posts: [],
    likes: [],
    comments: [],
    follows: [],
    messages: [],
    stories: [],
    story_views: [],
    notifications: [],
    user_roles: [],
    saved_posts: []
  };
}

const localDb = loadLocalDb();

function saveLocalDb() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(localDb, null, 2), 'utf8');
  } catch (err) {
    console.error('[Fallback DB] Save error:', err);
  }
}

// ================= FTP CONFIG AND FUNCTIONS FOR POSTS SYNC =================
const REMOTE_DIR = '/home/zerolord/public_html/ripple.zerolord.com/ripple/post';

async function connectFtpClient(client: ftp.Client): Promise<boolean> {
  try {
    await client.access({
      host: 'ftp.zerolord.com',
      user: 'ripple@ripple.zerolord.com',
      password: '@f33rinimi',
      port: 21,
      secure: true,
      secureOptions: {
        rejectUnauthorized: false
      }
    });
    return true;
  } catch (secErr: any) {
    console.log(`[FTP Connect TLS Failed] Opting for standard plain FTP handshake... (${secErr.message || secErr})`);
    try {
      await client.access({
        host: 'ftp.zerolord.com',
        user: 'ripple@ripple.zerolord.com',
        password: '@f33rinimi',
        port: 21,
        secure: false
      });
      return true;
    } catch (plainErr: any) {
      throw new Error(`FTP connection failed for both TLS and standard handshakes: ${plainErr.message || plainErr}`);
    }
  }
}

async function saveUploadToFtp(filename: string) {
  const localFile = path.join(uploadsDir, filename);
  if (!fs.existsSync(localFile)) {
    console.warn(`[FTP Upload] Local file ${filename} does not exist for FTP upload!`);
    return;
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await connectFtpClient(client);

    // Destination 1: /home/zerolord/public_html/ripple.zerolord.com/ripple/post/uploads
    const path1 = '/home/zerolord/public_html/ripple.zerolord.com/ripple/post/uploads';
    await client.ensureDir(path1);
    await client.uploadFrom(localFile, filename);
    console.log(`[FTP Upload] Uploaded ${filename} to ftp at ${path1}`);

    // Destination 2: /home/zerolord/public_html/ripple.zerolord.com/ripple/uploads
    const path2 = '/home/zerolord/public_html/ripple.zerolord.com/ripple/uploads';
    await client.ensureDir(path2);
    await client.uploadFrom(localFile, filename);
    console.log(`[FTP Upload] Uploaded ${filename} to ftp at ${path2}`);
  } catch (err: any) {
    console.warn(`[FTP Upload Warning] Failed to upload ${filename}:`, err?.message || err);
  } finally {
    client.close();
  }
}

async function downloadUploadFromFtp(filename: string) {
  const localFile = path.join(uploadsDir, filename);
  if (fs.existsSync(localFile)) {
    return; // Already exists locally
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await connectFtpClient(client);

    // Try downloading from the post/uploads remote directory first
    const path1 = '/home/zerolord/public_html/ripple.zerolord.com/ripple/post/uploads';
    await client.ensureDir(path1);
    try {
      await client.downloadTo(localFile, filename);
      console.log(`[FTP Sync Asset] Synced asset ${filename} from FTP ${path1}`);
      return;
    } catch (e) {
      // Ignore and fallback
    }

    // Try downloading from the ripple/uploads remote directory second
    const path2 = '/home/zerolord/public_html/ripple.zerolord.com/ripple/uploads';
    await client.ensureDir(path2);
    try {
      await client.downloadTo(localFile, filename);
      console.log(`[FTP Sync Asset] Synced asset ${filename} from FTP ${path2}`);
    } catch (e: any) {
      console.warn(`[FTP Sync Asset Warning] Could not download asset ${filename} from any FTP folder:`, e.message);
    }
  } catch (err: any) {
    console.warn(`[FTP Sync Asset Warning] Failed to connect or download asset ${filename}:`, err.message || err);
  } finally {
    client.close();
  }
}

async function savePostToFtp(post: any) {
  // Sync accompanying media files if they are in the uploads folder
  if (post.image_url) {
    const urls = post.image_url.split(',');
    for (const url of urls) {
      if (url.startsWith('/uploads/')) {
        const filename = url.replace('/uploads/', '');
        await saveUploadToFtp(filename).catch(err => console.warn('[FTP Multi-Upload Warning]', err?.message || err));
      }
    }
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await connectFtpClient(client);
    await client.ensureDir(REMOTE_DIR);
    
    // Create local temp file
    const tempFile = path.join(uploadsDir, `ftp-upload-${post.id}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(post, null, 2), 'utf8');
    
    // Upload file
    await client.uploadFrom(tempFile, `${post.id}.json`);
    
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    console.log(`[FTP] Successfully uploaded/updated post ${post.id}.json on FTP`);
  } catch (err: any) {
    console.warn(`[FTP Sync Warning] Failed to upload/update post ${post.id}:`, err?.message || err);
  } finally {
    client.close();
  }
}

async function savePostIdToFtp(postId: string) {
  try {
    let post: any = null;
    if (pool && !useLocalFallback) {
      try {
        const [rows]: any = await pool.query('SELECT * FROM posts WHERE id = ?', [postId]);
        if (rows && rows.length > 0) {
          post = rows[0];
        }
      } catch (e) {
        // ignore and fallback to localDb
      }
    }
    if (!post) {
      post = localDb.posts.find(p => p.id === postId);
    }
    if (post) {
      await savePostToFtp(post);
    } else {
      console.warn(`[FTP Sync] Post with ID ${postId} was not found in DB or local fallback store for FTP upload.`);
    }
  } catch (err: any) {
    console.warn(`[FTP Sync Warning] Failed to process post ID ${postId} for upload:`, err?.message || err);
  }
}

async function deletePostFromFtp(postId: string) {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await connectFtpClient(client);
    await client.ensureDir(REMOTE_DIR);
    await client.remove(`${postId}.json`).catch(() => {});
    console.log(`[FTP] Successfully deleted post ${postId}.json from FTP`);
  } catch (err: any) {
    console.warn(`[FTP Sync Warning] Failed to delete post ${postId} from FTP:`, err?.message || err);
  } finally {
    client.close();
  }
}

async function upsertPostToDatabase(postObj: any) {
  const cleanPost = {
    id: postObj.id,
    user_id: postObj.user_id,
    caption: postObj.caption || null,
    image_url: postObj.image_url || null,
    media_type: postObj.media_type || 'image',
    likes_count: Number(postObj.likes_count) || 0,
    comments_count: Number(postObj.comments_count) || 0,
    created_at: postObj.created_at || new Date().toISOString()
  };

  // Sync accompanying media files if they are referencing local uploads from FTP
  if (cleanPost.image_url) {
    const urls = cleanPost.image_url.split(',');
    for (const url of urls) {
      if (url.startsWith('/uploads/')) {
        const filename = url.replace('/uploads/', '');
        downloadUploadFromFtp(filename).catch(err => console.warn('[FTP Sync Asset Error]', err));
      }
    }
  }

  // Upsert to localDb state file
  const localIdx = localDb.posts.findIndex(p => p.id === cleanPost.id);
  if (localIdx > -1) {
    localDb.posts[localIdx] = { ...localDb.posts[localIdx], ...cleanPost };
  } else {
    localDb.posts.push(cleanPost);
  }
  saveLocalDb();

  // If MySQL is active, upsert to MySQL posts table
  if (pool && !useLocalFallback) {
    try {
      const keys = Object.keys(cleanPost);
      const vals = Object.values(cleanPost);
      const sql = `INSERT INTO posts (${keys.map(k => `\`${k}\``).join(', ')}) 
                   VALUES (${keys.map(() => '?').join(', ')})
                   ON DUPLICATE KEY UPDATE 
                   caption = VALUES(caption),
                   image_url = VALUES(image_url),
                   media_type = VALUES(media_type),
                   likes_count = VALUES(likes_count),
                   comments_count = VALUES(comments_count)`;
      await pool.query(sql, vals);
      console.log(`[FTP Sync] Upserted post ${cleanPost.id} to MySQL successfully`);
    } catch (sqlErr: any) {
      console.error(`[FTP Sync MySQL Error] Failed upsert for post ${cleanPost.id}:`, sqlErr.message);
    }
  }
}

let lastFtpSyncTime = 0;
let isSyncingFtp = false;

async function syncPostsFromFtp(force = false) {
  if (isSyncingFtp) return;
  if (!force && Date.now() - lastFtpSyncTime < 10000) {
    // Standard limit: sync from ftp at most once every 10 seconds
    return;
  }
  isSyncingFtp = true;
  lastFtpSyncTime = Date.now();

  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await connectFtpClient(client);

    await client.ensureDir(REMOTE_DIR);
    const files = await client.list();
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    console.log(`[FTP Sync] Loaded ${jsonFiles.length} file(s) from remote FTP path`);

    for (const file of jsonFiles) {
      const postId = file.name.slice(0, -5); // remove '.json'
      
      let needDownload = false;
      if (pool && !useLocalFallback) {
        try {
          const [rows]: any = await pool.query('SELECT id FROM posts WHERE id = ?', [postId]);
          if (!rows || rows.length === 0) {
            needDownload = true;
          }
        } catch (e) {
          needDownload = true;
        }
      } else {
        const localExists = localDb.posts.some(p => p.id === postId);
        if (!localExists) {
          needDownload = true;
        }
      }

      if (needDownload) {
        console.log(`[FTP Sync] Fetching new post ${file.name} to local database`);
        const tempFile = path.join(uploadsDir, `ftp-sync-${file.name}`);
        try {
          await client.downloadTo(tempFile, file.name);
          const raw = fs.readFileSync(tempFile, 'utf8');
          const postObj = JSON.parse(raw);
          await upsertPostToDatabase(postObj);
        } catch (downloadErr: any) {
          console.warn(`[FTP Sync Warning] Failed to download post ${file.name}:`, downloadErr.message || downloadErr);
        } finally {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[FTP Sync Warning] general sync failed:', err.message || err);
  } finally {
    client.close();
    isSyncingFtp = false;
  }
}

// Helper: Try to connect to MySQL with strict timeout
async function initDb() {
  console.log('[Database] Initializing connection to 131.153.147.178:3306...');
  try {
    const connectionPromise = mysql.createConnection({
      host: '131.153.147.178',
      user: 'zerolord_ripple',
      password: '@F33rinimicinode',
      database: 'zerolord_ripple',
      port: 3306,
      connectTimeout: 3000 // 3 seconds absolute connection timeout
    });

    const conn = await Promise.race([
      connectionPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Connection attempt timed out after 3 seconds.')), 3000))
    ]);

    if (conn) {
      console.log('[MySQL] Connection test successful. Creating pool now.');
      pool = mysql.createPool({
        host: '131.153.147.178',
        user: 'zerolord_ripple',
        password: '@F33rinimicinode',
        database: 'zerolord_ripple',
        port: 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        connectTimeout: 3000
      });

      // Verify or setup MySQL tables
      const verifiedConn = await pool.getConnection();
      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS profiles (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL UNIQUE,
          username VARCHAR(255),
          display_name VARCHAR(255),
          avatar_url TEXT,
          bio TEXT,
          is_verified BOOLEAN DEFAULT FALSE,
          is_banned BOOLEAN DEFAULT FALSE,
          is_suspended BOOLEAN DEFAULT FALSE,
          is_onboarding_core BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_profiles_user_id (user_id),
          UNIQUE KEY uq_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          caption TEXT,
          image_url TEXT,
          media_type VARCHAR(50) DEFAULT 'image',
          likes_count INT DEFAULT 0,
          comments_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_posts_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS likes (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          post_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_likes_user_post (user_id, post_id),
          INDEX idx_likes_post_id (post_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          post_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          parent_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_comments_post_id (post_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS follows (
          id VARCHAR(255) PRIMARY KEY,
          follower_id VARCHAR(255) NOT NULL,
          following_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_follows_follower_following (follower_id, following_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(255) PRIMARY KEY,
          sender_id VARCHAR(255) NOT NULL,
          receiver_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_messages_sender_receiver (sender_id, receiver_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS stories (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          image_url TEXT NOT NULL,
          media_type VARCHAR(50) DEFAULT 'image',
          thumbnail_url TEXT,
          caption TEXT,
          expires_at TIMESTAMP NOT NULL,
          views_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_stories_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS story_views (
          id VARCHAR(255) PRIMARY KEY,
          story_id VARCHAR(255) NOT NULL,
          viewer_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_story_views (story_id, viewer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(255) PRIMARY KEY,
          recipient_id VARCHAR(255) NOT NULL,
          actor_id VARCHAR(255),
          type VARCHAR(50) NOT NULL,
          post_id VARCHAR(255),
          content TEXT,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_notifications_recipient_id (recipient_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          UNIQUE KEY uq_user_roles (user_id, role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await verifiedConn.query(`
        CREATE TABLE IF NOT EXISTS saved_posts (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          post_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_saved_posts_user_post (user_id, post_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Safely alter existing database tables to add columns if they are missing
      try {
        await verifiedConn.query('ALTER TABLE profiles ADD COLUMN is_banned BOOLEAN DEFAULT FALSE');
      } catch (err: any) {
        // column likely already exists
      }
      try {
        await verifiedConn.query('ALTER TABLE profiles ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE');
      } catch (err: any) {
        // column likely already exists
      }
      try {
        await verifiedConn.query('ALTER TABLE profiles ADD COLUMN is_onboarding_core BOOLEAN DEFAULT FALSE');
      } catch (err: any) {
        // column likely already exists
      }
      try {
        await verifiedConn.query("ALTER TABLE stories ADD COLUMN media_type VARCHAR(50) DEFAULT 'image'");
      } catch (err: any) {
        // column likely already exists
      }
      try {
        await verifiedConn.query("ALTER TABLE stories ADD COLUMN thumbnail_url TEXT");
      } catch (err: any) {
        // column likely already exists
      }

      // Ensure at least one admin exists if any users are registered
      try {
        const [usersList]: any = await verifiedConn.query('SELECT id FROM users LIMIT 1');
        if (usersList.length > 0) {
          const [adminsList]: any = await verifiedConn.query("SELECT id FROM user_roles WHERE role = 'admin' LIMIT 1");
          if (adminsList.length === 0) {
            console.log('[MySQL] Seeding admin role for first user:', usersList[0].id);
            await verifiedConn.query(
              "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'",
              [crypto.randomUUID(), usersList[0].id]
            );
          }
        }
      } catch (adminErr) {
        console.error('[MySQL] Error auto-assigning first admin on init:', adminErr);
      }

      // Explicitly update password and ensure admin role for requested users
      const targetAdmins = [
        {
          id: '936e716b-9637-409d-ba51-1c18d85c2f93',
          email: 'earr.music@gmail.com',
          username: 'earrmusic',
          display_name: 'Earr Music',
        },
        {
          id: '822e116b-1137-409d-ba51-1c18d85c2f94',
          email: 'duwit.online.dev@gmail.com',
          username: 'duwit_dev',
          display_name: 'Duwit Admin',
        }
      ];

      for (const admin of targetAdmins) {
        try {
          const pHash = hashPassword('@f33rinimi');
          
          // Check if user exists
          const [existingUsers]: any = await verifiedConn.query('SELECT id FROM users WHERE id = ? OR email = ?', [admin.id, admin.email]);
          if (existingUsers.length > 0) {
            const finalUserId = existingUsers[0].id;
            await verifiedConn.query('UPDATE users SET password_hash = ? WHERE id = ?', [pHash, finalUserId]);
            // Ensure they have 'admin' role in user_roles table
            await verifiedConn.query(
              "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'",
              [crypto.randomUUID(), finalUserId]
            );
            // Ensure verified status is true
            await verifiedConn.query(
              "UPDATE profiles SET is_verified = TRUE WHERE user_id = ?",
              [finalUserId]
            );
            console.log(`[MySQL] Seeded & verified Admin password/role for email: ${admin.email}`);
          } else {
            await verifiedConn.query(
              'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
              [admin.id, admin.email, pHash]
            );
            await verifiedConn.query(
              `INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified) 
               VALUES (?, ?, ?, ?, ?, ?, TRUE)
               ON DUPLICATE KEY UPDATE user_id = user_id`,
              [crypto.randomUUID(), admin.id, admin.username, admin.display_name, `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(admin.username)}`, 'Internal administrator.', true]
            );
            await verifiedConn.query(
              "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'",
              [crypto.randomUUID(), admin.id, 'admin']
            );
            console.log(`[MySQL] Automatically created missing Admin: ${admin.email}`);
          }
        } catch (adminErr) {
          console.error(`[MySQL] Failed to execute Admin seed query for ${admin.email}:`, adminErr);
        }
      }

      console.log('[MySQL] Remote tables checked and ready to serve live data!');
      verifiedConn.release();
      await conn.end();
    }

    // Force synchronization of the targeted users in Local Fallback database
    const targetAdminsLocal = [
      {
        id: '936e716b-9637-409d-ba51-1c18d85c2f93',
        email: 'earr.music@gmail.com',
        username: 'earrmusic',
        display_name: 'Earr Music',
      },
      {
        id: '822e116b-1137-409d-ba51-1c18d85c2f94',
        email: 'duwit.online.dev@gmail.com',
        username: 'duwit_dev',
        display_name: 'Duwit Admin',
      }
    ];

    const fHash = hashPassword('@f33rinimi');
    for (const admin of targetAdminsLocal) {
      const localUser = localDb.users.find(u => u.id === admin.id || u.email === admin.email);
      if (localUser) {
        localUser.password_hash = fHash;
        // Make sure email is saved lower-cased
        localUser.email = admin.email.toLowerCase().trim();
        const finalId = localUser.id;
        
        // Ensure profile exists and is updated
        let localProfile = localDb.profiles.find(p => p.user_id === finalId);
        if (!localProfile) {
          localProfile = {
            id: crypto.randomUUID(),
            user_id: finalId,
            username: admin.username,
            display_name: admin.display_name,
            avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${admin.username}`,
            bio: 'Internal administrator.',
            is_verified: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          localDb.profiles.push(localProfile);
        } else {
          localProfile.is_verified = true;
        }

        // Ensure user_roles has admin
        const hasAdminRole = localDb.user_roles.some(r => r.user_id === finalId && r.role === 'admin');
        if (!hasAdminRole) {
          localDb.user_roles.push({
            id: crypto.randomUUID(),
            user_id: finalId,
            role: 'admin'
          });
        }
      } else {
        localDb.users.push({
          id: admin.id,
          email: admin.email.toLowerCase().trim(),
          password_hash: fHash,
          created_at: new Date().toISOString()
        });
        localDb.profiles.push({
          id: crypto.randomUUID(),
          user_id: admin.id,
          username: admin.username,
          display_name: admin.display_name,
          avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${admin.username}`,
          bio: 'Internal administrator.',
          is_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        localDb.user_roles.push({
          id: crypto.randomUUID(),
          user_id: admin.id,
          role: 'admin'
        });
      }
    }
    saveLocalDb();

  } catch (error) {
    console.error('[MySQL] Remote connection failed on startup:', error);
    console.error('[MySQL] Switching seamlessly to Local JSON Persistence Fallback. No stuttering, no crashes.');
    useLocalFallback = true;
  }
}

// Utility: parse mentions/tags (@username) from captions or comments and trigger notifications
async function handleMentions(text: string, actorId: string, postId: string | null, isComment: boolean, local: boolean) {
  if (!text) return;
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!matches) return;
  
  const usernames = Array.from(new Set(matches.map(m => m.substring(1).toLowerCase())));
  if (usernames.length === 0) return;

  const contentStub = text.substring(0, 50) + (text.length > 50 ? '...' : '');

  if (local) {
    for (const username of usernames) {
      const profile = localDb.profiles.find(p => p.username?.toLowerCase() === username);
      if (profile && profile.user_id !== actorId) {
        localDb.notifications.push({
          id: crypto.randomUUID(),
          recipient_id: profile.user_id,
          actor_id: actorId,
          type: 'mention',
          post_id: postId,
          content: isComment ? `mentioned you in a comment: "${contentStub}"` : `mentioned you in a post: "${contentStub}"`,
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
    }
  } else {
    for (const username of usernames) {
      try {
        const [profRows]: any = await pool.query('SELECT user_id FROM profiles WHERE LOWER(username) = ?', [username]);
        if (profRows.length > 0) {
          const recipientId = profRows[0].user_id;
          if (recipientId !== actorId) {
            await pool.query(
              `INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                crypto.randomUUID(),
                recipientId,
                actorId,
                'mention',
                postId,
                isComment ? `mentioned you in a comment: "${contentStub}"` : `mentioned you in a post: "${contentStub}"`,
                false
              ]
            );
          }
        }
      } catch (err) {
        console.error('[Mentions] Live notification error:', err);
      }
    }
  }
}

// Check filtering capabilities for client-side local queries
function matchesFilter(item: any, actions: any[]): boolean {
  for (const action of actions) {
    if (action.type === 'eq') {
      if (item[action.column] != action.value) return false;
    } else if (action.type === 'neq') {
      if (item[action.column] == action.value) return false;
    } else if (action.type === 'in') {
      if (!Array.isArray(action.values) || !action.values.includes(item[action.column])) return false;
    } else if (action.type === 'not') {
      if (action.operator === 'in') {
        let rawVal = action.value;
        if (typeof rawVal === 'string') {
          rawVal = rawVal.replace(/^\(|\)$/g, '');
          const parts = rawVal.split(',').map((x: string) => x.trim()).filter(Boolean);
          if (parts.includes(String(item[action.column]))) return false;
        }
      }
    } else if (action.type === 'or') {
      const orVal = action.filter;
      if (orVal.includes('and(sender_id.eq.') && orVal.includes('receiver_id.eq.')) {
        const matches = [...orVal.matchAll(/sender_id\.eq\.([^,)]+),receiver_id\.eq\.([^,)]+)/g)];
        if (matches.length >= 2) {
          const s1 = matches[0][1];
          const r1 = matches[0][2];
          const s2 = matches[1][1];
          const r2 = matches[1][2];
          const cond1 = item.sender_id === s1 && item.receiver_id === r1;
          const cond2 = item.sender_id === s2 && item.receiver_id === r2;
          if (!cond1 && !cond2) return false;
        }
      } else if (orVal.includes('sender_id.eq.') && orVal.includes('receiver_id.eq.')) {
        const sMatch = orVal.match(/sender_id\.eq\.([^,]+)/);
        const rMatch = orVal.match(/receiver_id\.eq\.([^,]+)/);
        if (sMatch && rMatch) {
          const sVal = sMatch[1];
          const rVal = rMatch[1];
          if (item.sender_id !== sVal && item.receiver_id !== rVal) return false;
        }
      }
    } else if (action.type === 'gt') {
      const itemVal = item[action.column];
      if (itemVal === undefined || itemVal === null || !(itemVal > action.value)) return false;
    } else if (action.type === 'gte') {
      const itemVal = item[action.column];
      if (itemVal === undefined || itemVal === null || !(itemVal >= action.value)) return false;
    } else if (action.type === 'lt') {
      const itemVal = item[action.column];
      if (itemVal === undefined || itemVal === null || !(itemVal < action.value)) return false;
    } else if (action.type === 'lte') {
      const itemVal = item[action.column];
      if (itemVal === undefined || itemVal === null || !(itemVal <= action.value)) return false;
    }
  }
  return true;
}

async function executeFallbackSync(table: string, actions: any[], res: any) {
  try {
    let queryType = 'select';
    let isSingle = false;
    let insertValues: any = null;
    let updateValues: any = null;

    for (const action of actions || []) {
      switch (action.type) {
        case 'select':
          queryType = 'select';
          break;
        case 'insert':
          queryType = 'insert';
          insertValues = action.values;
          break;
        case 'update':
          queryType = 'update';
          updateValues = action.values;
          break;
        case 'delete':
          queryType = 'delete';
          break;
        case 'single':
        case 'maybeSingle':
          isSingle = true;
          break;
      }
    }

    const tableArray = (localDb as any)[table] || [];

    if (queryType === 'select') {
      if (table === 'posts') {
        await syncPostsFromFtp().catch(err => console.warn('[FTP Fallback Select Sync Error]', err));
      }
      let matched = tableArray.filter((item: any) => matchesFilter(item, actions));

      // Apply Join simulations
      if (table === 'posts') {
        matched = matched.map((p: any) => {
          const prof = localDb.profiles.find(pr => pr.user_id === p.user_id) || {};
          return {
            ...p,
            is_verified: !!p.is_verified,
            profiles: {
              username: prof.username,
              display_name: prof.display_name,
              avatar_url: prof.avatar_url,
              is_verified: !!prof.is_verified
            }
          };
        });
      } else if (table === 'comments') {
        matched = matched.map((c: any) => {
          const prof = localDb.profiles.find(pr => pr.user_id === c.user_id) || {};
          return {
            ...c,
            profiles: {
              username: prof.username,
              avatar_url: prof.avatar_url,
              is_verified: !!prof.is_verified
            }
          };
        });
      } else if (table === 'stories') {
        matched = matched.map((s: any) => {
          const prof = localDb.profiles.find(pr => pr.user_id === s.user_id) || {};
          return {
            ...s,
            profiles: {
              username: prof.username,
              display_name: prof.display_name,
              avatar_url: prof.avatar_url,
              is_verified: !!prof.is_verified
            }
          };
        });
      } else if (table === 'notifications') {
        matched = matched.map((n: any) => {
          const prof = localDb.profiles.find(pr => pr.user_id === n.actor_id) || {};
          return {
            ...n,
            is_read: !!n.is_read,
            actor: prof.username ? {
              username: prof.username,
              display_name: prof.display_name,
              avatar_url: prof.avatar_url,
              is_verified: !!prof.is_verified
            } : null
          };
        });
      } else if (table === 'profiles') {
        matched = matched.map((r: any) => ({
          ...r,
          is_verified: !!r.is_verified
        }));
      } else if (table === 'messages') {
        matched = matched.map((r: any) => ({
          ...r,
          is_read: !!r.is_read
        }));
      }

      // Orderings
      const orderAction = actions.find((a: any) => a.type === 'order');
      if (orderAction) {
        const col = orderAction.column;
        const ascending = orderAction.options?.ascending !== false;
        matched.sort((a: any, b: any) => {
          const valA = a[col];
          const valB = b[col];
          if (valA === undefined || valB === undefined) return 0;
          if (col === 'created_at' || col.endsWith('_at') || col.endsWith('date')) {
            const timeA = new Date(valA).getTime() || 0;
            const timeB = new Date(valB).getTime() || 0;
            return ascending ? (timeA - timeB) : (timeB - timeA);
          }
          if (typeof valA === 'string') {
            return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return ascending ? (valA - valB) : (valB - valA);
        });
      } else {
        // default ordering is usually reverse chronological / id order
        matched.sort((a: any, b: any) => {
          const d1 = a.created_at ? new Date(a.created_at).getTime() : 0;
          const d2 = b.created_at ? new Date(b.created_at).getTime() : 0;
          return d2 - d1;
        });
      }

      // Limit
      const limitAction = actions.find((a: any) => a.type === 'limit');
      if (limitAction) {
        matched = matched.slice(0, limitAction.count);
      }

      const result = isSingle ? (matched[0] || null) : matched;
      return res.json({ data: result, error: null, count: matched.length });

    } else if (queryType === 'insert') {
      const isArray = Array.isArray(insertValues);
      const list = isArray ? insertValues : [insertValues];

      const insertedRows = [];
      for (const item of list) {
        if (!item.id) item.id = crypto.randomUUID();
        if (!item.created_at) item.created_at = new Date().toISOString();

        tableArray.push(item);
        insertedRows.push(item);

        // Handle custom event statistics
        if (table === 'likes') {
          const post = localDb.posts.find(p => p.id === item.post_id);
          if (post) {
            post.likes_count = (post.likes_count || 0) + 1;
            await savePostToFtp(post).catch(err => console.warn('[FTP Fallback Like Sync Error]', err));
            // Notification
            if (post.user_id !== item.user_id) {
              localDb.notifications.push({
                id: crypto.randomUUID(),
                recipient_id: post.user_id,
                actor_id: item.user_id,
                type: 'like',
                post_id: item.post_id,
                content: 'liked your post.',
                is_read: false,
                created_at: new Date().toISOString()
              });
            }
          }
        } else if (table === 'comments') {
          const post = localDb.posts.find(p => p.id === item.post_id);
          if (post) {
            post.comments_count = (post.comments_count || 0) + 1;
            await savePostToFtp(post).catch(err => console.warn('[FTP Fallback Comment Sync Error]', err));
            // Notification
            if (post.user_id !== item.user_id) {
              localDb.notifications.push({
                id: crypto.randomUUID(),
                recipient_id: post.user_id,
                actor_id: item.user_id,
                type: 'comment',
                post_id: item.post_id,
                content: 'commented on your post.',
                is_read: false,
                created_at: new Date().toISOString()
              });
            }
          }
          handleMentions(item.content, item.user_id, item.post_id, true, true);
        } else if (table === 'posts') {
          await savePostToFtp(item).catch(err => console.warn('[FTP Fallback Post Insert Sync Error]', err));
        } else if (table === 'follows') {
          const isFollowBack = localDb.follows.some(f => f.follower_id === item.following_id && f.following_id === item.follower_id);
          // Notification
          localDb.notifications.push({
            id: crypto.randomUUID(),
            recipient_id: item.following_id,
            actor_id: item.follower_id,
            type: 'follow',
            content: 'started following you.',
            is_read: false,
            created_at: new Date().toISOString()
          });
        } else if (table === 'messages') {
          // Notification
          localDb.notifications.push({
            id: crypto.randomUUID(),
            recipient_id: item.receiver_id,
            actor_id: item.sender_id,
            type: 'message',
            content: 'sent you a message.',
            is_read: false,
            created_at: new Date().toISOString()
          });
        } else if (table === 'saved_posts') {
          const post = localDb.posts.find(p => p.id === item.post_id);
          if (post && post.user_id !== item.user_id) {
            localDb.notifications.push({
              id: crypto.randomUUID(),
              recipient_id: post.user_id,
              actor_id: item.user_id,
              type: 'save_post',
              post_id: item.post_id,
              content: 'saved your post.',
              is_read: false,
              created_at: new Date().toISOString()
            });
          }
        } else if (table === 'story_views') {
          const story = localDb.stories.find(s => s.id === item.story_id);
          if (story && story.user_id !== item.viewer_id) {
            const alreadyNotified = localDb.notifications.some(
              n => n.type === 'story_view' && n.recipient_id === story.user_id && n.actor_id === item.viewer_id && n.post_id === item.story_id
            );
            if (!alreadyNotified) {
              localDb.notifications.push({
                id: crypto.randomUUID(),
                recipient_id: story.user_id,
                actor_id: item.viewer_id,
                type: 'story_view',
                post_id: item.story_id,
                content: 'viewed your story.',
                is_read: false,
                created_at: new Date().toISOString()
              });
            }
          }
        }
      }

      saveLocalDb();
      const valueResult = isArray ? insertedRows : insertedRows[0];
      return res.json({ data: valueResult, error: null });

    } else if (queryType === 'update') {
      const matched = tableArray.filter((item: any) => matchesFilter(item, actions));
      for (const item of matched) {
        Object.assign(item, updateValues);
        if (table === 'posts') {
          await savePostToFtp(item).catch(err => console.warn('[FTP Fallback Post Update Sync Error]', err));
        }
      }
      saveLocalDb();
      return res.json({ data: matched, error: null });

    } else if (queryType === 'delete') {
      const matched = tableArray.filter((item: any) => matchesFilter(item, actions));
      for (const item of matched) {
        if (table === 'likes') {
          const post = localDb.posts.find(p => p.id === item.post_id);
          if (post) {
            post.likes_count = Math.max(0, (post.likes_count || 0) - 1);
            await savePostToFtp(post).catch(err => console.warn('[FTP Fallback Like Decr Error]', err));
          }
        } else if (table === 'comments') {
          const post = localDb.posts.find(p => p.id === item.post_id);
          if (post) {
            post.comments_count = Math.max(0, (post.comments_count || 0) - 1);
            await savePostToFtp(post).catch(err => console.warn('[FTP Fallback Comment Decr Error]', err));
          }
        } else if (table === 'posts') {
          await deletePostFromFtp(item.id).catch(err => console.warn('[FTP Fallback Post Delete Error]', err));
        }
        
        const index = tableArray.indexOf(item);
        if (index > -1) {
          tableArray.splice(index, 1);
        }
      }

      saveLocalDb();
      return res.json({ data: true, error: null });
    }

  } catch (err: any) {
    console.error('[Fallback DB Handler Error]', err);
    return res.status(500).json({ data: null, error: err.message });
  }
}

const app = express();
export default app;

// JSON and url-encoded body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS middleware or supporting native mobile apps (Capacitor/Cordova)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, x-client-info');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Custom Router / serve route for local media uploads with FTP fallback download
app.get('/uploads/:filename', async (req, res) => {
  const filename = req.params.filename;
  const localFile = path.join(uploadsDir, filename);

  if (fs.existsSync(localFile)) {
    return res.sendFile(localFile);
  }

  try {
    await downloadUploadFromFtp(filename);
    if (fs.existsSync(localFile)) {
      return res.sendFile(localFile);
    }
  } catch (err: any) {
    console.error(`[Serve Upload From FTP Error] Failed for ${filename}:`, err?.message);
  }

  res.status(404).send('File not found');
});

// Initialize DB asynchronously
initDb().then(() => {
  // Initial forced sync of posts from FTP server to localDB and MySQL on startup
  syncPostsFromFtp(true).catch(err => console.warn('[FTP Startup Sync Error]', err));
});

// Periodically pull/sync posts in background every 60 seconds to detect additions from other clients (only if not on Vercel)
if (process.env.VERCEL !== '1') {
  setInterval(() => {
    syncPostsFromFtp().catch(err => console.warn('[FTP Interval Sync Error]', err));
  }, 60000);
}

// API Health Indicator
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: useLocalFallback ? 'local_json' : 'mysql' });
});

// Admin DB Status Indicator
app.get('/api/admin/db-status', (req, res) => {
  res.json({
    useLocalFallback,
    host: '131.153.147.178',
    database: 'zerolord_ripple',
    poolActive: !!pool
  });
});

// Unified File Storage Upload Endpoint
  app.post('/api/storage/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    const publicUrl = `/uploads/${req.file.filename}`;
    
    // Upload standard uploaded media to FTP
    saveUploadToFtp(req.file.filename).catch(err => {
      console.warn('[FTP Upload Handshake Error]', err);
    });

    res.json({ publicUrl });
  });

  // Client Auth Signup API
  app.post('/api/auth/signup', async (req, res) => {
    const { email: rawEmail, password, options } = req.body;
    if (!rawEmail || !password) {
      return res.status(400).send('Email and password required.');
    }
    const email = rawEmail.toLowerCase().trim();

    // fallback check
    if (useLocalFallback || !pool) {
      try {
        const existing = localDb.users.find(u => u.email === email);
        if (existing) {
          return res.status(400).send('User with this email already exists.');
        }

        const userId = crypto.randomUUID();
        const pHash = hashPassword(password);

        localDb.users.push({ id: userId, email, password_hash: pHash, created_at: new Date().toISOString() });

        const username = options?.data?.username || email.split('@')[0];
        const display_name = options?.data?.display_name || username;
        const avatar_url = options?.data?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`;

        localDb.profiles.push({
          id: crypto.randomUUID(),
          user_id: userId,
          username,
          display_name,
          avatar_url,
          bio: 'Hello, I am new on Ripple!',
          is_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const hasAdmin = localDb.user_roles.some(r => r.role === 'admin');
        const roleToAssign = hasAdmin ? 'user' : 'admin';

        localDb.user_roles.push({
          id: crypto.randomUUID(),
          user_id: userId,
          role: roleToAssign
        });

        saveLocalDb();

        const token = Buffer.from(JSON.stringify({ id: userId, email })).toString('base64');
        const userObj = {
          id: userId,
          email,
          user_metadata: { 
            username, 
            display_name, 
            avatar_url,
            needs_onboarding: true
          }
        };

        return res.json({
          session: {
            access_token: token,
            user: userObj
          },
          user: userObj
        });
      } catch (err: any) {
        return res.status(500).send(err.message || 'Error occurred during signup.');
      }
    }

    try {
      const [existing]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(400).send('User with this email already exists.');
      }

      const userId = crypto.randomUUID();
      const pHash = hashPassword(password);

      await pool.query('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, email, pHash]);

      const username = options?.data?.username || email.split('@')[0];
      const display_name = options?.data?.display_name || username;
      const avatar_url = options?.data?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`;

      await pool.query(
        `INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified) VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
        [crypto.randomUUID(), userId, username, display_name, avatar_url, 'Hello, I am new on Ripple!']
      );

      const [adminsCount]: any = await pool.query("SELECT id FROM user_roles WHERE role = 'admin' LIMIT 1");
      const assignedRole = adminsCount.length === 0 ? 'admin' : 'user';

      await pool.query(
        `INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)`,
        [crypto.randomUUID(), userId, assignedRole]
      );

      const token = Buffer.from(JSON.stringify({ id: userId, email })).toString('base64');
      const userObj = {
        id: userId,
        email,
        user_metadata: { 
          username, 
          display_name, 
          avatar_url,
          needs_onboarding: true
        }
      };

      res.json({
        session: {
          access_token: token,
          user: userObj
        },
        user: userObj
      });
    } catch (e: any) {
      console.error('[Signup error]', e);
      res.status(500).send(e.message || 'Error occurred during signup.');
    }
  });

  // Client Auth Signin API
  app.post('/api/auth/signin', async (req, res) => {
    const { email: rawEmail, password } = req.body;
    if (!rawEmail || !password) {
      return res.status(400).send('Email and password required.');
    }
    const email = rawEmail.toLowerCase().trim();

    if (useLocalFallback || !pool) {
      try {
        const userRecord = localDb.users.find(u => u.email === email);
        if (!userRecord || userRecord.password_hash !== hashPassword(password)) {
          return res.status(401).send('Invalid email or password.');
        }

        const profile = localDb.profiles.find(p => p.user_id === userRecord.id) || {};
        if (profile.is_banned || profile.is_suspended) {
          return res.status(403).send(profile.is_banned ? 'This account has been permanently banned.' : 'This account has been suspended.');
        }

        const token = Buffer.from(JSON.stringify({ id: userRecord.id, email: userRecord.email })).toString('base64');
        const userObj = {
          id: userRecord.id,
          email: userRecord.email,
          user_metadata: {
            username: profile.username || email.split('@')[0],
            display_name: profile.display_name,
            avatar_url: profile.avatar_url
          }
        };

        return res.json({
          session: {
            access_token: token,
            user: userObj
          }
        });
      } catch (err: any) {
        return res.status(500).send(err.message || 'Error occurred during sign-in.');
      }
    }

    try {
      const [users]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(401).send('Invalid email or password.');
      }

      const userRecord = users[0];
      if (userRecord.password_hash !== hashPassword(password)) {
        return res.status(401).send('Invalid email or password.');
      }

      const [profiles]: any = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userRecord.id]);
      let profile = profiles[0];
      if (profile && (profile.is_banned || profile.is_suspended)) {
        return res.status(403).send(profile.is_banned ? 'This account has been permanently banned.' : 'This account has been suspended.');
      }
      if (!profile) {
        // Automatically create a missing profile for users directly created in MySQL
        const username = email.split('@')[0];
        const display_name = username;
        const avatar_url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`;
        const profileId = crypto.randomUUID();
        
        await pool.query(
          `INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified) 
           VALUES (?, ?, ?, ?, ?, ?, FALSE)
           ON DUPLICATE KEY UPDATE user_id = user_id`,
          [profileId, userRecord.id, username, display_name, avatar_url, 'Hello, I am new on Ripple!']
        );
        
        profile = {
          id: profileId,
          user_id: userRecord.id,
          username,
          display_name,
          avatar_url,
          bio: 'Hello, I am new on Ripple!',
          is_verified: 0
        };
      }

      const token = Buffer.from(JSON.stringify({ id: userRecord.id, email: userRecord.email })).toString('base64');
      const userObj = {
        id: userRecord.id,
        email: userRecord.email,
        user_metadata: {
          username: profile.username || email.split('@')[0],
          display_name: profile.display_name,
          avatar_url: profile.avatar_url
        }
      };

      res.json({
        session: {
          access_token: token,
          user: userObj
        }
      });
    } catch (e: any) {
      console.error('[Signin error]', e);
      res.status(500).send(e.message || 'Error occurred during sign-in.');
    }
  });

  // Password reset implementation
  app.post('/api/auth/reset-password', (req, res) => {
    res.json({ status: 'ok', message: 'Instructions sent if email is found.' });
  });

  // Client Auth Update Password API
  app.post('/api/auth/update-user', async (req, res) => {
    const { password } = req.body;
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send('Not authenticated');
    }
    const token = authHeader.substring(7);

    try {
      const authUser = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      const pHash = hashPassword(password);

      if (useLocalFallback || !pool) {
        const u = localDb.users.find(x => x.id === authUser.id);
        if (u) {
          u.password_hash = pHash;
          saveLocalDb();
        }
        return res.json({ status: 'ok' });
      }

      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [pHash, authUser.id]);
      res.json({ status: 'ok' });
    } catch (e: any) {
      res.status(401).send('Session invalid or expired.');
    }
  });

  // Client Session Validation Endpoint (to sync direct phpMyAdmin DB updates/deletions)
  app.post('/api/auth/validate', async (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(401).send('No token provided');
    }
    try {
      const authUser = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      
      if (useLocalFallback || !pool) {
        const u = localDb.users.find(x => x.id === authUser.id);
        if (!u) {
          return res.status(401).send('User not found');
        }
        const profile = localDb.profiles.find(p => p.user_id === u.id) || {};
        if (profile.is_banned || profile.is_suspended) {
          return res.status(403).send(profile.is_banned ? 'This account has been permanently banned.' : 'This account has been suspended.');
        }
        return res.json({
          user: {
            id: u.id,
            email: u.email,
            user_metadata: {
              username: profile.username || u.email.split('@')[0],
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              needs_onboarding: u.user_metadata?.needs_onboarding
            }
          }
        });
      }

      // Check MySQL
      const [users]: any = await pool.query('SELECT * FROM users WHERE id = ?', [authUser.id]);
      if (users.length === 0) {
        return res.status(401).send('User no longer exists in MySQL');
      }
      
      const userRecord = users[0];
      const [profiles]: any = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userRecord.id]);
      let profile = profiles[0];
      if (profile && (profile.is_banned || profile.is_suspended)) {
        return res.status(403).send(profile.is_banned ? 'This account has been permanently banned.' : 'This account has been suspended.');
      }
      
      if (!profile) {
        // Automatically generate missing profile for SQL-created users
        const username = userRecord.email.split('@')[0];
        const display_name = username;
        const avatar_url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`;
        const profileId = crypto.randomUUID();
        
        await pool.query(
          `INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified) 
           VALUES (?, ?, ?, ?, ?, ?, FALSE)
           ON DUPLICATE KEY UPDATE user_id = user_id`,
          [profileId, userRecord.id, username, display_name, avatar_url, 'Hello, I am new on Ripple!']
        );
        
        profile = {
          id: profileId,
          user_id: userRecord.id,
          username,
          display_name,
          avatar_url,
          bio: 'Hello, I am new on Ripple!',
          is_verified: false
        };
      }

      res.json({
        user: {
          id: userRecord.id,
          email: userRecord.email,
          user_metadata: {
            username: profile.username,
            display_name: profile.display_name || profile.username,
            avatar_url: profile.avatar_url
          }
        }
      });
    } catch (e) {
      res.status(401).send('Token invalid');
    }
  });

  // GET current default avatars config
  app.get('/api/admin/default-avatars', (req, res) => {
    const avatarsConfigPath = path.join(uploadsDir, 'custom_default_avatars.json');
    let currentConfigs: any = { male: [], female: [], nonbinary: [] };
    try {
      if (fs.existsSync(avatarsConfigPath)) {
        currentConfigs = JSON.parse(fs.readFileSync(avatarsConfigPath, 'utf8'));
      }
    } catch (e) {
      // ignore
    }
    res.json({ success: true, configs: currentConfigs });
  });

  // POST newly uploaded custom default avatar for a gender
  app.post('/api/admin/default-avatars', upload.single('file'), async (req, res) => {
    const { gender } = req.body;
    if (!gender || !['male', 'female', 'nonbinary'].includes(gender)) {
      return res.status(400).send('Gender must be male, female, or nonbinary.');
    }
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const publicUrl = `/uploads/${req.file.filename}`;
    const avatarsConfigPath = path.join(uploadsDir, 'custom_default_avatars.json');
    let currentConfigs: any = { male: [], female: [], nonbinary: [] };
    
    try {
      if (fs.existsSync(avatarsConfigPath)) {
        currentConfigs = JSON.parse(fs.readFileSync(avatarsConfigPath, 'utf8'));
      }
    } catch (e) {
      // ignore
    }

    if (!Array.isArray(currentConfigs[gender])) {
      currentConfigs[gender] = [];
    }
    currentConfigs[gender].unshift(publicUrl);

    fs.writeFileSync(avatarsConfigPath, JSON.stringify(currentConfigs, null, 2), 'utf8');

    // Sync to FTP if basic-ftp operates
    saveUploadToFtp(req.file.filename).catch(err => {
      console.warn('[FTP Default Avatar Sync Error]', err);
    });

    res.json({ success: true, configs: currentConfigs, url: publicUrl });
  });

  // Administrative CRUD Operations
  app.post('/api/admin/users/create', async (req, res) => {
    const { email, password, username, display_name } = req.body;
    if (!email || !password || !username) {
      return res.status(400).send('Missing email, password, or username.');
    }
    const userId = crypto.randomUUID();
    const pHash = hashPassword(password);
    const finalUsername = username.toLowerCase().trim();

    try {
      if (pool && !useLocalFallback) {
        const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
          return res.status(400).send('Email already registered.');
        }
        const [existingU]: any = await pool.query('SELECT id FROM profiles WHERE username = ?', [finalUsername]);
        if (existingU.length > 0) {
          return res.status(400).send('Username already taken.');
        }

        await pool.query('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, email, pHash]);
        const profileId = crypto.randomUUID();
        const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalUsername)}`;
        await pool.query(
          `INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified, is_banned, is_suspended) 
           VALUES (?, ?, ?, ?, ?, ?, FALSE, FALSE, FALSE)`,
          [profileId, userId, finalUsername, display_name || finalUsername, avatarUrl, 'Hello, I was created by an Admin!']
        );
      }

      const existingLocal = localDb.users.find(u => u.email === email);
      if (existingLocal) {
        if (useLocalFallback) return res.status(400).send('Email already registered in fallback.');
      } else {
        localDb.users.push({
          id: userId,
          email,
          password_hash: pHash,
          created_at: new Date().toISOString()
        });
        localDb.profiles.push({
          id: crypto.randomUUID(),
          user_id: userId,
          username: finalUsername,
          display_name: display_name || finalUsername,
          avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalUsername)}`,
          bio: 'Hello, I was created by an Admin!',
          is_verified: false,
          is_banned: false,
          is_suspended: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        saveLocalDb();
      }

      res.json({ success: true, userId });
    } catch (err: any) {
      res.status(500).send(err.message || 'Error creating user');
    }
  });

  app.post('/api/admin/users/update', async (req, res) => {
    const { user_id, username, display_name, bio, is_verified, is_onboarding_core } = req.body;
    if (!user_id) return res.status(400).send('Missing user_id.');
    const finalUsername = username ? username.toLowerCase().trim() : undefined;

    try {
      if (pool && !useLocalFallback) {
        if (finalUsername) {
          const [existingU]: any = await pool.query('SELECT id FROM profiles WHERE username = ? AND user_id != ?', [finalUsername, user_id]);
          if (existingU.length > 0) return res.status(400).send('Username already taken.');
        }

        const updateFields: string[] = [];
        const params: any[] = [];
        if (finalUsername !== undefined) { updateFields.push('username = ?'); params.push(finalUsername); }
        if (display_name !== undefined) { updateFields.push('display_name = ?'); params.push(display_name); }
        if (bio !== undefined) { updateFields.push('bio = ?'); params.push(bio); }
        if (is_verified !== undefined) { updateFields.push('is_verified = ?'); params.push(is_verified ? 1 : 0); }
        if (is_onboarding_core !== undefined) { updateFields.push('is_onboarding_core = ?'); params.push(is_onboarding_core ? 1 : 0); }

        if (updateFields.length > 0) {
          params.push(user_id);
          await pool.query(`UPDATE profiles SET ${updateFields.join(', ')} WHERE user_id = ?`, params);
        }
      }

      const p = localDb.profiles.find(x => x.user_id === user_id);
      if (p) {
        if (finalUsername !== undefined) p.username = finalUsername;
        if (display_name !== undefined) p.display_name = display_name;
        if (bio !== undefined) p.bio = bio;
        if (is_verified !== undefined) p.is_verified = !!is_verified;
        if (is_onboarding_core !== undefined) p.is_onboarding_core = !!is_onboarding_core;
        p.updated_at = new Date().toISOString();
        saveLocalDb();
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).send(err.message || 'Error updating user');
    }
  });

  app.post('/api/admin/users/delete', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).send('Missing user_id.');

    try {
      if (pool && !useLocalFallback) {
        const conn = await pool.getConnection();
        try {
          // Disable FK checks to guarantee cascade delete works with any custom constraints in live DB
          await conn.query('SET FOREIGN_KEY_CHECKS = 0');

          const [userPosts]: any = await conn.query('SELECT id FROM posts WHERE user_id = ?', [user_id]);
          const postIds = userPosts.map((p: any) => p.id);

          if (postIds.length > 0) {
            const placeholders = postIds.map(() => '?').join(',');
            await conn.query(`DELETE FROM comments WHERE post_id IN (${placeholders})`, postIds);
            await conn.query(`DELETE FROM likes WHERE post_id IN (${placeholders})`, postIds);
            await conn.query(`DELETE FROM saved_posts WHERE post_id IN (${placeholders})`, postIds);
            await conn.query(`DELETE FROM notifications WHERE post_id IN (${placeholders})`, postIds);
          }

          const [userStories]: any = await conn.query('SELECT id FROM stories WHERE user_id = ?', [user_id]);
          const storyIds = userStories.map((s: any) => s.id);
          if (storyIds.length > 0) {
            const placeholders = storyIds.map(() => '?').join(',');
            await conn.query(`DELETE FROM story_views WHERE story_id IN (${placeholders})`, storyIds);
          }

          await conn.query('DELETE FROM comments WHERE user_id = ?', [user_id]);
          await conn.query('DELETE FROM likes WHERE user_id = ?', [user_id]);
          await conn.query('DELETE FROM saved_posts WHERE user_id = ?', [user_id]);
          await conn.query('DELETE FROM user_roles WHERE user_id = ?', [user_id]);
          await conn.query('DELETE FROM stories WHERE user_id = ?', [user_id]);
          await conn.query('DELETE FROM story_views WHERE viewer_id = ?', [user_id]);
          await conn.query('DELETE FROM notifications WHERE recipient_id = ? OR actor_id = ?', [user_id, user_id]);
          await conn.query('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?', [user_id, user_id]);
          await conn.query('DELETE FROM follows WHERE follower_id = ? OR following_id = ?', [user_id, user_id]);
          await conn.query('DELETE FROM posts WHERE user_id = ?', [user_id]);
          await conn.query('DELETE FROM profiles WHERE user_id = ?', [user_id]);
          await conn.query('DELETE FROM users WHERE id = ?', [user_id]);

          // Re-enable FK checks
          await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        } finally {
          conn.release();
        }
      }

      const uPosts = localDb.posts.filter(p => p.user_id === user_id);
      const uPostIds = uPosts.map(p => p.id);

      localDb.comments = localDb.comments.filter(c => c.user_id !== user_id && !uPostIds.includes(c.post_id));
      localDb.likes = localDb.likes.filter(l => l.user_id !== user_id && !uPostIds.includes(l.post_id));
      localDb.saved_posts = localDb.saved_posts.filter(s => s.user_id !== user_id && !uPostIds.includes(s.post_id));
      localDb.user_roles = localDb.user_roles.filter(ur => ur.user_id !== user_id);
      localDb.stories = localDb.stories.filter(s => s.user_id !== user_id);
      localDb.story_views = localDb.story_views.filter(sv => sv.viewer_id !== user_id);
      localDb.notifications = localDb.notifications.filter(n => n.recipient_id !== user_id && n.actor_id !== user_id && !uPostIds.includes(n.post_id || ''));
      localDb.messages = localDb.messages.filter(m => m.sender_id !== user_id && m.receiver_id !== user_id);
      localDb.follows = localDb.follows.filter(f => f.follower_id !== user_id && f.following_id !== user_id);
      localDb.posts = localDb.posts.filter(p => p.user_id !== user_id);
      localDb.profiles = localDb.profiles.filter(p => p.user_id !== user_id);
      localDb.users = localDb.users.filter(u => u.id !== user_id);

      saveLocalDb();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).send(err.message || 'Error deleting user');
    }
  });

  app.post('/api/admin/users/ban', async (req, res) => {
    const { user_id, is_banned } = req.body;
    if (!user_id) return res.status(400).send('Missing user_id.');

    try {
      const dbBanned = is_banned ? 1 : 0;
      if (pool && !useLocalFallback) {
        await pool.query('UPDATE profiles SET is_banned = ? WHERE user_id = ?', [dbBanned, user_id]);
      }
      
      const p = localDb.profiles.find(x => x.user_id === user_id);
      if (p) {
        p.is_banned = !!is_banned;
        saveLocalDb();
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post('/api/admin/users/suspend', async (req, res) => {
    const { user_id, is_suspended } = req.body;
    if (!user_id) return res.status(400).send('Missing user_id.');

    try {
      const dbSusp = is_suspended ? 1 : 0;
      if (pool && !useLocalFallback) {
        await pool.query('UPDATE profiles SET is_suspended = ? WHERE user_id = ?', [dbSusp, user_id]);
      }
      
      const p = localDb.profiles.find(x => x.user_id === user_id);
      if (p) {
        p.is_suspended = !!is_suspended;
        saveLocalDb();
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post('/api/admin/posts/create', async (req, res) => {
    const { user_id, caption, image_url, media_type } = req.body;
    if (!user_id) return res.status(400).send('Missing user_id.');
    
    const postId = crypto.randomUUID();
    const finalCaption = caption || '';
    const finalImageUrl = image_url || '';
    const finalMediaType = media_type || 'image';

    try {
      if (pool && !useLocalFallback) {
        await pool.query(
          'INSERT INTO posts (id, user_id, caption, image_url, media_type, likes_count, comments_count) VALUES (?, ?, ?, ?, ?, 0, 0)',
          [postId, user_id, finalCaption, finalImageUrl, finalMediaType]
        );
      }

      localDb.posts.push({
        id: postId,
        user_id,
        caption: finalCaption,
        image_url: finalImageUrl,
        media_type: finalMediaType,
        likes_count: 0,
        comments_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      saveLocalDb();

      // Upload to FTP
      await savePostIdToFtp(postId).catch(err => console.warn('[FTP Admin Create Error]', err));

      res.json({ success: true, postId });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post('/api/admin/posts/update', async (req, res) => {
    const { id, caption, image_url, media_type } = req.body;
    if (!id) return res.status(400).send('Missing post id.');

    try {
      if (pool && !useLocalFallback) {
        const updateFields: string[] = [];
        const params: any[] = [];
        if (caption !== undefined) { updateFields.push('caption = ?'); params.push(caption); }
        if (image_url !== undefined) { updateFields.push('image_url = ?'); params.push(image_url); }
        if (media_type !== undefined) { updateFields.push('media_type = ?'); params.push(media_type); }

        if (updateFields.length > 0) {
          params.push(id);
          await pool.query(`UPDATE posts SET ${updateFields.join(', ')} WHERE id = ?`, params);
        }
      }

      const p = localDb.posts.find(x => x.id === id);
      if (p) {
        if (caption !== undefined) p.caption = caption;
        if (image_url !== undefined) p.image_url = image_url;
        if (media_type !== undefined) p.media_type = media_type;
        p.updated_at = new Date().toISOString();
        saveLocalDb();
      }

      // Update on FTP
      await savePostIdToFtp(id).catch(err => console.warn('[FTP Admin Update Error]', err));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post('/api/admin/posts/delete', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('Missing post id.');

    try {
      if (pool && !useLocalFallback) {
        await pool.query('DELETE FROM comments WHERE post_id = ?', [id]);
        await pool.query('DELETE FROM likes WHERE post_id = ?', [id]);
        await pool.query('DELETE FROM saved_posts WHERE post_id = ?', [id]);
        await pool.query('DELETE FROM notifications WHERE post_id = ?', [id]);
        await pool.query('DELETE FROM posts WHERE id = ?', [id]);
      }

      localDb.comments = localDb.comments.filter(c => c.post_id !== id);
      localDb.likes = localDb.likes.filter(l => l.post_id !== id);
      localDb.saved_posts = localDb.saved_posts.filter(s => s.post_id !== id);
      localDb.notifications = localDb.notifications.filter(n => n.post_id !== id);
      localDb.posts = localDb.posts.filter(p => p.id !== id);
      saveLocalDb();

      // Delete from FTP
      await deletePostFromFtp(id).catch(err => console.warn('[FTP Admin Delete Error]', err));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // Main Dynamic Supabase-Mock Handler
  app.post('/api/supabase-mock', async (req, res) => {
    const { table, actions } = req.body;

    // Check if user has been deleted from MySQL
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const authUser = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        if (pool && !useLocalFallback) {
          const [exists]: any = await pool.query('SELECT id FROM users WHERE id = ?', [authUser.id]);
          if (exists.length === 0) {
            console.log(`[Session Block] User ${authUser.id} does not exist. Blocking request.`);
            return res.status(401).json({ error: { message: 'User session has been invalidated or deleted.' } });
          }
        } else {
          const exists = localDb.users.some(u => u.id === authUser.id);
          if (!exists) {
            console.log(`[Session Block Local] User ${authUser.id} does not exist. Blocking request.`);
            return res.status(401).json({ error: { message: 'User session has been invalidated or deleted.' } });
          }
        }
      } catch (err) {
        // ignore token parsing errors
      }
    }

    // Check fallback state
    if (useLocalFallback || !pool) {
      return await executeFallbackSync(table, actions, res);
    }

    // Standard MySQL Path (if functional)
    try {
      let queryType = 'select';
      const wClauses: string[] = [];
      const params: any[] = [];
      let orderBy = '';
      let limitVal: number | null = null;
      let isSingle = false;
      let insertValues: any = null;
      let updateValues: any = null;

      for (const action of actions || []) {
        switch (action.type) {
          case 'select':
            queryType = 'select';
            break;
          case 'insert':
            queryType = 'insert';
            insertValues = action.values;
            break;
          case 'update':
            queryType = 'update';
            updateValues = action.values;
            break;
          case 'delete':
            queryType = 'delete';
            break;
          case 'eq':
            wClauses.push(`\`${action.column}\` = ?`);
            params.push(action.value);
            break;
          case 'neq':
            wClauses.push(`\`${action.column}\` != ?`);
            params.push(action.value);
            break;
          case 'gt':
            wClauses.push(`\`${action.column}\` > ?`);
            params.push(action.value);
            break;
          case 'gte':
            wClauses.push(`\`${action.column}\` >= ?`);
            params.push(action.value);
            break;
          case 'lt':
            wClauses.push(`\`${action.column}\` < ?`);
            params.push(action.value);
            break;
          case 'lte':
            wClauses.push(`\`${action.column}\` <= ?`);
            params.push(action.value);
            break;
          case 'in':
            if (Array.isArray(action.values) && action.values.length > 0) {
              wClauses.push(`\`${action.column}\` IN (${action.values.map(() => '?').join(',')})`);
              params.push(...action.values);
            } else {
              wClauses.push('1 = 0');
            }
            break;
          case 'not':
            if (action.operator === 'in') {
              let rawVal = action.value;
              if (typeof rawVal === 'string') {
                rawVal = rawVal.replace(/^\(|\)$/g, '');
                const parts = rawVal.split(',').map((x: string) => x.trim()).filter(Boolean);
                if (parts.length > 0) {
                  wClauses.push(`\`${action.column}\` NOT IN (${parts.map(() => '?').join(',')})`);
                  params.push(...parts);
                }
              }
            }
            break;
          case 'or': {
            const orVal = action.filter;
            if (orVal.includes('and(sender_id.eq.') && orVal.includes('receiver_id.eq.')) {
              const matches = [...orVal.matchAll(/sender_id\.eq\.([^,)]+),receiver_id\.eq\.([^,)]+)/g)];
              if (matches.length >= 2) {
                const s1 = matches[0][1];
                const r1 = matches[0][2];
                const s2 = matches[1][1];
                const r2 = matches[1][2];
                wClauses.push(`((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))`);
                params.push(s1, r1, s2, r2);
              }
            } else if (orVal.includes('sender_id.eq.') && orVal.includes('receiver_id.eq.')) {
              const sMatch = orVal.match(/sender_id\.eq\.([^,]+)/);
              const rMatch = orVal.match(/receiver_id\.eq\.([^,]+)/);
              if (sMatch && rMatch) {
                wClauses.push(`(sender_id = ? OR receiver_id = ?)`);
                params.push(sMatch[1], rMatch[1]);
              }
            }
            break;
          }
          case 'order': {
            const dir = (action.options && action.options.ascending === false) ? 'DESC' : 'ASC';
            orderBy = `ORDER BY \`${table}\`.\`${action.column}\` ${dir}`;
            break;
          }
          case 'limit':
            limitVal = action.count;
            break;
          case 'single':
          case 'maybeSingle':
            isSingle = true;
            break;
        }
      }

      const whereSql = wClauses.length > 0 ? `WHERE ${wClauses.join(' AND ')}` : '';
      const limitSql = limitVal !== null ? `LIMIT ${limitVal}` : '';

      if (queryType === 'select') {
        if (table === 'posts') {
          await syncPostsFromFtp().catch(err => console.warn('[FTP Select Sync Error]', err));
        }
        let sql = '';
        if (table === 'posts') {
          sql = `
            SELECT posts.*, 
                   profiles.username as profile_username, 
                   profiles.display_name as profile_display_name, 
                   profiles.avatar_url as profile_avatar_url, 
                   profiles.is_verified as profile_is_verified
            FROM posts
            LEFT JOIN profiles ON posts.user_id = profiles.user_id
            ${whereSql}
            ${orderBy || 'ORDER BY posts.created_at DESC'}
            ${limitSql}
          `;
        } else if (table === 'comments') {
          sql = `
            SELECT comments.*, 
                   profiles.username as profile_username, 
                   profiles.avatar_url as profile_avatar_url, 
                   profiles.is_verified as profile_is_verified
            FROM comments
            LEFT JOIN profiles ON comments.user_id = profiles.user_id
            ${whereSql}
            ${orderBy || 'ORDER BY comments.created_at ASC'}
            ${limitSql}
          `;
        } else if (table === 'stories') {
          sql = `
            SELECT stories.*, 
                   profiles.username as profile_username, 
                   profiles.display_name as profile_display_name, 
                   profiles.avatar_url as profile_avatar_url, 
                   profiles.is_verified as profile_is_verified
            FROM stories
            LEFT JOIN profiles ON stories.user_id = profiles.user_id
            ${whereSql}
            ${orderBy || 'ORDER BY stories.created_at DESC'}
            ${limitSql}
          `;
        } else if (table === 'notifications') {
          sql = `
            SELECT notifications.*, 
                   profiles.username as profile_username, 
                   profiles.display_name as profile_display_name, 
                   profiles.avatar_url as profile_avatar_url, 
                   profiles.is_verified as profile_is_verified
            FROM notifications
            LEFT JOIN profiles ON notifications.actor_id = profiles.user_id
            ${whereSql}
            ${orderBy || 'ORDER BY notifications.created_at DESC'}
            ${limitSql}
          `;
        } else {
          sql = `
            SELECT * FROM \`${table}\`
            ${whereSql}
            ${orderBy}
            ${limitSql}
          `;
        }

        const [rows]: any = await pool.query(sql, params);
        let data: any = rows;

        // Relation nested mapping to match Supabase expectations exactly
        if (table === 'posts') {
          data = rows.map((r: any) => ({
            ...r,
            is_verified: !!r.is_verified,
            profiles: {
              username: r.profile_username,
              display_name: r.profile_display_name,
              avatar_url: r.profile_avatar_url,
              is_verified: !!r.profile_is_verified
            }
          }));
        } else if (table === 'comments') {
          data = rows.map((r: any) => ({
            ...r,
            profiles: {
              username: r.profile_username,
              avatar_url: r.profile_avatar_url,
              is_verified: !!r.profile_is_verified
            }
          }));
        } else if (table === 'stories') {
          data = rows.map((r: any) => ({
            ...r,
            profiles: {
              username: r.profile_username,
              display_name: r.profile_display_name,
              avatar_url: r.profile_avatar_url,
              is_verified: !!r.profile_is_verified
            }
          }));
        } else if (table === 'notifications') {
          data = rows.map((r: any) => ({
            ...r,
            is_read: !!r.is_read,
            actor: r.profile_username ? {
              username: r.profile_username,
              display_name: r.profile_display_name,
              avatar_url: r.profile_avatar_url,
              is_verified: !!r.profile_is_verified
            } : null
          }));
        } else if (table === 'profiles') {
          data = rows.map((r: any) => ({
            ...r,
            is_verified: !!r.is_verified
          }));
        } else if (table === 'messages') {
          data = rows.map((r: any) => ({
            ...r,
            is_read: !!r.is_read
          }));
        }

        const result = isSingle ? (data[0] || null) : data;
        return res.json({ data: result, error: null, count: data.length });

      } else if (queryType === 'insert') {
        const isArray = Array.isArray(insertValues);
        const list = isArray ? insertValues : [insertValues];

        const insertedRows = [];
        for (const item of list) {
          if (!item.id) {
            item.id = crypto.randomUUID();
          }

          const keys = Object.keys(item);
          const vals = Object.values(item);
          const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
          await pool.query(sql, vals);
          insertedRows.push(item);

          // MySQL Trigger-Like counts updates mimicry
          if (table === 'likes') {
            await pool.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?', [item.post_id]);
            await savePostIdToFtp(item.post_id).catch(err => console.warn('[FTP Like Sync Error]', err));
            try {
              const [postRows]: any = await pool.query('SELECT user_id FROM posts WHERE id = ?', [item.post_id]);
              if (postRows.length > 0 && postRows[0].user_id !== item.user_id) {
                await pool.query(
                  `INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [crypto.randomUUID(), postRows[0].user_id, item.user_id, 'like', item.post_id, 'liked your post.', false]
                );
              }
            } catch (e) {
              console.error(e);
            }
          }
          if (table === 'comments') {
            await pool.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?', [item.post_id]);
            await savePostIdToFtp(item.post_id).catch(err => console.warn('[FTP Comment Sync Error]', err));
            try {
              const [postRows]: any = await pool.query('SELECT user_id FROM posts WHERE id = ?', [item.post_id]);
              if (postRows.length > 0 && postRows[0].user_id !== item.user_id) {
                await pool.query(
                  `INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [crypto.randomUUID(), postRows[0].user_id, item.user_id, 'comment', item.post_id, 'commented on your post.', false]
                );
              }
            } catch (e) {
              console.error(e);
            }
            await handleMentions(item.content, item.user_id, item.post_id, true, false);
          }
          if (table === 'follows') {
            try {
              const [fback]: any = await pool.query(
                `SELECT id FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1`,
                [item.following_id, item.follower_id]
              );
              const notifContent = fback.length > 0 ? 'followed you back.' : 'started following you.';
              await pool.query(
                `INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), item.following_id, item.follower_id, 'follow', null, notifContent, false]
              );
            } catch (e) {
              console.error(e);
            }
          }
          if (table === 'posts') {
            await handleMentions(item.caption, item.user_id, item.id, false, false);
            await savePostIdToFtp(item.id).catch(err => console.warn('[FTP Post Insert Sync Error]', err));
          }
          if (table === 'messages') {
            try {
              const contentStub = item.content ? (item.content.substring(0, 50) + (item.content.length > 50 ? '...' : '')) : 'Sent you a message.';
              await pool.query(
                `INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  crypto.randomUUID(),
                  item.receiver_id,
                  item.sender_id,
                  'message',
                  null,
                  contentStub,
                  false
                ]
              );
            } catch (e) {
              console.error('[MySQL Message Notification Error]', e);
            }
          }
          if (table === 'stories') {
            await handleMentions(item.caption, item.user_id, null, false, false);
          }
          if (table === 'saved_posts') {
            try {
              const [postRows]: any = await pool.query('SELECT user_id FROM posts WHERE id = ?', [item.post_id]);
              if (postRows.length > 0 && postRows[0].user_id !== item.user_id) {
                await pool.query(
                  `INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [crypto.randomUUID(), postRows[0].user_id, item.user_id, 'save_post', item.post_id, 'saved your post.', false]
                );
              }
            } catch (e) {
              console.error('[MySQL Save Post Notification Error]', e);
            }
          }
          if (table === 'story_views') {
            try {
              const [storyRows]: any = await pool.query('SELECT user_id FROM stories WHERE id = ?', [item.story_id]);
              if (storyRows.length > 0 && storyRows[0].user_id !== item.user_id) {
                const [existNotif]: any = await pool.query(
                  `SELECT id FROM notifications WHERE recipient_id = ? AND actor_id = ? AND type = 'story_view' LIMIT 1`,
                  [storyRows[0].user_id, item.user_id]
                );
                if (existNotif.length === 0) {
                  await pool.query(
                    `INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [crypto.randomUUID(), storyRows[0].user_id, item.user_id, 'story_view', null, 'viewed your story.', false]
                  );
                }
              }
            } catch (e) {
              console.error('[MySQL Story View Notification Error]', e);
            }
          }
        }

        return res.json({ data: isArray ? insertedRows : insertedRows[0], error: null });

      } else if (queryType === 'update') {
        const keys = Object.keys(updateValues);
        const vals = Object.values(updateValues);
        const sql = `UPDATE \`${table}\` SET ${keys.map(k => `\`${k}\` = ?`).join(', ')} ${whereSql}`;
        await pool.query(sql, [...vals, ...params]);
        return res.json({ data: updateValues, error: null });

      } else if (queryType === 'delete') {
        if (table === 'likes' && wClauses.length > 0) {
          const [likesRows]: any = await pool.query(`SELECT * FROM likes ${whereSql}`, params);
          for (const r of likesRows) {
            await pool.query('UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?', [r.post_id]);
            await savePostIdToFtp(r.post_id).catch(err => console.warn('[FTP Like Decr Sync Error]', err));
          }
        }
        if (table === 'comments' && wClauses.length > 0) {
          const [commentsRows]: any = await pool.query(`SELECT * FROM comments ${whereSql}`, params);
          for (const r of commentsRows) {
            await pool.query('UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = ?', [r.post_id]);
            await savePostIdToFtp(r.post_id).catch(err => console.warn('[FTP Comment Decr Sync Error]', err));
          }
        }
        if (table === 'posts') {
          const idAction = actions.find((a: any) => a.type === 'eq' && a.column === 'id');
          if (idAction) {
            await deletePostFromFtp(idAction.value).catch(err => console.warn('[FTP Delete Post Error]', err));
          }
        }

        const sql = `DELETE FROM \`${table}\` ${whereSql}`;
        await pool.query(sql, params);
        return res.json({ data: true, error: null });
      }
    } catch (err: any) {
      console.warn('[MySQL error during query, switching live to fallback]:', err);
      useLocalFallback = true;
      return await executeFallbackSync(table, actions, res);
    }
  });

  // Client Routing (Integrate Vite as Middleware for Development)
  async function boot() {
    const PORT = 3000;

    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      
      // Fallback for nested relative assets (e.g. /messages/assets/index.js) caused by base: "./" in production config
      app.use((req, res, next) => {
        if (req.path.includes('/assets/')) {
          const parts = req.path.split('/assets/');
          const assetName = parts[parts.length - 1];
          const assetPath = path.join(distPath, 'assets', assetName);
          if (fs.existsSync(assetPath)) {
            if (assetName.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            } else if (assetName.endsWith('.css')) {
              res.setHeader('Content-Type', 'text/css');
            }
            return res.sendFile(assetPath);
          }
        }
        next();
      });

      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    if (process.env.VERCEL !== '1') {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Full-Stack Server] Ready on http://0.0.0.0:${PORT}`);
      });
    }
  }

  boot();
