/**
 * PixelForge AI — API 客户端
 * 直接对接 razrai.com，绕过代理服务器
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── 配置 ────────────────────────────────────────────────────────
const RAZRAI_BASE = 'https://razrai.com';
const TOKEN_KEY = '@razrai:jwt';
const USER_KEY = '@razrai:user';

// 后端账号（用于调用 API，积分从这个账号扣）
const BACKEND_EMAIL = '1643143@qq.com';
const BACKEND_PASS = '1111qqqq';

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

// ── JWT 自动刷新 ─────────────────────────────────────────────────
// 解析 JWT 过期时间
function parseJWTExp(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.exp * 1000; // 转为毫秒
  } catch (e) {
    return 0;
  }
}

// 检查 JWT 是否即将过期（提前 5 分钟）
async function checkAndRefreshJWT() {
  const jwt = await getJWT();
  if (!jwt) return null;
  
  const exp = parseJWTExp(jwt);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  if (exp - now < fiveMinutes) {
    // JWT 即将过期，重新登录获取新 JWT
    console.log('[JWT] 即将过期，自动刷新...');
    return await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);
  }
  return jwt;
}

// ── 登录到 razrai.com ────────────────────────────────────────────
async function loginToRazrai(email, password) {
  try {
    const res = await fetch(`${RAZRAI_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Origin': 'https://razrai.com',
        'Referer': 'https://razrai.com/',
      },
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
  } catch (e) {
    console.error('[JWT] 登录失败:', e);
    throw e;
  }
}

// ── 通用请求函数（自动处理 JWT） ─────────────────────────────────
async function razraiRequest(path, options = {}) {
  // 先检查并刷新 JWT
  let jwt = await checkAndRefreshJWT();
  if (!jwt) {
    // 没有 JWT，自动登录
    jwt = await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);
  }
  
  const headers = {
    'Authorization': `Bearer ${jwt}`,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Origin': 'https://razrai.com',
    'Referer': 'https://razrai.com/',
    'Accept': 'application/json, text/plain, */*',
    ...(options.headers || {}),
  };
  
  let res = await fetch(`${RAZRAI_BASE}${path}`, { ...options, headers });
  
  // 如果返回 401，说明 JWT 已过期，重新登录重试
  if (res.status === 401) {
    console.log('[JWT] 收到 401，重新登录...');
    jwt = await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);
    headers['Authorization'] = `Bearer ${jwt}`;
    res = await fetch(`${RAZRAI_BASE}${path}`, { ...options, headers });
  }
  
  return res;
}

// ── 用户认证 ──────────────────────────────────────────────────────
export async function login(email, password) {
  // 使用后端账号登录
  const jwt = await loginToRazrai(BACKEND_EMAIL, BACKEND_PASS);
  const userData = await AsyncStorage.getItem(USER_KEY);
  return { 
    data: { 
      token: jwt, 
      user: userData ? JSON.parse(userData) : null 
    }, 
    status: 200 
  };
}

export async function register(email, password) {
  // razrai.com 不支持 APP 注册，直接用后端账号
  return await login(BACKEND_EMAIL, BACKEND_PASS);
}

export async function logout() {
  await clearJWT();
  await AsyncStorage.removeItem(USER_KEY);
}

// ── 用户信息 ─────────────────────────────────────────────────────
export async function getProfile() {
  const res = await razraiRequest('/api/user/profile');
  const data = await res.json();
  // 更新本地存储的积分
  if (data.points !== undefined) {
    const userData = await AsyncStorage.getItem(USER_KEY);
    if (userData) {
      const user = JSON.parse(userData);
      user.points = data.points;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }
  return { data, status: res.status };
}

// ── 文生图 ───────────────────────────────────────────────────────
export async function generateImage({ prompt, negativePrompt = 'blurry, watermark, low quality', width = 1080, height = 1920 }) {
  const res = await razraiRequest('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      negativePrompt,
      width,
      height,
      toolKey: 'tools:z-image',
      applyWatermark: false,
    }),
  });
  const data = await res.json();
  return { data, status: res.status };
}

// ── 图生图 ───────────────────────────────────────────────────────
export async function generateMultiImage({ prompt, imageUri, negativePrompt = 'blurry, watermark, low quality' }) {
  // razrai 的图生图需要先上传图片
  // 这里暂时返回错误
  console.log('[图生图] 需要上传图片，暂未实现');
  return { data: { error: '图生图功能暂未对接' }, status: 400 };
}

// ── 图生视频 ─────────────────────────────────────────────────────
export async function generateVideo({ prompt, imageUri }) {
  // razrai 的视频生成接口可能需要特殊处理
  console.log('[图生视频] 需要上传图片，暂未实现');
  return { data: { error: '图生视频功能暂未对接' }, status: 400 };
}

// ── 查询生成状态 ─────────────────────────────────────────────────
export async function getGenerationStatus(recordId) {
  const res = await razraiRequest(`/api/records/images/${recordId}`, {
    method: 'GET',
  });
  const data = await res.json();
  return { data, status: res.status };
}

// ── 历史记录 ─────────────────────────────────────────────────────
export async function getHistory() {
  // razrai 的用户记录接口
  const res = await razraiRequest('/api/records/images', {
    method: 'GET',
  });
  if (res.status === 200) {
    const data = await res.json();
    // 转换格式以适配原有 UI
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
  // razrai 没有提供删除接口
  return { data: { success: true }, status: 200 };
}

// ── 卡密兑换 ─────────────────────────────────────────────────────
export async function redeemCard(code) {
  // razrai 没有卡密兑换接口
  return { data: { error: '卡密兑换功能不可用，请前往 razrai.com 充值' }, status: 400 };
}

// ── 图片 URL ─────────────────────────────────────────────────────
export function getImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // 相对路径拼接完整 URL
  return `${RAZRAI_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function getVideoUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${RAZRAI_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export { RAZRAI_BASE, RAZRAI_BASE as API_BASE };
