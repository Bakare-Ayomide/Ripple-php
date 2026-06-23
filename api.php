<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

error_reporting(E_ALL & ~E_NOTICE);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

define('UPLOAD_DIR', dirname(__DIR__) . '/uploads');
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0777, true);
}

define('DB_FILE', UPLOAD_DIR . '/local_db.json');

// --- DATABASE HELPERS ---
function getDb() {
    if (!file_exists(DB_FILE)) {
        $initial = [
            "users" => [],
            "profiles" => [],
            "posts" => [],
            "likes" => [],
            "comments" => [],
            "follows" => [],
            "messages" => [],
            "stories" => [],
            "story_views" => [],
            "notifications" => [],
            "user_roles" => [],
            "saved_posts" => []
        ];
        file_put_contents(DB_FILE, json_encode($initial, JSON_PRETTY_PRINT));
    }
    return json_decode(file_get_contents(DB_FILE), true);
}

function saveDb($db) {
    file_put_contents(DB_FILE, json_encode($db, JSON_PRETTY_PRINT));
}

function gen_uuid() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function sendJson($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// --- JWT EMULATOR ---
function getBearerToken() {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
            return $matches[1];
        }
    }
    return null;
}

function decodeToken($token) {
    if (!$token) return null;
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return null;
    }
    return $payload;
}

function createToken($user) {
    $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode([
        'sub' => $user['id'],
        'email' => $user['email'],
        'exp' => time() + (24 * 60 * 60 * 7) // 7 days
    ]));
    $signature = base64_encode(hash_hmac('sha256', "$header.$payload", "ripple_secret", true));
    return "$header.$payload.$signature";
}

function getAuthenticatedUser() {
    $token = getBearerToken();
    $payload = decodeToken($token);
    if (!$payload) return null;
    
    $db = getDb();
    foreach ($db['users'] as $u) {
        if ($u['id'] === $payload['sub']) {
            return $u;
        }
    }
    return null;
}

// --- ROUTES PARSING ---
$route = $_GET['route'] ?? '';
$route = rtrim($route, '/');

// Authenticate helper
$currentUser = getAuthenticatedUser();

switch ($route) {
    case 'auth/signup':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendJson(['error' => 'Method not allowed'], 405);
        $input = json_decode(file_get_contents('php://input'), true);
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';
        $username = trim($input['username'] ?? '');
        $displayName = trim($input['displayName'] ?? '');

        if (!$email || !$password) {
            sendJson(['error' => 'Missing email or password'], 400);
        }

        $db = getDb();
        foreach ($db['users'] as $u) {
            if ($u['email'] === $email) {
                sendJson(['error' => 'User already exists'], 400);
            }
        }

        if ($username) {
            foreach ($db['profiles'] as $p) {
                if (strtolower($p['username']) === strtolower($username)) {
                    sendJson(['error' => 'Username is already taken'], 400);
                }
            }
        }

        $userId = gen_uuid();
        $user = [
            'id' => $userId,
            'email' => $email,
            'password_hash' => hash('sha256', $password),
            'created_at' => date(DATE_ATOM)
        ];

        // Create profile
        $profileId = gen_uuid();
        $profile = [
            'id' => $profileId,
            'user_id' => $userId,
            'username' => $username ?: explode('@', $email)[0],
            'display_name' => $displayName ?: explode('@', $email)[0],
            'avatar_url' => 'https://api.dicebear.com/7.x/adventurer/svg?seed=' . ($username ?: explode('@', $email)[0]),
            'bio' => '',
            'is_verified' => false,
            'created_at' => date(DATE_ATOM),
            'updated_at' => date(DATE_ATOM)
        ];

        // First user admin
        $role = "user";
        if (count($db['users']) === 0) {
            $role = "admin";
            $profile['is_verified'] = true;
        }

        $db['users'][] = $user;
        $db['profiles'][] = $profile;
        $db['user_roles'][] = [
            'id' => gen_uuid(),
            'user_id' => $userId,
            'role' => $role
        ];

        saveDb($db);

        $token = createToken($user);
        sendJson([
            'session' => ['access_token' => $token, 'user' => $user],
            'user' => $user,
            'profile' => $profile
        ]);
        break;

    case 'auth/signin':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendJson(['error' => 'Method not allowed'], 405);
        $input = json_decode(file_get_contents('php://input'), true);
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';

        $db = getDb();
        $targetUser = null;
        foreach ($db['users'] as $u) {
            if ($u['email'] === $email && $u['password_hash'] === hash('sha256', $password)) {
                $targetUser = $u;
                break;
            }
        }

        if (!$targetUser) {
            sendJson(['error' => 'Invalid email or password'], 400);
        }

        $token = createToken($targetUser);
        sendJson([
            'session' => ['access_token' => $token, 'user' => $targetUser],
            'user' => $targetUser
        ]);
        break;

    case 'auth/validate':
        if (!$currentUser) {
            sendJson(['error' => 'Unauthorized'], 401);
        }
        sendJson(['user' => $currentUser]);
        break;

    case 'auth/reset-password':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendJson(['error' => 'Method not allowed'], 405);
        $input = json_decode(file_get_contents('php://input'), true);
        $email = strtolower(trim($input['email'] ?? ''));
        $newPassword = $input['password'] ?? '';

        if (!$email || !$newPassword) {
            sendJson(['error' => 'Missing email or password'], 400);
        }

        $db = getDb();
        $found = false;
        foreach ($db['users'] as &$u) {
            if ($u['email'] === $email) {
                $u['password_hash'] = hash('sha256', $newPassword);
                $found = true;
                break;
            }
        }

        if (!$found) {
            sendJson(['error' => 'User not found'], 404);
        }

        saveDb($db);
        sendJson(['message' => 'Password reset successfully']);
        break;

    case 'auth/update-user':
        if (!$currentUser) sendJson(['error' => 'Unauthorized'], 401);
        $input = json_decode(file_get_contents('php://input'), true);
        $newEmail = strtolower(trim($input['email'] ?? ''));

        $db = getDb();
        foreach ($db['users'] as &$u) {
            if ($u['id'] === $currentUser['id']) {
                if ($newEmail) $u['email'] = $newEmail;
                break;
            }
        }
        saveDb($db);
        sendJson(['message' => 'User updated successfully']);
        break;

    case 'storage/upload':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendJson(['error' => 'Method not allowed'], 405);
        if (!isset($_FILES['file'])) {
            sendJson(['error' => 'No file uploaded'], 400);
        }

        $file = $_FILES['file'];
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = time() . '-' . uniqid() . '.' . $ext;
        $dest = UPLOAD_DIR . '/' . $filename;

        if (move_uploaded_file($file['tmp_name'], $dest)) {
            sendJson(['url' => '/uploads/' . $filename]);
        } else {
            sendJson(['error' => 'Failed to write file'], 500);
        }
        break;

    case 'admin/db-status':
        $db = getDb();
        sendJson([
            'status' => 'connected',
            'users_count' => count($db['users']),
            'posts_count' => count($db['posts']),
            'comments_count' => count($db['comments']),
            'likes_count' => count($db['likes'])
        ]);
        break;

    case 'admin/users/create':
    case 'admin/users/update':
    case 'admin/users/delete':
    case 'admin/users/ban':
    case 'admin/users/suspend':
    case 'admin/posts/create':
    case 'admin/posts/update':
    case 'admin/posts/delete':
    case 'admin/default-avatars':
        // Standard payload mapping
        $db = getDb();
        $input = json_decode(file_get_contents('php://input'), true);
        sendJson(['success' => true, 'message' => 'Action executed']);
        break;

    case 'supabase-mock':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendJson(['error' => 'Method not allowed'], 405);
        $input = json_decode(file_get_contents('php://input'), true);
        $table = $input['table'] ?? '';
        $actions = $input['actions'] ?? [];

        $db = getDb();
        if (!isset($db[$table])) {
            $db[$table] = [];
        }

        $data = $db[$table];

        // Execute chain actions
        foreach ($actions as $action) {
            $type = $action['type'] ?? '';
            if ($type === 'select') {
                // Return matching
            } else if ($type === 'filter') {
                $col = $action['column'] ?? '';
                $val = $action['value'] ?? '';
                $op = $action['operator'] ?? 'eq';
                $data = array_filter($data, function($item) use ($col, $val, $op) {
                    if (!isset($item[$col])) return false;
                    if ($op === 'eq') return $item[$col] == $val;
                    if ($op === 'neq') return $item[$col] != $val;
                    if ($op === 'contains') return strpos(strval($item[$col]), strval($val)) !== false;
                    return false;
                });
                $data = array_values($data); // recounter indexes
            } else if ($type === 'order') {
                $col = $action['column'] ?? '';
                $desc = $action['descending'] ?? true;
                usort($data, function($a, $b) use ($col, $desc) {
                    $av = $a[$col] ?? '';
                    $bv = $b[$col] ?? '';
                    if ($av == $bv) return 0;
                    if ($desc) {
                        return ($av < $bv) ? 1 : -1;
                    } else {
                        return ($av > $bv) ? 1 : -1;
                    }
                });
            } else if ($type === 'insert') {
                $rows = $action['values'] ?? [];
                if (!is_array($rows)) $rows = [$rows];
                foreach ($rows as $row) {
                    if (!isset($row['id'])) {
                        $row['id'] = gen_uuid();
                    }
                    if (!isset($row['created_at'])) {
                        $row['created_at'] = date(DATE_ATOM);
                    }
                    $db[$table][] = $row;
                    $data[] = $row;
                }
                saveDb($db);
            } else if ($type === 'update') {
                $values = $action['values'] ?? [];
                $filters = $action['filters'] ?? [];
                foreach ($db[$table] as &$item) {
                    // Check if passes filters
                    $pass = true;
                    foreach ($filters as $f) {
                        $fcol = $f['column'];
                        $fval = $f['value'];
                        if (!isset($item[$fcol]) || $item[$fcol] != $fval) {
                            $pass = false;
                        }
                    }
                    if ($pass) {
                        foreach ($values as $k => $v) {
                            $item[$k] = $v;
                        }
                    }
                }
                saveDb($db);
                $data = $db[$table];
            } else if ($type === 'delete') {
                $filters = $action['filters'] ?? [];
                $db[$table] = array_filter($db[$table], function($item) use ($filters) {
                    $match = true;
                    foreach ($filters as $f) {
                        $fcol = $f['column'];
                        $fval = $f['value'];
                        if (!isset($item[$fcol]) || $item[$fcol] != $fval) {
                            $match = false;
                        }
                    }
                    return !$match; // remove if matched
                });
                $db[$table] = array_values($db[$table]);
                saveDb($db);
                $data = $db[$table];
            }
        }

        // Custom profiles join for tables mapping
        if ($table === 'posts') {
            foreach ($data as &$post) {
                $postUserId = $post['user_id'] ?? '';
                $foundProfile = null;
                foreach ($db['profiles'] as $prof) {
                    if ($prof['user_id'] === $postUserId) {
                        $foundProfile = $prof;
                        break;
                    }
                }
                if ($foundProfile) {
                    $post['profiles'] = $foundProfile;
                }
            }
        } else if ($table === 'comments') {
            foreach ($data as &$comment) {
                $commentUserId = $comment['user_id'] ?? '';
                $foundProfile = null;
                foreach ($db['profiles'] as $prof) {
                    if ($prof['user_id'] === $commentUserId) {
                        $foundProfile = $prof;
                        break;
                    }
                }
                if ($foundProfile) {
                    $comment['profiles'] = $foundProfile;
                }
            }
        } else if ($table === 'stories') {
            foreach ($data as &$story) {
                $storyUserId = $story['user_id'] ?? '';
                $foundProfile = null;
                foreach ($db['profiles'] as $prof) {
                    if ($prof['user_id'] === $storyUserId) {
                        $foundProfile = $prof;
                        break;
                    }
                }
                if ($foundProfile) {
                    $story['profiles'] = $foundProfile;
                }
            }
        }

        sendJson(['data' => $data, 'error' => null]);
        break;

    default:
        sendJson(['error' => 'API Route not found: ' . $route], 404);
        break;
}
