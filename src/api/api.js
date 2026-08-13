/**
 * PixelForge AI — API 客户端
 * 对接代理站 http://47.116.29.140/pf-api/
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://47.116.29.140/pf-api';
const TOKEN_KEY = '@pixelforge:token';

// ── Token 管理 ──────────────────────────────────────────────
export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ── 内部请求工具 ─────────────────────────────────────────────
async function request(path, options = {}) {
  const token = await getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['X-Token'] = token;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  return { data, status: res.status };
}

async function postJSON(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function get(path) {
  return request(path, { method: 'GET' });
}

function del(path) {
  return request(path, { method: 'DELETE' });
}

// ── 认证 ─────────────────────────────────────────────────────
export async function login(email, password) {
  const { data, status } = await postJSON('/login', { email, password });
  if (data.accessToken) { data.token = data.accessToken; await setToken(data.accessToken); }
  if (data.message && !data.error) data.error = data.message;
  return { data, status };
}

export async function logout() {
  await clearToken();
}

// ── 用户 ─────────────────────────────────────────────────────
export async function getProfile() {
  return get('/profile');
}

// ── 文生图 (JSON body) ───────────────────────────────────────
export async function generateImage({ prompt, negativePrompt = '', width = 1024, height = 1024 }) {
  return postJSON('/generate', { prompt, negativePrompt, width, height });
}

// ── 图生图 (multipart/form-data) ─────────────────────────────
export async function generateMultiImage({ prompt, imageUris, imageUri, negativePrompt = '', size, applyWatermark }) {
  const token = await getToken();
  const formData = new FormData();

  formData.append('prompt', prompt);
  if (negativePrompt) formData.append('negativePrompt', negativePrompt);
  if (size) formData.append('size', size);
  if (applyWatermark !== undefined) formData.append('applyWatermark', String(applyWatermark));

  // 支持多张图 imageUris 数组，也兼容单张 imageUri
  const uris = imageUris || (imageUri ? [imageUri] : []);
  for (let i = 0; i < uris.length; i++) {
    const img = uris[i];
    const uri = img.uri || img;
    const filename = (typeof uri === 'string' ? uri.split('/').pop() : 'photo.jpg') || 'photo.jpg';
    const ext = filename.split('.').pop().toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const name = img.name || (uris.length > 1 ? 'image' + (i + 1) + '.' + ext : filename);
    const type = img.type || mimeType;
    formData.append('image', { uri, name, type });
  }

  const headers = { 'Content-Type': 'multipart/form-data' };
  if (token) headers['X-Token'] = token;

  const res = await fetch(`${API_BASE}/multi-generate`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  return { data, status: res.status };
}

// ── 图生视频 (multipart/form-data) ───────────────────────────
export async function generateVideo({ prompt, imageUri }) {
  const token = await getToken();
  const formData = new FormData();

  // imageUri 可能是对象 {uri, type, name} 或字符串
  const uri = imageUri?.uri || imageUri;
  const filename = (typeof uri === 'string' ? uri.split('/').pop() : 'photo.jpg') || 'photo.jpg';
  const ext = filename.split('.').pop().toLowerCase();
  const mimeType = imageUri?.type || (ext === 'png' ? 'image/png' : 'image/jpeg');
  const name = imageUri?.name || filename;

  formData.append('prompt', prompt);
  formData.append('image', { uri, name, type: mimeType });

  const headers = { 'Content-Type': 'multipart/form-data' };
  if (token) headers['X-Token'] = token;

  const res = await fetch(`${API_BASE}/video-generate`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  return { data, status: res.status };
}

// ── 生成状态 ─────────────────────────────────────────────────
export async function getGenerationStatus(razId) {
  return get(`/status/${razId}`);
}

// ── 活跃任务 / 工作记录 ──────────────────────────────────────
export async function getActiveWork() {
  return get('/work-active');
}

export async function getWorkRecords() {
  return get('/work-records');
}

// ── 历史记录 ─────────────────────────────────────────────────
export async function getHistory() {
  return get('/history');
}

export async function deleteHistory(genId) {
  return del(`/history/${genId}`);
}

// ── 图片 URL 构造 ───────────────────────────────────────────
export function getImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE}/img/${path}`;
}

export function getVideoUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE}/video-file/${path}`;
}

export { API_BASE };
