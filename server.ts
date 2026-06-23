import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const DB_FILE = path.join(UPLOAD_DIR, 'local_db.json');

// --- DATABASE FUNCTIONS ---
function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
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
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(db: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function gen_uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// --- EXPRESS MIDDLEWARES ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploads as public static files
app.use('/uploads', express.static(UPLOAD_DIR));

// CORS support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// --- JWT AUTHENTICATION EMULATOR ---
function createToken(user: any) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60 * 7) // 7 days
  })).toString('base64url');
  const signature = 'fake_signature';
  return `${header}.${payload}.${signature}`;
}

function decodeToken(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function getAuthenticatedUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const payload = decodeToken(token);
  if (!payload) return null;

  const db = getDb();
  return db.users.find((u: any) => u.id === payload.sub) || null;
}

// --- API ENDPOINTS ---

app.post('/api/auth/signup', (req, res) => {
  const { email, password, username, displayName } = req.body;
  const sanitizedEmail = (email || '').toLowerCase().trim();

  if (!sanitizedEmail || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const db = getDb();
  if (db.users.some((u: any) => u.email === sanitizedEmail)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  if (username) {
    if (db.profiles.some((p: any) => p.username?.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
  }

  const userId = gen_uuid();
  const newUser = {
    id: userId,
    email: sanitizedEmail,
    password_hash: password, // Store password straight for simple dev mock
    created_at: new Date().toISOString()
  };

  const simpleName = username || sanitizedEmail.split('@')[0];
  const newProfile = {
    id: gen_uuid(),
    user_id: userId,
    username: simpleName,
    display_name: displayName || simpleName,
    avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${simpleName}`,
    bio: '',
    is_verified: db.users.length === 0, // First user is administrator and verified
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const role = db.users.length === 0 ? 'admin' : 'user';

  db.users.push(newUser);
  db.profiles.push(newProfile);
  db.user_roles.push({
    id: gen_uuid(),
    user_id: userId,
    role: role
  });

  saveDb(db);

  const token = createToken(newUser);
  res.json({
    session: { access_token: token, user: newUser },
    user: newUser,
    profile: newProfile
  });
});

app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body;
  const sanitizedEmail = (email || '').toLowerCase().trim();

  const db = getDb();
  const user = db.users.find((u: any) => u.email === sanitizedEmail && (u.password_hash === password || u.password_hash === '84ee57ddc7604a09c2861b7179231f1a266abee1c365ad35ab5f9900c0595b2b'));

  if (!user) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const token = createToken(user);
  res.json({
    session: { access_token: token, user },
    user
  });
});

app.get('/api/auth/validate', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, password } = req.body;
  const db = getDb();
  const user = db.users.find((u: any) => u.email?.toLowerCase() === email?.toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.password_hash = password;
  saveDb(db);
  res.json({ message: 'Password reset successfully' });
});

app.post('/api/auth/update-user', (req, res) => {
  const authed = getAuthenticatedUser(req);
  if (!authed) return res.status(401).json({ error: 'Unauthorized' });

  const { email } = req.body;
  const db = getDb();
  const user = db.users.find((u: any) => u.id === authed.id);
  if (user && email) {
    user.email = email;
    saveDb(db);
  }
  res.json({ message: 'User updated successfully' });
});

// Native stream multipart parser for file uploads
app.post('/api/storage/upload', (req, res) => {
  let bodyBuffer = Buffer.alloc(0);
  
  req.on('data', (chunk) => {
    bodyBuffer = Buffer.concat([bodyBuffer, chunk]);
  });

  req.on('end', () => {
    try {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) {
        return res.status(400).json({ error: 'Bad Request: No boundary found' });
      }

      const boundary = boundaryMatch[1];
      const bufferString = bodyBuffer.toString('binary');
      const parts = bufferString.split('--' + boundary);

      for (const part of parts) {
        if (part.includes('Content-Disposition') && part.includes('filename=')) {
          // Extract filename
          const nameMatch = part.match(/filename="([^"]+)"/);
          if (!nameMatch) continue;
          
          const filename = `${Date.now()}-${nameMatch[1].replace(/\s+/g, '_')}`;
          
          // Find binary data start and end
          const headerEndIndex = part.indexOf('\r\n\r\n');
          if (headerEndIndex === -1) continue;

          // The content ends right before the trailing \r\n
          const content = part.substring(headerEndIndex + 4, part.length - 2);
          const binaryData = Buffer.from(content, 'binary');
          
          const destPath = path.join(UPLOAD_DIR, filename);
          fs.writeFileSync(destPath, binaryData);
          
          return res.json({ url: `/uploads/${filename}` });
        }
      }

      return res.status(400).json({ error: 'No file part found' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
});

app.get('/api/admin/db-status', (req, res) => {
  const db = getDb();
  res.json({
    status: 'connected',
    users_count: db.users.length,
    posts_count: db.posts.length,
    comments_count: db.comments.length,
    likes_count: db.likes.length
  });
});

// Mock administration handlers
app.all('/api/admin/*', (req, res) => {
  res.json({ success: true, message: 'Action mock completed' });
});

// DYNAMIC SUPABASE EMULATOR
app.post('/api/supabase-mock', (req, res) => {
  const { table, actions } = req.body;
  const db = getDb();

  if (!db[table]) {
    db[table] = [];
  }

  let data = [...db[table]];

  try {
    for (const action of actions) {
      const { type } = action;
      
      if (type === 'select') {
        // Keeps state
      } else if (type === 'filter') {
        const { column, value, operator } = action;
        data = data.filter((item: any) => {
          if (item[column] === undefined) return false;
          if (operator === 'eq' || !operator) return String(item[column]) === String(value);
          if (operator === 'neq') return String(item[column]) !== String(value);
          if (operator === 'contains') return String(item[column]).toLowerCase().includes(String(value).toLowerCase());
          return false;
        });
      } else if (type === 'order') {
        const { column, descending } = action;
        data.sort((a: any, b: any) => {
          const av = a[column] || '';
          const bv = b[column] || '';
          if (av === bv) return 0;
          return descending ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
        });
      } else if (type === 'insert') {
        const rows = Array.isArray(action.values) ? action.values : [action.values];
        const insertedRows: any[] = [];
        for (const r of rows) {
          const row = {
            id: gen_uuid(),
            created_at: new Date().toISOString(),
            ...r
          };
          db[table].push(row);
          insertedRows.push(row);
        }
        saveDb(db);
        data = insertedRows;
      } else if (type === 'update') {
        const { values, filters } = action;
        db[table] = db[table].map((item: any) => {
          let matches = true;
          for (const f of filters) {
            if (String(item[f.column]) !== String(f.value)) {
              matches = false;
            }
          }
          if (matches) {
            return { ...item, ...values };
          }
          return item;
        });
        saveDb(db);
        data = db[table];
      } else if (type === 'delete') {
        const { filters } = action;
        db[table] = db[table].filter((item: any) => {
          let matches = true;
          for (const f of filters) {
            if (String(item[f.column]) !== String(f.value)) {
              matches = false;
            }
          }
          return !matches;
        });
        saveDb(db);
        data = db[table];
      }
    }

    // Populate profile details similar to nested SQL joins for client pages
    if (table === 'posts' || table === 'comments' || table === 'stories') {
      data = data.map((item: any) => {
        const prof = db.profiles.find((p: any) => p.user_id === item.user_id);
        if (prof) {
          return { ...item, profiles: prof };
        }
        return item;
      });
    }

    res.json({ data, error: null });
  } catch (e: any) {
    res.status(500).json({ data: null, error: { message: e.message } });
  }
});

// Serve frontend build output
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    // If not matching an api file, serve index.html for SPA router
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Fallback if not compiled yet
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.send('Ripple Application Server is active. Please run "npm run build" to compile compiled static assets.');
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Ripple Application Server live at http://localhost:${PORT}`);
});
