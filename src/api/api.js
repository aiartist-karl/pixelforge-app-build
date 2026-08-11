/**
 * PixelForge AI — API 客户端
 * 直接对接 razrai.com
 * 三个功能：文生图 / 多图生图 / 图生视频
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── 配置 ────────────────────────────────────────────────────────
const RAZRAI_BASE = 'https://razrai.com';
const TOKEN_KEY = '@razrai:jwt';
const USER_KEY = '@razrai:user';

const BACKEND_EMAIL = '1643143@qq.com';
const BACKEND_PASS = '1111qqqq';

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'Origin': 'https://razrai.com',
  'Referer': 'https://razrai.com/',
  'Accept': 'application/json, text/plain, */*',
};

// ── Token 管理 ──────────────────────────────────────────────────
export async function getJWT() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setJWT(jwt) {
  await AsyncStorage.setItem(TOKEN_KEY, jwt);
}

export async function clearJWT() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ── JWT 解析 ────────────────────────────────────────────────────
function parseJWTExp(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.exp * 1000;
  } catch { return 0; }
}

// ── 登录 razrai ─────────────────────────────────────────────────
async function loginToRazrai(email, password) {
  const res = await fetch(`${RAZRAI_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...COMMON_HEADERS },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.accessToken) {
    await setJWT(data.accessToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify({
      email,
      userId: data.user?.id,
      points: data.user?.points,
      username: data.user?.username,
    }));
    return data.accessToken;
  }
  throw new Error(data.message || '登录失败');
}

// ── JWT 自动刷新 ────────────────────────────────────────────────
async function checkAndRefreshJWT() {
  const jwt = await getJWT();
  if (!jwt) return null;
  const exp = parseJWTExp(jwt);
  if (exp - Date.now() < 5 * 60 * 1000) {
    console.log('[JWT] 即将过期，自动刷新');
    return await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);
  }
  return jwt;
}

// ── 通用 JSON 请求 ──────────────────────────────────────────────
async function razraiJSON(path, method = 'GET', body = null) {
  let jwt = await checkAndRefreshJWT();
  if (!jwt) jwt = await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);

  const headers = { 'Authorization': `Bearer ${jwt}`, ...COMMON_HEADERS, 'Content-Type': 'application/json' };
  let res = await fetch(`${RAZRAI_BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : null,
  });

  if (res.status === 401) {
    jwt = await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);
    headers['Authorization'] = `Bearer ${jwt}`;
    res = await fetch(`${RAZRAI_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  }
  return { data: await res.json(), status: res.status };
}

// ── FormData 请求（用于图片/视频上传）────────────────────────────
async function razraiFormData(path, fields, files) {
  let jwt = await checkAndRefreshJWT();
  if (!jwt) jwt = await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);

  const formData = new FormData();

  // 文本字段
  for (const [key, val] of Object.entries(fields)) {
    formData.append(key, String(val));
  }

  // 文件字段 - files 格式: { fieldName: [{uri, type, name}, ...] }
  for (const [key, fileArr] of Object.entries(files)) {
    if (Array.isArray(fileArr)) {
      fileArr.forEach(f => formData.append(key, f));
    } else {
      formData.append(key, fileArr);
    }
  }

  const headers = {
    'Authorization': `Bearer ${jwt}`,
    ...COMMON_HEADERS,
    // React Native FormData 会自动设置 Content-Type 和 boundary
  };
  delete headers['Content-Type'];

  let res = await fetch(`${RAZRAI_BASE}${path}`, {
    method: 'POST', headers, body: formData,
  });

  if (res.status === 401) {
    jwt = await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);
    headers['Authorization'] = `Bearer ${jwt}`;
    res = await fetch(`${RAZRAI_BASE}${path}`, { method: 'POST', headers, body: formData });
  }

  const data = await res.json();
  return { data, status: res.status };
}

// ── 用户认证 ────────────────────────────────────────────────────
export async function login(email, password) {
  const jwt = await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);
  const userData = await AsyncStorage.getItem(USER_KEY);
  return { data: { token: jwt, user: userData ? JSON.parse(userData) : null }, status: 200 };
}

export async function register(email, password) {
  return await login(BACKEND_EMAIL, BACKEND_PASS);
}

export async function logout() {
  await clearJWT();
  await AsyncStorage.removeItem(USER_KEY);
}

// ── 用户信息 ────────────────────────────────────────────────────
export async function getProfile() {
  const { data, status } = await razraiJSON('/api/user/profile');
  if (data.points !== undefined) {
    const userData = await AsyncStorage.getItem(USER_KEY);
    if (userData) {
      const user = JSON.parse(userData);
      user.points = data.points;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }
  return { data, status };
}

// ════════════════════════════════════════════════════════════════
// 功能1: 文生图 — POST /api/image/generate (JSON)
// ════════════════════════════════════════════════════════════════
export async function generateImage({ prompt, negativePrompt = 'blurry, watermark, low quality', width = 1024, height = 1024 }) {
  return await razraiJSON('/api/image/generate', 'POST', {
    prompt,
    negativePrompt,
    width,
    height,
    toolKey: 'tools:z-image',
    applyWatermark: false,
  });
}

// ════════════════════════════════════════════════════════════════
// 功能2: 多图生图 — POST /tools/multi-image/generate (FormData)
// ════════════════════════════════════════════════════════════════
export async function generateMultiImage({ prompt, imageUris, size = '1024x1024', applyWatermark = false }) {
  // imageUris: 数组，每项 { uri, type, name }
  const fields = {
    prompt,
    size,
    applyWatermark: String(applyWatermark),
  };
  const files = {
    images: imageUris.map(uri => ({
      uri: uri.uri || uri,
      type: uri.type || 'image/jpeg',
      name: uri.name || `image_${Date.now()}.jpg`,
    })),
  };
  return await razraiFormData('/tools/multi-image/generate', fields, files);
}

// ════════════════════════════════════════════════════════════════
// 功能3: 图生视频 — POST /tools/i2v-video/generate (FormData)
// ════════════════════════════════════════════════════════════════
export async function generateVideo({ prompt, imageUri }) {
  const fields = {
    prompt,
    clientRequestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  };
  const files = {
    referenceImage: {
      uri: imageUri.uri || imageUri,
      type: imageUri.type || 'image/jpeg',
      name: imageUri.name || `ref_${Date.now()}.jpg`,
    },
  };
  return await razraiFormData('/tools/i2v-video/generate', fields, files);
}

// ── 查询图片生成状态 ────────────────────────────────────────────
export async function getGenerationStatus(recordId) {
  return await razraiJSON(`/api/records/images/${recordId}`, 'GET');
}

// ── 查询活跃任务（视频等）────────────────────────────────────────
export async function getActiveWork() {
  return await razraiJSON('/api/records/work/active', 'GET');
}

// ── 查询所有工作记录 ────────────────────────────────────────────
export async function getWorkRecords() {
  return await razraiJSON('/api/records/work', 'GET');
}

// ── 历史记录 ────────────────────────────────────────────────────
export async function getHistory() {
  const { data, status } = await razraiJSON('/api/records/images', 'GET');
  if (status === 200) {
    const records = (data.records || data || []).map(r => ({
      id: r.id,
      type: 't2i',
      prompt: r.prompt,
      status: r.metadata?.generationStatus || 'PENDING',
      result_url: r.imageUrl || '',
      created_at: r.createdAt,
    }));
    return { data: records, status: 200 };
  }
  return { data: [], status: 200 };
}

export async function deleteHistory(genId) {
  return { data: { success: true }, status: 200 };
}

// ── 卡密兑换 ────────────────────────────────────────────────────
export async function redeemCard(code) {
  return { data: { error: '卡密兑换功能不可用' }, status: 400 };
}

// ── URL 工具 ────────────────────────────────────────────────────
export function getImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${RAZRAI_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function getVideoUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${RAZRAI_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export { RAZRAI_BASE, RAZRAI_BASE as API_BASE };
