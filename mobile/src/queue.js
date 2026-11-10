// Offline-first returns. Building sites have patchy coverage, so a return is first written to the
// phone (photos copied into app storage, not the volatile camera cache) and uploaded when a
// connection exists. The server is the judge of validity; a permanently rejected item is dropped
// with its error kept in `failed` so nothing disappears silently.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { api, buildReturnForm, ApiError } from './api';

const KEY = 'br_queue_v1';
const FAILED = 'br_queue_failed_v1';
const DIR = FileSystem.documentDirectory + 'queue/';
let flushing = false;
const listeners = new Set();

export const onQueueChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = async () => { const n = await queueSize(); listeners.forEach((f) => f(n)); };

async function read(key) { try { return JSON.parse((await AsyncStorage.getItem(key)) || '[]'); } catch (e) { return []; } }
export async function queueSize() { return (await read(KEY)).length; }

export async function enqueueReturn(item) {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const photos = [];
  for (let i = 0; i < item.photos.length; i++) {
    const dest = `${DIR}${Date.now()}-${i}.jpg`;
    await FileSystem.copyAsync({ from: item.photos[i].uri, to: dest });
    photos.push({ ...item.photos[i], uri: dest });
  }
  const q = await read(KEY);
  q.push({ ...item, photos, id: `${Date.now()}`, createdAt: new Date().toISOString() });
  await AsyncStorage.setItem(KEY, JSON.stringify(q));
  await notify();
}

export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    let q = await read(KEY);
    for (const item of [...q]) {
      try {
        await api.recordReturn(item.contractId, buildReturnForm(item));
        q = q.filter((x) => x.id !== item.id);
        item.photos.forEach((p) => FileSystem.deleteAsync(p.uri, { idempotent: true }));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'NETWORK') break; // still offline: try later
        if (e instanceof ApiError && e.status >= 500) break; // server trouble: try later
        const failed = await read(FAILED); // permanent rejection (e.g. contract already closed)
        failed.push({ ...item, error: e.code, failedAt: new Date().toISOString() });
        await AsyncStorage.setItem(FAILED, JSON.stringify(failed));
        q = q.filter((x) => x.id !== item.id);
      }
      await AsyncStorage.setItem(KEY, JSON.stringify(q));
    }
  } finally { flushing = false; await notify(); }
}
