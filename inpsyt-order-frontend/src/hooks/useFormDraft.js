import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';

// 작성 폼 임시저장(localStorage) 재사용 훅 — 세션 만료·새로고침·크래시 대비 마지막 안전망.
//
// 키 설계: draft:{type}:{userId}:{targetId|new}
//   예) draft:bulletin:<uuid>:new, draft:fieldReport:<uuid>:<eventId>
//   userId = useAuth().user.id → 다른 사용자 로그인 시 자동 격리(키가 달라 서로 안 보임).
// 보존: 24h(savedAt 동봉). 24h 초과 draft는 로드 시 무시·삭제.
// 자동저장: saveDraft(value) 호출 시 debounce 2초 후 기록.
//
// 반환:
//   draft        — 로드된 유효 draft 값(없으면 null). 복구 배너 노출 판단·이어쓰기 주입에 사용.
//   hasDraft     — 유효 draft 존재 여부(boolean).
//   savedLabel   — 마지막 자동저장 시각 "HH:MM"(없으면 ''). "임시저장됨 HH:MM" 인라인 표시용.
//   saveDraft(v) — 값 자동저장(debounce 2초). enabled=false면 no-op.
//   clearDraft() — draft 삭제 + 로컬 상태 비움(새로쓰기·저장 성공 시).
//   dismiss()    — 복구 배너만 닫음(draft는 보존 — 이어쓰기 주입 후 배너 숨김용).
//
// opts.enabled: false면 저장/로드 모두 비활성(폼 안 열렸을 때 불필요 동작 방지).

const PREFIX = 'draft:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 2000;

const buildKey = (type, userId, targetId) => `${PREFIX}${type}:${userId}:${targetId || 'new'}`;

const hhmm = (ts) => {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const readValid = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number') {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
};

export const useFormDraft = (type, targetId, opts = {}) => {
  const { user } = useAuth();
  const enabled = opts.enabled !== false && !!user?.id;
  const userId = user?.id || null;
  const key = userId ? buildKey(type, userId, targetId) : null;

  const [draft, setDraft] = useState(null);
  const [savedLabel, setSavedLabel] = useState('');
  const timerRef = useRef(null);

  // 마운트/활성화 시 유효 draft 1회 로드 (24h 초과·손상분은 readValid가 정리).
  useEffect(() => {
    if (!enabled || !key) { setDraft(null); setSavedLabel(''); return; }
    const valid = readValid(key);
    if (valid) {
      setDraft(valid.value);
      setSavedLabel(hhmm(valid.savedAt));
    } else {
      setDraft(null);
      setSavedLabel('');
    }
  }, [enabled, key]);

  // 언마운트 시 대기 중 debounce 정리(저장은 이미 직전 호출에서 예약됨).
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const saveDraft = useCallback((value) => {
    if (!enabled || !key) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const savedAt = Date.now();
      try {
        localStorage.setItem(key, JSON.stringify({ value, savedAt }));
        setSavedLabel(hhmm(savedAt));
      } catch { /* 용량 초과 등 — 임시저장은 보조수단이라 조용히 무시 */ }
    }, DEBOUNCE_MS);
  }, [enabled, key]);

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
    setDraft(null);
    setSavedLabel('');
  }, [key]);

  const dismiss = useCallback(() => { setDraft(null); }, []);

  return { draft, hasDraft: draft != null, savedLabel, saveDraft, clearDraft, dismiss };
};

export default useFormDraft;
