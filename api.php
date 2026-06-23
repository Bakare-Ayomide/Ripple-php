<?php
/**
 * Ripple PHP Backend Router & DB Proxy
 * Connects directly to the existing zero_lord_ripple MySQL Database.
 * Drop-in alternative to server.ts for hosting Ripple in pure PHP LAMP/LEMP stacks.
 */

// Enable Error Reporting for debugging (can be turned off in production if desired)
ini_set('display_errors', 0);
error_log("[Ripple API] Request received");

// Base directory for file uploads
define('UPLOAD_DIR', __DIR__ . '/uploads');
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0777, true);
}

// Ensure CORS headers are perfectly mapped for cross-origin or mobile web apps
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, x-client-info");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

// Utility: send formatted json response and exit
function sendJson($data, $statusCode = 200) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit();
}

// Utility to generate a clean v4 UUID
function gen_uuid() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// Password hashing utility using the identical SHA256 logic of Node.js app
function hashPassword($password) {
    return hash('sha256', $password . 'somesalt_ripple_cinode');
}

// Initialize Database connection via PDO
$pdo = null;
try {
    $dsn = "mysql:host=131.153.147.178;port=3306;dbname=zerolord_ripple;charset=utf8mb4";
    $pdo = new PDO($dsn, 'zerolord_ripple', '@F33rinimicinode', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 3
    ]);

    // Ensure database schema matches and create tables if they are not existing
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS profiles (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS posts (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS likes (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        post_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_likes_user_post (user_id, post_id),
        INDEX idx_likes_post_id (post_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS comments (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        post_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        parent_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_comments_post_id (post_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS follows (
        id VARCHAR(255) PRIMARY KEY,
        follower_id VARCHAR(255) NOT NULL,
        following_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_follows_follower_following (follower_id, following_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        sender_id VARCHAR(255) NOT NULL,
        receiver_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_messages_sender_receiver (sender_id, receiver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS stories (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS story_views (
        id VARCHAR(255) PRIMARY KEY,
        story_id VARCHAR(255) NOT NULL,
        viewer_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_story_views (story_id, viewer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        recipient_id VARCHAR(255) NOT NULL,
        actor_id VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        post_id VARCHAR(255),
        content TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_recipient_id (recipient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS user_roles (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        UNIQUE KEY uq_user_roles (user_id, role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS saved_posts (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        post_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_saved_posts_user_post (user_id, post_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Perform any safety column migration patches
    try { $pdo->exec("ALTER TABLE profiles ADD COLUMN is_banned BOOLEAN DEFAULT FALSE"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE profiles ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE profiles ADD COLUMN is_onboarding_core BOOLEAN DEFAULT FALSE"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE stories ADD COLUMN media_type VARCHAR(50) DEFAULT 'image'"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE stories ADD COLUMN thumbnail_url TEXT"); } catch (Exception $e) {}

    // Seed targeted administrators if missing on MySQL startup
    $targetAdminsList = [
        [
            'id' => '936e716b-9637-409d-ba51-1c18d85c2f93',
            'email' => 'earr.music@gmail.com',
            'username' => 'earrmusic',
            'display_name' => 'Earr Music',
        ],
        [
            'id' => '822e116b-1137-409d-ba51-1c18d85c2f94',
            'email' => 'duwit.online.dev@gmail.com',
            'username' => 'duwit_dev',
            'display_name' => 'Duwit Admin',
        ]
    ];

    foreach ($targetAdminsList as $adm) {
        $pHash = hashPassword('@f33rinimi');
        $stmtChk = $pdo->prepare("SELECT id FROM users WHERE id = ? OR email = ?");
        $stmtChk->execute([$adm['id'], $adm['email']]);
        $existingUser = $stmtChk->fetch();

        if ($existingUser) {
            $existingUserId = $existingUser['id'];
            $stmtUpd = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmtUpd->execute([$pHash, $existingUserId]);

            $stmtRole = $pdo->prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'");
            $stmtRole->execute([gen_uuid(), $existingUserId]);

            $stmtProf = $pdo->prepare("UPDATE profiles SET is_verified = TRUE WHERE user_id = ?");
            $stmtProf->execute([$existingUserId]);
        } else {
            $stmtIns = $pdo->prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)");
            $stmtIns->execute([$adm['id'], $adm['email'], $pHash]);

            $stmtProfIns = $pdo->prepare("INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified) 
                                          VALUES (?, ?, ?, ?, ?, ?, TRUE)
                                          ON DUPLICATE KEY UPDATE user_id = user_id");
            $stmtProfIns->execute([gen_uuid(), $adm['id'], $adm['username'], $adm['display_name'], "https://api.dicebear.com/7.x/adventurer/svg?seed=" . urlencode($adm['username']), 'Internal administrator.']);

            $stmtRole = $pdo->prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'");
            $stmtRole->execute([gen_uuid(), $adm['id']]);
        }
    }

} catch (Exception $e) {
    sendJson(['error' => 'Database configuration or connection handshake failure: ' . $e->getMessage()], 500);
}

// ================= FTP STORAGE SYNC IMPLEMENTATION =================
define('REMOTE_DIR', '/home/zerolord/public_html/ripple.zerolord.com/ripple/post');

function saveUploadToFtp($filename) {
    $localFile = UPLOAD_DIR . '/' . $filename;
    if (!file_exists($localFile)) {
        return;
    }

    $conn = @ftp_ssl_connect('ftp.zerolord.com');
    if (!$conn) {
        $conn = @ftp_connect('ftp.zerolord.com');
    }
    if (!$conn) return;

    $login = @ftp_login($conn, 'ripple@ripple.zerolord.com', '@f33rinimi');
    if (!$login) {
        ftp_close($conn);
        return;
    }

    ftp_pasv($conn, true);

    // Upload location 1
    $path1 = '/home/zerolord/public_html/ripple.zerolord.com/ripple/post/uploads';
    @ftp_mkdir($conn, $path1);
    @ftp_put($conn, $path1 . '/' . $filename, $localFile, FTP_BINARY);

    // Upload location 2
    $path2 = '/home/zerolord/public_html/ripple.zerolord.com/ripple/uploads';
    @ftp_mkdir($conn, $path2);
    @ftp_put($conn, $path2 . '/' . $filename, $localFile, FTP_BINARY);

    ftp_close($conn);
}

function downloadUploadFromFtp($filename) {
    $localFile = UPLOAD_DIR . '/' . $filename;
    if (file_exists($localFile)) {
        return;
    }

    $conn = @ftp_ssl_connect('ftp.zerolord.com');
    if (!$conn) {
        $conn = @ftp_connect('ftp.zerolord.com');
    }
    if (!$conn) return;

    $login = @ftp_login($conn, 'ripple@ripple.zerolord.com', '@f33rinimi');
    if (!$login) {
        ftp_close($conn);
        return;
    }

    ftp_pasv($conn, true);

    $path = '/home/zerolord/public_html/ripple.zerolord.com/ripple/uploads/' . $filename;
    @ftp_get($conn, $localFile, $path, FTP_BINARY);

    ftp_close($conn);
}

function savePostToFtp($post) {
    if (isset($post['image_url']) && !empty($post['image_url'])) {
        $urls = explode(',', $post['image_url']);
        foreach ($urls as $url) {
            if (strpos($url, '/uploads/') === 0) {
                $filename = str_replace('/uploads/', '', $url);
                saveUploadToFtp($filename);
            }
        }
    }

    $conn = @ftp_ssl_connect('ftp.zerolord.com');
    if (!$conn) {
        $conn = @ftp_connect('ftp.zerolord.com');
    }
    if (!$conn) return;

    $login = @ftp_login($conn, 'ripple@ripple.zerolord.com', '@f33rinimi');
    if (!$login) {
        ftp_close($conn);
        return;
    }

    ftp_pasv($conn, true);
    @ftp_mkdir($conn, REMOTE_DIR);

    $tempFile = tempnam(sys_get_temp_dir(), 'post_');
    file_put_contents($tempFile, json_encode($post, JSON_PRETTY_PRINT));

    @ftp_put($conn, REMOTE_DIR . '/' . $post['id'] . '.json', $tempFile, FTP_BINARY);
    @unlink($tempFile);

    ftp_close($conn);
}

function savePostIdToFtp($postId) {
    global $pdo;
    try {
        $stmt = $pdo->prepare("SELECT * FROM posts WHERE id = ?");
        $stmt->execute([$postId]);
        $post = $stmt->fetch();
        if ($post) {
            savePostToFtp($post);
        }
    } catch (Exception $e) {}
}

function deletePostFromFtp($postId) {
    $conn = @ftp_ssl_connect('ftp.zerolord.com');
    if (!$conn) {
        $conn = @ftp_connect('ftp.zerolord.com');
    }
    if (!$conn) return;

    $login = @ftp_login($conn, 'ripple@ripple.zerolord.com', '@f33rinimi');
    if (!$login) {
        ftp_close($conn);
        return;
    }

    ftp_pasv($conn, true);
    @ftp_delete($conn, REMOTE_DIR . '/' . $postId . '.json');
    ftp_close($conn);
}

function upsertPostToDatabase($postObj) {
    global $pdo;
    $cleanPost = [
        'id' => $postObj['id'],
        'user_id' => $postObj['user_id'],
        'caption' => $postObj['caption'] ?? null,
        'image_url' => $postObj['image_url'] ?? null,
        'media_type' => $postObj['media_type'] ?? 'image',
        'likes_count' => (int)($postObj['likes_count'] ?? 0),
        'comments_count' => (int)($postObj['comments_count'] ?? 0),
        'created_at' => $postObj['created_at'] ?? date('Y-m-d H:i:s')
    ];

    if (!empty($cleanPost['image_url'])) {
        $urls = explode(',', $cleanPost['image_url']);
        foreach ($urls as $url) {
            if (strpos($url, '/uploads/') === 0) {
                $filename = str_replace('/uploads/', '', $url);
                downloadUploadFromFtp($filename);
            }
        }
    }

    $keys = array_keys($cleanPost);
    $vals = array_values($cleanPost);
    $escaped_keys = array_map(function($k) { return "`$k`"; }, $keys);
    $placeholders = implode(',', array_fill(0, count($keys), '?'));

    $sql = "INSERT INTO posts (" . implode(', ', $escaped_keys) . ") 
            VALUES ($placeholders)
            ON DUPLICATE KEY UPDATE 
            caption = VALUES(caption),
            image_url = VALUES(image_url),
            media_type = VALUES(media_type),
            likes_count = VALUES(likes_count),
            comments_count = VALUES(comments_count)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($vals);
}

function syncPostsFromFtp() {
    global $pdo;
    static $lastFtpSyncTime = 0;
    if (time() - $lastFtpSyncTime < 10) {
        return;
    }
    $lastFtpSyncTime = time();

    $conn = @ftp_ssl_connect('ftp.zerolord.com');
    if (!$conn) {
        $conn = @ftp_connect('ftp.zerolord.com');
    }
    if (!$conn) return;

    $login = @ftp_login($conn, 'ripple@ripple.zerolord.com', '@f33rinimi');
    if (!$login) {
        ftp_close($conn);
        return;
    }

    ftp_pasv($conn, true);
    @ftp_mkdir($conn, REMOTE_DIR);
    $files = @ftp_nlist($conn, REMOTE_DIR);
    if (!$files) {
        ftp_close($conn);
        return;
    }

    foreach ($files as $file) {
        $filename = basename($file);
        if (substr($filename, -5) === '.json') {
            $postId = substr($filename, 0, -5);

            $stmt = $pdo->prepare("SELECT id FROM posts WHERE id = ?");
            $stmt->execute([$postId]);
            if (!$stmt->fetch()) {
                $tempFile = tempnam(sys_get_temp_dir(), 'sync_');
                if (@ftp_get($conn, $tempFile, REMOTE_DIR . '/' . $filename, FTP_BINARY)) {
                    $raw = file_get_contents($tempFile);
                    $postObj = json_decode($raw, true);
                    if ($postObj) {
                        upsertPostToDatabase($postObj);
                    }
                }
                @unlink($tempFile);
            }
        }
    }
    ftp_close($conn);
}

// Utility: parse mentions/tags (@username) from captions or comments and trigger notifications
function handleMentions($text, $actorId, $postId, $isComment = false) {
    global $pdo;
    if (empty($text)) return;

    preg_match_all('/@([a-zA-Z0-9_]+)/', $text, $matches);
    if (empty($matches[1])) return;

    $usernames = array_unique(array_map('strtolower', $matches[1]));
    if (empty($usernames)) return;

    $contentStub = mb_strlen($text) > 50 ? (mb_substr($text, 0, 50) . '...') : $text;

    foreach ($usernames as $username) {
        try {
            $stmt = $pdo->prepare("SELECT user_id FROM profiles WHERE LOWER(username) = ?");
            $stmt->execute([$username]);
            $prof = $stmt->fetch();
            if ($prof) {
                $recipientId = $prof['user_id'];
                if ($recipientId !== $actorId) {
                    $contentMsg = $isComment ? "mentioned you in a comment: \"$contentStub\"" : "mentioned you in a post: \"$contentStub\"";
                    $stmtIns = $pdo->prepare("INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)");
                    $stmtIns->execute([gen_uuid(), $recipientId, $actorId, 'mention', $postId, $contentMsg]);
                }
            }
        } catch (Exception $e) {
            error_log('[Mentions Error] ' . $e->getMessage());
        }
    }
}

// ================= ROUTING HANDLERS =================
$route = $_GET['route'] ?? '';
if (!$route) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if ($pos = strpos($uri, '?')) {
        $uri = substr($uri, 0, $pos);
    }
    if (preg_match('/\/api\/(.+)$/', $uri, $matches)) {
        $route = $matches[1];
    }
}
$route = trim($route, '/');

// Authenticated session validation helper
function getAuthenticatedUser() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    // Fallback: fetch query parameter if set
    if (!$authHeader && isset($_GET['token'])) {
        $authHeader = 'Bearer ' . $_GET['token'];
    }

    if (empty($authHeader) || strpos(strtolower($authHeader), 'bearer ') !== 0) {
        return null;
    }

    $token = substr($authHeader, 7);
    try {
        $userData = json_decode(base64_decode($token), true);
        if ($userData && isset($userData['id'])) {
            return $userData;
        }
    } catch (Exception $e) {}
    return null;
}

switch ($route) {
    case 'health':
        sendJson(['status' => 'ok', 'database' => 'mysql']);
        break;

    case 'admin/db-status':
        sendJson([
            'useLocalFallback' => false,
            'host' => '131.153.147.178',
            'database' => 'zerolord_ripple',
            'poolActive' => true
        ]);
        break;

    case 'storage/upload':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }
        if (!isset($_FILES['file'])) {
            sendJson(['error' => 'No file uploaded'], 400);
        }

        $file = $_FILES['file'];
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = time() . '-' . uniqid() . ($ext ? '.' . $ext : '');
        $destPath = UPLOAD_DIR . '/' . $filename;

        if (move_uploaded_file($file['tmp_name'], $destPath)) {
            $publicUrl = '/uploads/' . $filename;
            
            // Sync to remote FTP storage in background/afterupload
            saveUploadToFtp($filename);

            sendJson(['publicUrl' => $publicUrl]);
        } else {
            sendJson(['error' => 'Failed to save uploaded file'], 500);
        }
        break;

    case 'auth/signup':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }
        
        $body = json_decode(file_get_contents('php://input'), true);
        $rawEmail = $body['email'] ?? '';
        $password = $body['password'] ?? '';
        $options = $body['options'] ?? [];

        if (empty($rawEmail) || empty($password)) {
            sendJson(['error' => 'Email and password required.'], 400);
        }

        $email = strtolower(trim($rawEmail));

        try {
            // Check if user already exists
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                sendJson(['error' => 'User with this email already exists.'], 400);
            }

            $userId = gen_uuid();
            $pHash = hashPassword($password);

            // Create main credentials entry
            $stmtInsert = $pdo->prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)");
            $stmtInsert->execute([$userId, $email, $pHash]);

            // Create profile
            $username = $options['data']['username'] ?? explode('@', $email)[0];
            $display_name = $options['data']['display_name'] ?? $username;
            $avatar_url = $options['data']['avatar_url'] ?? "https://api.dicebear.com/7.x/adventurer/svg?seed=" . urlencode($username);

            $stmtProf = $pdo->prepare("INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified) VALUES (?, ?, ?, ?, ?, ?, FALSE)");
            $stmtProf->execute([gen_uuid(), $userId, $username, $display_name, $avatar_url, 'Hello, I am new on Ripple!']);

            // Create user role
            $stmtCount = $pdo->query("SELECT id FROM user_roles WHERE role = 'admin' LIMIT 1");
            $hasAdmin = $stmtCount->fetch();
            $assignedRole = !$hasAdmin ? 'admin' : 'user';

            $stmtRole = $pdo->prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)");
            $stmtRole->execute([gen_uuid(), $userId, $assignedRole]);

            // Create access session token (identical base64 JSON structure)
            $tokenPayload = ['id' => $userId, 'email' => $email];
            $accessToken = base64_encode(json_encode($tokenPayload));

            $userObj = [
                'id' => $userId,
                'email' => $email,
                'user_metadata' => [
                    'username' => $username,
                    'display_name' => $display_name,
                    'avatar_url' => $avatar_url,
                    'needs_onboarding' => true
                ]
            ];

            sendJson([
                'session' => [
                    'access_token' => $accessToken,
                    'user' => $userObj
                ],
                'user' => $userObj
            ]);

        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'auth/signin':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $rawEmail = $body['email'] ?? '';
        $password = $body['password'] ?? '';

        if (empty($rawEmail) || empty($password)) {
            sendJson(['error' => 'Email and password required.'], 400);
        }

        $email = strtolower(trim($rawEmail));

        try {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $userRecord = $stmt->fetch();

            if (!$userRecord || $userRecord['password_hash'] !== hashPassword($password)) {
                sendJson(['error' => 'Invalid email or password.'], 401);
            }

            // Fetch profile
            $stmtProf = $pdo->prepare("SELECT * FROM profiles WHERE user_id = ?");
            $stmtProf->execute([$userRecord['id']]);
            $profile = $stmtProf->fetch();

            if ($profile) {
                if ($profile['is_banned'] || $profile['is_suspended']) {
                    sendJson(['error' => $profile['is_banned'] ? 'This account has been permanently banned.' : 'This account has been suspended.'], 403);
                }
            } else {
                // Auto create profile if somehow missing in SQL
                $username = explode('@', $email)[0];
                $display_name = $username;
                $avatar_url = "https://api.dicebear.com/7.x/adventurer/svg?seed=" . urlencode($username);
                $profileId = gen_uuid();

                $stmtNewProf = $pdo->prepare("INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified) VALUES (?, ?, ?, ?, ?, ?, FALSE)");
                $stmtNewProf->execute([$profileId, $userRecord['id'], $username, $display_name, $avatar_url, 'Hello, I am new on Ripple!']);

                $profile = [
                    'id' => $profileId,
                    'user_id' => $userRecord['id'],
                    'username' => $username,
                    'display_name' => $display_name,
                    'avatar_url' => $avatar_url,
                    'bio' => 'Hello, I am new on Ripple!',
                    'is_verified' => 0
                ];
            }

            $tokenPayload = ['id' => $userRecord['id'], 'email' => $userRecord['email']];
            $accessToken = base64_encode(json_encode($tokenPayload));

            $userObj = [
                'id' => $userRecord['id'],
                'email' => $userRecord['email'],
                'user_metadata' => [
                    'username' => $profile['username'],
                    'display_name' => $profile['display_name'] ?: $profile['username'],
                    'avatar_url' => $profile['avatar_url']
                ]
            ];

            sendJson([
                'session' => [
                    'access_token' => $accessToken,
                    'user' => $userObj
                ],
                'user' => $userObj
            ]);

        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'auth/reset-password':
        sendJson(['status' => 'ok', 'message' => 'Instructions sent if email is found.']);
        break;

    case 'auth/update-user':
        $authUser = getAuthenticatedUser();
        if (!$authUser) {
            sendJson(['error' => 'Not authenticated'], 401);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $password = $body['password'] ?? '';

        if (empty($password)) {
            sendJson(['error' => 'Password is required.'], 400);
        }

        try {
            $pHash = hashPassword($password);
            $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmt->execute([$pHash, $authUser['id']]);

            sendJson(['status' => 'ok']);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'auth/validate':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $token = $body['token'] ?? '';

        if (empty($token)) {
            sendJson(['error' => 'No token provided'], 401);
        }

        try {
            $tokenData = json_decode(base64_decode($token), true);
            if (!$tokenData || !isset($tokenData['id'])) {
                sendJson(['error' => 'Token invalid'], 401);
            }

            // Look up email credentials
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$tokenData['id']]);
            $userRecord = $stmt->fetch();

            if (!$userRecord) {
                sendJson(['error' => 'User no longer exists in MySQL'], 401);
            }

            // Look up user profile
            $stmtProf = $pdo->prepare("SELECT * FROM profiles WHERE user_id = ?");
            $stmtProf->execute([$userRecord['id']]);
            $profile = $stmtProf->fetch();

            if ($profile) {
                if ($profile['is_banned'] || $profile['is_suspended']) {
                    sendJson(['error' => $profile['is_banned'] ? 'This account has been permanently banned.' : 'This account has been suspended.'], 403);
                }
            } else {
                $username = explode('@', $userRecord['email'])[0];
                $display_name = $username;
                $avatar_url = "https://api.dicebear.com/7.x/adventurer/svg?seed=" . urlencode($username);
                $profileId = gen_uuid();

                $stmtInsProf = $pdo->prepare("INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified) VALUES (?, ?, ?, ?, ?, ?, FALSE)");
                $stmtInsProf->execute([$profileId, $userRecord['id'], $username, $display_name, $avatar_url, 'Hello, I am new on Ripple!']);

                $profile = [
                    'id' => $profileId,
                    'user_id' => $userRecord['id'],
                    'username' => $username,
                    'display_name' => $display_name,
                    'avatar_url' => $avatar_url,
                    'bio' => 'Hello, I am new on Ripple!',
                    'is_verified' => false
                ];
            }

            sendJson([
                'user' => [
                    'id' => $userRecord['id'],
                    'email' => $userRecord['email'],
                    'user_metadata' => [
                        'username' => $profile['username'],
                        'display_name' => $profile['display_name'] ?: $profile['username'],
                        'avatar_url' => $profile['avatar_url']
                    ]
                ]
            ]);

        } catch (Exception $e) {
            sendJson(['error' => 'Token parsing exception: ' . $e->getMessage()], 401);
        }
        break;

    case 'admin/default-avatars':
        $configPath = UPLOAD_DIR . '/custom_default_avatars.json';
        $currentConfigs = ['male' => [], 'female' => [], 'nonbinary' => []];
        if (file_exists($configPath)) {
            try {
                $content = file_get_contents($configPath);
                $loaded = json_decode($content, true);
                if (is_array($loaded)) $currentConfigs = array_merge($currentConfigs, $loaded);
            } catch (Exception $e) {}
        }

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            sendJson(['success' => true, 'configs' => $currentConfigs]);
        } else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $gender = $_POST['gender'] ?? '';
            if (empty($gender) || !in_array($gender, ['male', 'female', 'nonbinary'])) {
                sendJson(['error' => 'Gender must be male, female, or nonbinary.'], 400);
            }
            if (!isset($_FILES['file'])) {
                sendJson(['error' => 'No file uploaded.'], 400);
            }

            $file = $_FILES['file'];
            $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = time() . '-' . uniqid() . ($ext ? '.' . $ext : '');
            $destPath = UPLOAD_DIR . '/' . $filename;

            if (move_uploaded_file($file['tmp_name'], $destPath)) {
                $publicUrl = '/uploads/' . $filename;
                
                $currentConfigs[$gender][] = $publicUrl;
                file_put_contents($configPath, json_encode($currentConfigs, JSON_PRETTY_PRINT));

                saveUploadToFtp($filename);

                sendJson(['success' => true, 'configs' => $currentConfigs, 'url' => $publicUrl]);
            } else {
                sendJson(['error' => 'Failed to save uploaded file'], 500);
            }
        }
        break;

    case 'admin/users/create':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $email = $body['email'] ?? '';
        $password = $body['password'] ?? '';
        $username = $body['username'] ?? '';
        $display_name = $body['display_name'] ?? '';

        if (empty($email) || empty($password) || empty($username)) {
            sendJson(['error' => 'Missing email, password, or username.'], 400);
        }

        try {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                sendJson(['error' => 'Email already registered.'], 400);
            }

            $stmtU = $pdo->prepare("SELECT id FROM profiles WHERE username = ?");
            $stmtU->execute([strtolower(trim($username))]);
            if ($stmtU->fetch()) {
                sendJson(['error' => 'Username already taken.'], 400);
            }

            $userId = gen_uuid();
            $pHash = hashPassword($password);

            $stmtInsert = $pdo->prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)");
            $stmtInsert->execute([$userId, $email, $pHash]);

            $profileId = gen_uuid();
            $avatarUrl = "https://api.dicebear.com/7.x/adventurer/svg?seed=" . urlencode($username);

            $stmtInsProf = $pdo->prepare("INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio, is_verified, is_banned, is_suspended) 
                                          VALUES (?, ?, ?, ?, ?, ?, FALSE, FALSE, FALSE)");
            $stmtInsProf->execute([$profileId, $userId, strtolower(trim($username)), $display_name ?: $username, $avatarUrl, 'Hello, I was created by an Admin!']);

            sendJson(['success' => true, 'userId' => $userId]);

        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'admin/users/update':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $user_id = $body['user_id'] ?? '';
        $username = $body['username'] ?? null;
        $display_name = $body['display_name'] ?? null;
        $bio = $body['bio'] ?? null;
        $is_verified = $body['is_verified'] ?? null;
        $is_onboarding_core = $body['is_onboarding_core'] ?? null;

        if (empty($user_id)) {
            sendJson(['error' => 'Missing user_id.'], 400);
        }

        try {
            if ($username !== null) {
                $finalUsername = strtolower(trim($username));
                $stmt = $pdo->prepare("SELECT id FROM profiles WHERE username = ? AND user_id != ?");
                $stmt->execute([$finalUsername, $user_id]);
                if ($stmt->fetch()) {
                    sendJson(['error' => 'Username already taken.'], 400);
                }
            }

            $fields = [];
            $params = [];
            
            if ($username !== null) { $fields[] = "`username` = ?"; $params[] = strtolower(trim($username)); }
            if ($display_name !== null) { $fields[] = "`display_name` = ?"; $params[] = $display_name; }
            if ($bio !== null) { $fields[] = "`bio` = ?"; $params[] = $bio; }
            if ($is_verified !== null) { $fields[] = "`is_verified` = ?"; $params[] = $is_verified ? 1 : 0; }
            if ($is_onboarding_core !== null) { $fields[] = "`is_onboarding_core` = ?"; $params[] = $is_onboarding_core ? 1 : 0; }

            if (count($fields) > 0) {
                $params[] = $user_id;
                $sql = "UPDATE profiles SET " . implode(', ', $fields) . " WHERE user_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            }

            sendJson(['success' => true]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'admin/users/delete':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $user_id = $body['user_id'] ?? '';

        if (empty($user_id)) {
            sendJson(['error' => 'Missing user_id.'], 400);
        }

        try {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

            $queries = [
                "DELETE FROM likes WHERE user_id = ?",
                "DELETE FROM comments WHERE user_id = ?",
                "DELETE FROM follows WHERE follower_id = ? OR following_id = ?",
                "DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?",
                "DELETE FROM stories WHERE user_id = ?",
                "DELETE FROM story_views WHERE viewer_id = ?",
                "DELETE FROM notifications WHERE recipient_id = ? OR actor_id = ?",
                "DELETE FROM user_roles WHERE user_id = ?",
                "DELETE FROM saved_posts WHERE user_id = ?",
                "DELETE FROM profiles WHERE user_id = ?",
                "DELETE FROM users WHERE id = ?"
            ];

            // Handle FTP stories and posts cascades
            $stmtPosts = $pdo->prepare("SELECT id FROM posts WHERE user_id = ?");
            $stmtPosts->execute([$user_id]);
            $posts = $stmtPosts->fetchAll();
            foreach ($posts as $p) {
                deletePostFromFtp($p['id']);
            }

            $pdo->prepare("DELETE FROM posts WHERE user_id = ?")->execute([$user_id]);

            foreach ($queries as $q) {
                $stmt = $pdo->prepare($q);
                // Execute passes user_id once or twice depending on query
                $paramCount = substr_count($q, '?');
                $pArray = array_fill(0, $paramCount, $user_id);
                $stmt->execute($pArray);
            }

            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

            sendJson(['success' => true]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'admin/users/ban':
    case 'admin/users/suspend':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $user_id = $body['user_id'] ?? '';
        $status = $body['status'] ?? false;

        if (empty($user_id)) {
            sendJson(['error' => 'Missing user_id.'], 400);
        }

        try {
            $column = ($route === 'admin/users/ban') ? 'is_banned' : 'is_suspended';
            $sql = "UPDATE profiles SET `$column` = ? WHERE user_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$status ? 1 : 0, $user_id]);

            sendJson(['success' => true]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'admin/posts/create':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $user_id = $body['user_id'] ?? '';
        $caption = $body['caption'] ?? '';
        $image_url = $body['image_url'] ?? '';
        $media_type = $body['media_type'] ?? 'image';

        if (empty($user_id)) {
            sendJson(['error' => 'Missing user_id.'], 400);
        }

        try {
            $postId = gen_uuid();
            $stmt = $pdo->prepare("INSERT INTO posts (id, user_id, caption, image_url, media_type) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$postId, $user_id, $caption, $image_url, $media_type]);

            // Mentions
            handleMentions($caption, $user_id, $postId, false);

            // FTP Sync
            savePostIdToFtp($postId);

            sendJson(['success' => true, 'id' => $postId]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'admin/posts/update':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $id = $body['id'] ?? '';
        $caption = $body['caption'] ?? '';
        $image_url = $body['image_url'] ?? '';

        if (empty($id)) {
            sendJson(['error' => 'Missing post id.'], 400);
        }

        try {
            $stmt = $pdo->prepare("UPDATE posts SET caption = ?, image_url = ? WHERE id = ?");
            $stmt->execute([$caption, $image_url, $id]);

            // Sync FTP
            savePostIdToFtp($id);

            sendJson(['success' => true]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'admin/posts/delete':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $id = $body['id'] ?? '';

        if (empty($id)) {
            sendJson(['error' => 'Missing post id.'], 400);
        }

        try {
            $pdo->prepare("DELETE FROM comments WHERE post_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM likes WHERE post_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM saved_posts WHERE post_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM notifications WHERE post_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM posts WHERE id = ?")->execute([$id]);

            // Delete FTP
            deletePostFromFtp($id);

            sendJson(['success' => true]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'supabase-mock':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $table = $body['table'] ?? '';
        $actions = $body['actions'] ?? [];

        // Check if user session has been deleted
        $authUser = getAuthenticatedUser();
        if ($authUser) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
            $stmt->execute([$authUser['id']]);
            if (!$stmt->fetch()) {
                sendJson(['error' => ['message' => 'User session has been invalidated or deleted.']], 401);
            }
        }

        try {
            $queryType = 'select';
            $whereClauses = [];
            $params = [];
            $orderBy = '';
            $limitVal = null;
            $isSingle = false;
            $insertValues = null;
            $updateValues = null;

            foreach ($actions as $action) {
                switch ($action['type'] ?? '') {
                    case 'select':
                        $queryType = 'select';
                        break;
                    case 'insert':
                        $queryType = 'insert';
                        $insertValues = $action['values'] ?? null;
                        break;
                    case 'update':
                        $queryType = 'update';
                        $updateValues = $action['values'] ?? null;
                        break;
                    case 'delete':
                        $queryType = 'delete';
                        break;
                    case 'eq':
                        $whereClauses[] = "`" . $action['column'] . "` = ?";
                        $params[] = $action['value'];
                        break;
                    case 'neq':
                        $whereClauses[] = "`" . $action['column'] . "` != ?";
                        $params[] = $action['value'];
                        break;
                    case 'gt':
                        $whereClauses[] = "`" . $action['column'] . "` > ?";
                        $params[] = $action['value'];
                        break;
                    case 'gte':
                        $whereClauses[] = "`" . $action['column'] . "` >= ?";
                        $params[] = $action['value'];
                        break;
                    case 'lt':
                        $whereClauses[] = "`" . $action['column'] . "` < ?";
                        $params[] = $action['value'];
                        break;
                    case 'lte':
                        $whereClauses[] = "`" . $action['column'] . "` <= ?";
                        $params[] = $action['value'];
                        break;
                    case 'in':
                        if (isset($action['values']) && is_array($action['values']) && count($action['values']) > 0) {
                            $placeholders = implode(',', array_fill(0, count($action['values']), '?'));
                            $whereClauses[] = "`" . $action['column'] . "` IN ($placeholders)";
                            foreach ($action['values'] as $v) {
                                $params[] = $v;
                            }
                        } else {
                            $whereClauses[] = "1 = 0";
                        }
                        break;
                    case 'not':
                        if (($action['operator'] ?? '') === 'in') {
                            $rawVal = $action['value'] ?? '';
                            if (is_string($rawVal)) {
                                $rawVal = trim($rawVal, '()');
                                $parts = array_filter(array_map('trim', explode(',', $rawVal)));
                                if (count($parts) > 0) {
                                    $placeholders = implode(',', array_fill(0, count($parts), '?'));
                                    $whereClauses[] = "`" . $action['column'] . "` NOT IN ($placeholders)";
                                    foreach ($parts as $p) {
                                        $params[] = $p;
                                    }
                                }
                            }
                        }
                        break;
                    case 'or':
                        $orVal = $action['filter'] ?? '';
                        if (strpos($orVal, 'and(sender_id.eq.') !== false && strpos($orVal, 'receiver_id.eq.') !== false) {
                            preg_match_all('/sender_id\.eq\.([^,)]+),receiver_id\.eq\.([^,)]+)/', $orVal, $matches);
                            if (isset($matches[1]) && count($matches[1]) >= 2) {
                                $whereClauses[] = "((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))";
                                $params[] = $matches[1][0];
                                $params[] = $matches[2][0];
                                $params[] = $matches[1][1];
                                $params[] = $matches[2][1];
                            }
                        } else if (strpos($orVal, 'sender_id.eq.') !== false && strpos($orVal, 'receiver_id.eq.') !== false) {
                            preg_match('/sender_id\.eq\.([^,]+)/', $orVal, $sMatch);
                            preg_match('/receiver_id\.eq\.([^,]+)/', $orVal, $rMatch);
                            if ($sMatch && $rMatch) {
                                $whereClauses[] = "(sender_id = ? OR receiver_id = ?)";
                                $params[] = $sMatch[1];
                                $params[] = $rMatch[1];
                            }
                        }
                        break;
                    case 'order':
                        $dir = (isset($action['options']['ascending']) && $action['options']['ascending'] === false) ? 'DESC' : 'ASC';
                        $orderBy = "ORDER BY `$table`.`" . $action['column'] . "` $dir";
                        break;
                    case 'limit':
                        $limitVal = (int)$action['count'];
                        break;
                    case 'single':
                    case 'maybeSingle':
                        $isSingle = true;
                        break;
                }
            }

            $whereSql = count($whereClauses) > 0 ? "WHERE " . implode(' AND ', $whereClauses) : '';
            $limitSql = $limitVal !== null ? "LIMIT $limitVal" : '';

            if ($queryType === 'select') {
                if ($table === 'posts') {
                    // Sync FTP files recursively
                    syncPostsFromFtp();
                    $sql = "
                        SELECT posts.*, 
                               profiles.username as profile_username, 
                               profiles.display_name as profile_display_name, 
                               profiles.avatar_url as profile_avatar_url, 
                               profiles.is_verified as profile_is_verified
                        FROM posts
                        LEFT JOIN profiles ON posts.user_id = profiles.user_id
                        $whereSql
                        " . ($orderBy ?: "ORDER BY posts.created_at DESC") . "
                        $limitSql
                    ";
                } else if ($table === 'comments') {
                    $sql = "
                        SELECT comments.*, 
                               profiles.username as profile_username, 
                               profiles.avatar_url as profile_avatar_url, 
                               profiles.is_verified as profile_is_verified
                        FROM comments
                        LEFT JOIN profiles ON comments.user_id = profiles.user_id
                        $whereSql
                        " . ($orderBy ?: "ORDER BY comments.created_at ASC") . "
                        $limitSql
                    ";
                } else if ($table === 'stories') {
                    $sql = "
                        SELECT stories.*, 
                               profiles.username as profile_username, 
                               profiles.display_name as profile_display_name, 
                               profiles.avatar_url as profile_avatar_url, 
                               profiles.is_verified as profile_is_verified
                        FROM stories
                        LEFT JOIN profiles ON stories.user_id = profiles.user_id
                        $whereSql
                        " . ($orderBy ?: "ORDER BY stories.created_at DESC") . "
                        $limitSql
                    ";
                } else if ($table === 'notifications') {
                    $sql = "
                        SELECT notifications.*, 
                               profiles.username as profile_username, 
                               profiles.display_name as profile_display_name, 
                               profiles.avatar_url as profile_avatar_url, 
                               profiles.is_verified as profile_is_verified
                        FROM notifications
                        LEFT JOIN profiles ON notifications.actor_id = profiles.user_id
                        $whereSql
                        " . ($orderBy ?: "ORDER BY notifications.created_at DESC") . "
                        $limitSql
                    ";
                } else {
                    $sql = "SELECT * FROM `$table` $whereSql $orderBy $limitSql";
                }

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll();

                $data = [];
                foreach ($rows as $r) {
                    $formatted = $r;
                    if (isset($formatted['is_verified'])) $formatted['is_verified'] = (bool)$formatted['is_verified'];
                    if (isset($formatted['is_read'])) $formatted['is_read'] = (bool)$formatted['is_read'];

                    if ($table === 'posts') {
                        $formatted['profiles'] = [
                            'username' => $r['profile_username'] ?? null,
                            'display_name' => $r['profile_display_name'] ?? null,
                            'avatar_url' => $r['profile_avatar_url'] ?? null,
                            'is_verified' => isset($r['profile_is_verified']) ? (bool)$r['profile_is_verified'] : false
                        ];
                    } else if ($table === 'comments') {
                        $formatted['profiles'] = [
                            'username' => $r['profile_username'] ?? null,
                            'avatar_url' => $r['profile_avatar_url'] ?? null,
                            'is_verified' => isset($r['profile_is_verified']) ? (bool)$r['profile_is_verified'] : false
                        ];
                    } else if ($table === 'stories') {
                        $formatted['profiles'] = [
                            'username' => $r['profile_username'] ?? null,
                            'display_name' => $r['profile_display_name'] ?? null,
                            'avatar_url' => $r['profile_avatar_url'] ?? null,
                            'is_verified' => isset($r['profile_is_verified']) ? (bool)$r['profile_is_verified'] : false
                        ];
                    } else if ($table === 'notifications') {
                        $formatted['actor'] = isset($r['profile_username']) ? [
                            'username' => $r['profile_username'],
                            'display_name' => $r['profile_display_name'] ?? null,
                            'avatar_url' => $r['profile_avatar_url'] ?? null,
                            'is_verified' => isset($r['profile_is_verified']) ? (bool)$r['profile_is_verified'] : false
                        ] : null;
                    } else if ($table === 'profiles') {
                        $formatted['is_verified'] = (bool)($r['is_verified'] ?? false);
                    } else if ($table === 'messages') {
                        $formatted['is_read'] = (bool)($r['is_read'] ?? false);
                    }
                    $data[] = $formatted;
                }

                $result = $isSingle ? ($data[0] ?? null) : $data;
                sendJson(['data' => $result, 'error' => null, 'count' => count($data)]);

            } else if ($queryType === 'insert') {
                $isArray = is_array($insertValues) && isset($insertValues[0]) && is_array($insertValues[0]);
                $list = $isArray ? $insertValues : [$insertValues];

                $insertedRows = [];
                foreach ($list as $item) {
                    if (!isset($item['id']) || empty($item['id'])) {
                        $item['id'] = gen_uuid();
                    }

                    $keys = array_keys($item);
                    $vals = array_values($item);
                    $escaped_keys = array_map(function($k) { return "`$k`"; }, $keys);
                    $placeholders = implode(',', array_fill(0, count($keys), '?'));

                    $sql = "INSERT INTO `$table` (" . implode(', ', $escaped_keys) . ") VALUES ($placeholders)";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($vals);
                    $insertedRows[] = $item;

                    // Counter & Trigger Mimicry
                    if ($table === 'likes') {
                        $pdo->prepare("UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?")->execute([$item['post_id']]);
                        savePostIdToFtp($item['post_id']);
                        try {
                            $stmtPost = $pdo->prepare("SELECT user_id FROM posts WHERE id = ?");
                            $stmtPost->execute([$item['post_id']]);
                            $pRecord = $stmtPost->fetch();
                            if ($pRecord && $pRecord['user_id'] !== $item['user_id']) {
                                $stmtNotif = $pdo->prepare("INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)");
                                $stmtNotif->execute([gen_uuid(), $pRecord['user_id'], $item['user_id'], 'like', $item['post_id'], 'liked your post.']);
                            }
                        } catch (Exception $e) {}
                    }
                    if ($table === 'comments') {
                        $pdo->prepare("UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?")->execute([$item['post_id']]);
                        savePostIdToFtp($item['post_id']);
                        try {
                            $stmtPost = $pdo->prepare("SELECT user_id FROM posts WHERE id = ?");
                            $stmtPost->execute([$item['post_id']]);
                            $pRecord = $stmtPost->fetch();
                            if ($pRecord && $pRecord['user_id'] !== $item['user_id']) {
                                $stmtNotif = $pdo->prepare("INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)");
                                $stmtNotif->execute([gen_uuid(), $pRecord['user_id'], $item['user_id'], 'comment', $item['post_id'], 'commented on your post.']);
                            }
                        } catch (Exception $e) {}
                        handleMentions($item['content'], $item['user_id'], $item['post_id'], true);
                    }
                    if ($table === 'follows') {
                        try {
                            $stmtFback = $pdo->prepare("SELECT id FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1");
                            $stmtFback->execute([$item['following_id'], $item['follower_id']]);
                            $fback = $stmtFback->fetch();
                            $notifContent = $fback ? 'followed you back.' : 'started following you.';

                            $stmtNotif = $pdo->prepare("INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)");
                            $stmtNotif->execute([gen_uuid(), $item['following_id'], $item['follower_id'], 'follow', null, $notifContent]);
                        } catch (Exception $e) {}
                    }
                    if ($table === 'posts') {
                        handleMentions($item['caption'], $item['user_id'], $item['id'], false);
                        savePostIdToFtp($item['id']);
                    }
                    if ($table === 'messages') {
                        try {
                            $text = $item['content'] ?? '';
                            $contentStub = mb_strlen($text) > 50 ? (mb_substr($text, 0, 50) . '...') : $text;
                            if (empty($contentStub)) $contentStub = 'Sent you a message.';

                            $stmtNotif = $pdo->prepare("INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)");
                            $stmtNotif->execute([gen_uuid(), $item['receiver_id'], $item['sender_id'], 'message', null, $contentStub]);
                        } catch (Exception $e) {}
                    }
                    if ($table === 'stories') {
                        handleMentions($item['caption'], $item['user_id'], null, false);
                    }
                    if ($table === 'saved_posts') {
                        try {
                            $stmtPost = $pdo->prepare("SELECT user_id FROM posts WHERE id = ?");
                            $stmtPost->execute([$item['post_id']]);
                            $pRecord = $stmtPost->fetch();
                            if ($pRecord && $pRecord['user_id'] !== $item['user_id']) {
                                $stmtNotif = $pdo->prepare("INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)");
                                $stmtNotif->execute([gen_uuid(), $pRecord['user_id'], $item['user_id'], 'save_post', $item['post_id'], 'saved your post.']);
                            }
                        } catch (Exception $e) {}
                    }
                    if ($table === 'story_views') {
                        try {
                            $stmtStory = $pdo->prepare("SELECT user_id FROM stories WHERE id = ?");
                            $stmtStory->execute([$item['story_id']]);
                            $sRecord = $stmtStory->fetch();
                            if ($sRecord && $sRecord['user_id'] !== $item['user_id']) {
                                $stmtCheckNotif = $pdo->prepare("SELECT id FROM notifications WHERE recipient_id = ? AND actor_id = ? AND type = 'story_view' LIMIT 1");
                                $stmtCheckNotif->execute([$sRecord['user_id'], $item['user_id']]);
                                if (!$stmtCheckNotif->fetch()) {
                                    $stmtNotif = $pdo->prepare("INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)");
                                    $stmtNotif->execute([gen_uuid(), $sRecord['user_id'], $item['user_id'], 'story_view', null, 'viewed your story.']);
                                }
                            }
                        } catch (Exception $e) {}
                    }
                }
                sendJson(['data' => $isArray ? $insertedRows : $insertedRows[0], 'error' => null]);

            } else if ($queryType === 'update') {
                $keys = array_keys($updateValues);
                $vals = array_values($updateValues);
                $set_clauses = array_map(function($k) { return "`$k` = ?"; }, $keys);

                $sql = "UPDATE `$table` SET " . implode(', ', $set_clauses) . " $whereSql";
                $stmt = $pdo->prepare($sql);
                $stmt->execute(array_merge($vals, $params));

                sendJson(['data' => $updateValues, 'error' => null]);

            } else if ($queryType === 'delete') {
                if ($table === 'likes' && count($whereClauses) > 0) {
                    $stmtSel = $pdo->prepare("SELECT * FROM likes $whereSql");
                    $stmtSel->execute($params);
                    $likesRows = $stmtSel->fetchAll();
                    foreach ($likesRows as $r) {
                        $pdo->prepare("UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?")->execute([$r['post_id']]);
                        savePostIdToFtp($r['post_id']);
                    }
                }
                if ($table === 'comments' && count($whereClauses) > 0) {
                    $stmtSel = $pdo->prepare("SELECT * FROM comments $whereSql");
                    $stmtSel->execute($params);
                    $commentsRows = $stmtSel->fetchAll();
                    foreach ($commentsRows as $r) {
                        $pdo->prepare("UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = ?")->execute([$r['post_id']]);
                        savePostIdToFtp($r['post_id']);
                    }
                }
                if ($table === 'posts') {
                    $stmtSel = $pdo->prepare("SELECT id FROM posts $whereSql");
                    $stmtSel->execute($params);
                    $postsRows = $stmtSel->fetchAll();
                    foreach ($postsRows as $r) {
                        deletePostFromFtp($r['id']);
                    }
                }

                $sql = "DELETE FROM `$table` $whereSql";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                sendJson(['data' => true, 'error' => null]);
            }

        } catch (Exception $ex) {
            sendJson(['data' => null, 'error' => $ex->getMessage()], 500);
        }
        break;

    default:
        sendJson(['error' => 'API Endpoint or Route segment not found'], 404);
        break;
}
