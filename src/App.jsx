import { useState, useCallback, useEffect, useRef, useMemo } from "react";

// ─── CONSTANTS ───
const STORAGE_KEY_DECKS = "rc_decks";
const STORAGE_KEY_STATS = "rc_stats";
const STORAGE_KEY_SETTINGS = "rc_settings";
const STORAGE_KEY_FOLDERS = "rc_folders";
const STORAGE_KEY_MIGRATED = "rc_migrated_v1";
const SWIPE_THRESHOLD = 60;
const CLOUD_BACKUP_MIN_INTERVAL_MS = 5 * 60 * 1000;
const STORAGE_KEY_PENDING = "rc_pending";

const DEFAULT_PENDING = {
  deletedDeckIds: [],
  metaDirty: false,
  dirtyDeckIds: [],
};

const DEFAULT_SETTINGS = {
  reappearR1: 0.33,
  reappearR2: 0.50,
  memoryReappear: true,
  theme: "dark",
  gasUrl: "",
};

const THEMES = {
  dark: {
    bg: "#08080a",
    surface: "#1c1c28",
    surfaceAlt: "#151520",
    border: "#2e2e40",
    borderLight: "#26263a",
    text: "#e4e2de",
    textSub: "#9490a0",
    textMuted: "#6b6877",
    textFaint: "#4a4656",
    cardBg: "#1c1c28",
    cardBgStack: "#171722",
    cardBorderStack: "#28283a",
    cardTextStack: "#6a6a80",
    inputBg: "#191922",
    accent: "#a855f7",
    accentLight: "rgba(168, 85, 247, 0.06)",
    accentBorder: "rgba(168, 85, 247, 0.15)",
    overlay: "rgba(0, 0, 0, 0.7)",
    divider: "#2a2835",
    highlightText: "#e9b5ff",
  },
  light: {
    bg: "#f5f5f7",
    surface: "#ffffff",
    surfaceAlt: "#f0f0f4",
    border: "#e0e0e6",
    borderLight: "#d8d8e0",
    text: "#1a1a2e",
    textSub: "#5a5a6e",
    textMuted: "#8888a0",
    textFaint: "#b0b0c0",
    cardBg: "#ffffff",
    cardBgStack: "#eeeef2",
    cardBorderStack: "#d8d8e0",
    cardTextStack: "#b0b0c0",
    inputBg: "#f0f0f4",
    accent: "#7c3aed",
    accentLight: "rgba(124, 58, 237, 0.06)",
    accentBorder: "rgba(124, 58, 237, 0.15)",
    overlay: "rgba(0, 0, 0, 0.4)",
    divider: "#e0e0e6",
    highlightText: "#7c3aed",
  },
};

const SAMPLE_WORDS = [
  { id: "s1", word: "procurement", meaning: "調達、取得", example_en: "The procurement of raw materials was delayed.", example_ja: "原材料の調達が遅れた。", note: "動詞 procure（調達する）の名詞形。TOEICでは購買部門の話題で頻出。" },
  { id: "s2", word: "comply", meaning: "従う、準拠する", example_en: "All branches must comply with the new regulations.", example_ja: "全支店が新しい規制に従わなければならない。", note: "comply with ～ の形で使う。名詞形は compliance（遵守）。" },
  { id: "s3", word: "subsequent", meaning: "その後の、続いて起こる", example_en: "The subsequent investigation revealed additional problems.", example_ja: "その後の調査で追加の問題が明らかになった。", note: "subsequent to ～ で「～の後に」。類義語: following, ensuing" },
  { id: "s4", word: "tentative", meaning: "暫定的な、仮の", example_en: "We reached a tentative agreement on pricing.", example_ja: "価格について暫定的な合意に達した。", note: "tentative schedule（仮のスケジュール）はビジネスメールの定番表現。" },
  { id: "s5", word: "initiative", meaning: "主導権、新たな取り組み", example_en: "The CEO announced a bold new initiative to reduce costs.", example_ja: "CEOはコスト削減に向けた大胆な新たな取り組みを発表した。", note: "take the initiative（率先して行動する）も重要表現。" },
  { id: "s6", word: "proficiency", meaning: "熟達、習熟度", example_en: "Candidates must demonstrate proficiency in data analysis.", example_ja: "候補者はデータ分析の習熟度を示さなければならない。", note: "形容詞 proficient（堪能な）。proficiency in ～ の形で使う。" },
  { id: "s7", word: "revision", meaning: "修正、改訂", example_en: "The contract is currently under revision.", example_ja: "契約書は現在改訂中である。", note: "under revision（改訂中）はTOEIC頻出。動詞形は revise。" },
  { id: "s8", word: "substantial", meaning: "相当な、かなりの", example_en: "There has been a substantial improvement in sales figures.", example_ja: "売上高に相当な改善があった。", note: "significantly / considerably とほぼ同義。副詞形は substantially。" },
  { id: "s9", word: "compensation", meaning: "報酬、補償", example_en: "The compensation package includes stock options.", example_ja: "報酬パッケージにはストックオプションが含まれる。", note: "compensate for ～（～を補償する）。給与だけでなく福利厚生を含む包括的な報酬を指すことが多い。" },
  { id: "s10", word: "expedite", meaning: "促進する、迅速に処理する", example_en: "Please expedite the delivery of the replacement parts.", example_ja: "交換部品の配送を迅速に処理してください。", note: "フォーマルな表現。カジュアルには speed up。名詞形はexpedition（遠征）とは別義。" },
  { id: "s11", word: "allocate", meaning: "割り当てる、配分する", example_en: "Funds were allocated to each department equally.", example_ja: "資金は各部署に均等に配分された。", note: "allocate A to B（AをBに割り当てる）。名詞形は allocation。予算・資源の文脈で頻出。" },
  { id: "s12", word: "adverse", meaning: "不利な、悪影響の", example_en: "Adverse weather conditions caused the event to be postponed.", example_ja: "悪天候のためイベントが延期された。", note: "adverse effect（悪影響）が最も一般的なコロケーション。averse（嫌がる）と混同注意。" },
];

// ─── UTILS ───
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function loadFromStorage(key, fallback) {
  try {
    const raw = window.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key, data) {
  try { window.localStorage?.setItem(key, JSON.stringify(data)); } catch {}
}

function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}


// GAS 汎用 POST ヘルパー
async function fetchJson(url, payload, signal) {
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    signal,
  });
  const text = await res.text();
  const parsed = extractJson(text);
  if (!parsed || !parsed.ok) throw new Error(parsed?.error || "request failed");
  return parsed;
}

// 記憶度スコアを計算（コンポーネント外のpure関数）
function computeMemoryScore(stats, w) {
  const key = typeof w === "object" ? statsKey(w) : w;
  const st = stats[key];
  if (!st || !st.log || st.log.length === 0) return 0;
  const log = st.log.slice(-100);

  const getIntervalDecay = (hours) => {
    if (hours < 1) return 0.6;
    if (hours < 3) return 0.7;
    if (hours < 6) return 0.8;
    if (hours < 12) return 0.9;
    if (hours < 24) return 0.95;
    return 1.0;
  };

  let prevSessionEndTime = null;
  let currentSid = null;
  let currentTimeDecay = 1.0;
  const timeDecays = new Array(log.length);

  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    const entryTime = new Date(entry.date).getTime();
    const sid = entry.sid || `legacy_${i}`;

    if (sid !== currentSid) {
      if (currentSid !== null) {
        prevSessionEndTime = new Date(log[i - 1].date).getTime();
      }
      if (prevSessionEndTime !== null) {
        const gapHours = (entryTime - prevSessionEndTime) / 3600000;
        currentTimeDecay = getIntervalDecay(gapHours);
      } else {
        currentTimeDecay = 1.0;
      }
      currentSid = sid;
    }
    timeDecays[i] = currentTimeDecay;
  }

  let accuracySum = 0;
  let peekSum = 0;
  let totalWeight = 0.5;

  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    const rd = entry.round || 1;
    const roundDecay = 1 / rd;
    const timeDecay = timeDecays[i];
    const weight = roundDecay * timeDecay;

    totalWeight += weight;
    if (entry.correct) {
      accuracySum += weight;
      if (!entry.peeked) {
        peekSum += weight;
      }
    }
  }

  if (totalWeight === 0) return 0;
  const accuracy = accuracySum / totalWeight;
  const peekRatio = peekSum / totalWeight;
  return accuracy * 0.6 + peekRatio * 0.4;
}

function parseCSV(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Detect header
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("word") || first.includes("meaning");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map(line => {
    // Support tab, comma (with possible quotes)
    let parts;
    if (line.includes("\t")) {
      parts = line.split("\t").map(s => s.trim());
    } else {
      // CSV with possible quotes
      parts = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { parts.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      parts.push(current.trim());
    }
    if (parts.length >= 5) {
      return { id: genId(), word: parts[0], meaning: parts[1], example_en: parts[2], example_ja: parts[3], note: parts[4] };
    } else if (parts.length >= 4) {
      return { id: genId(), word: parts[0], meaning: parts[1], example_en: parts[2], example_ja: parts[3], note: "" };
    } else if (parts.length >= 2) {
      return { id: genId(), word: parts[0], meaning: parts[1], example_en: "", example_ja: "", note: "" };
    }
    return null;
  }).filter(Boolean);
}

function highlightWord(sentence, word) {
  if (!sentence || !word) return sentence;
  // Case-insensitive match, also match common inflections
  const base = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${base}\\w{0,5})`, "gi");
  const parts = sentence.split(regex);
  return parts;
}

// Stats key: use id if available, fallback to word for backward compatibility
function statsKey(w) { return w.id || w.word; }

function getWordStats(stats, w) {
  const key = typeof w === "string" ? w : statsKey(w);
  return stats[key] || { seen: 0, correct: 0, correctWithoutPeek: 0, log: [] };
}

function getLastStudied(stats, w) {
  const st = getWordStats(stats, w);
  if (!st.log || st.log.length === 0) return null;
  return st.log[st.log.length - 1].date;
}

function formatRelativeDate(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}週間前`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

// ─── MAIN COMPONENT ───
export default function RapidCycleApp() {
  const [view, setView] = useState("home"); // home | folder | detail | import | study | result | settings | crossSetup
  const [decks, setDecks] = useState(() => loadFromStorage(STORAGE_KEY_DECKS, []));
  const [stats, setStats] = useState(() => loadFromStorage(STORAGE_KEY_STATS, {}));

  // Migration: add IDs to words that don't have them, and migrate stats keys
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // 冪等性のため: フラグが立っていたらスキップ（初回マウントのみ実行）
    if (loadFromStorage(STORAGE_KEY_MIGRATED, false)) return;

    let needsDeckUpdate = false;
    const newDecks = decks.map(deck => {
      const newWords = deck.words.map(w => {
        if (w.id) return w;
        needsDeckUpdate = true;
        return { ...w, id: genId() };
      });
      return { ...deck, words: newWords };
    });
    if (needsDeckUpdate) {
      // Also migrate stats: copy word-keyed entries to id-keyed entries
      const newStats = { ...stats };
      for (const deck of newDecks) {
        for (const w of deck.words) {
          if (newStats[w.word] && !newStats[w.id]) {
            newStats[w.id] = newStats[w.word];
          }
        }
      }
      setDecks(newDecks);
      setStats(newStats);
    }

    saveToStorage(STORAGE_KEY_MIGRATED, true);
  }, []); // 意図的に空（初回マウントのみ、フラグで冪等性を保証）
  const [settings, setSettings] = useState(() => loadFromStorage(STORAGE_KEY_SETTINGS, DEFAULT_SETTINGS));
  const t = THEMES[settings.theme || "dark"];
  const s = useMemo(() => makeStyles(t), [t]);
  const [folders, setFolders] = useState(() => loadFromStorage(STORAGE_KEY_FOLDERS, []));
  const [activeDeck, setActiveDeck] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [studySourceLabel, setStudySourceLabel] = useState("");

  // 単語→所属デッキIDの逆引きマップ（decks変更時のみ再構築）
  const wordToDeckMap = useMemo(() => {
    const m = new Map();
    for (const d of decks) {
      for (const w of d.words) {
        m.set(statsKey(w), d.id);
      }
    }
    return m;
  }, [decks]);

  // 学習セッションで触れたデッキIDの集合（P2で使用開始、P1では初期化のみ）
  const [touchedDeckIds, setTouchedDeckIds] = useState(() => new Set());

  // activeDeck内の単語についてスコアを事前計算
  const memoryScoresMap = useMemo(() => {
    if (!activeDeck) return new Map();
    const m = new Map();
    for (const w of activeDeck.words) {
      m.set(statsKey(w), computeMemoryScore(stats, w));
    }
    return m;
  }, [activeDeck, stats]);

  // Study state
  const [cards, setCards] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [flipDirection, setFlipDirection] = useState("right"); // "right" | "left" — controls rotation direction
  const [round, setRound] = useState(1);
  const [roundUnknown, setRoundUnknown] = useState([]);
  const [prevRoundKnown, setPrevRoundKnown] = useState([]);
  const [waitingForTap, setWaitingForTap] = useState(false);
  const [pendingResult, setPendingResult] = useState(null);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState(null);
  const [swipeStartY, setSwipeStartY] = useState(null);
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState(null);
  const [animatingCards, setAnimatingCards] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const animIdRef = useRef(0);
  const sessionIdRef = useRef("");

  // デバウンス発火時に最新 decks を参照するための Ref
  const decksRef = useRef(decks);
  useEffect(() => { decksRef.current = decks; }, [decks]);

  // デッキごとの編集デバウンスタイマー
  const deckSyncTimersRef = useRef(new Map());

  // タイマー/RAFのクリーンアップ管理
  const timersRef = useRef(new Set());
  const rafsRef = useRef(new Set());

  const scheduleTimeout = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, delay);
    timersRef.current.add(id);
    return id;
  }, []);

  const scheduleRAF = useCallback((fn) => {
    const id = requestAnimationFrame(() => {
      rafsRef.current.delete(id);
      fn();
    });
    rafsRef.current.add(id);
    return id;
  }, []);

  // アンマウント時に全タイマー/RAFをクリーンアップ
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
      rafsRef.current.forEach(cancelAnimationFrame);
      rafsRef.current.clear();
    };
  }, []);

  // Import state
  const [importText, setImportText] = useState("");
  const [deckName, setDeckName] = useState("");
  const fileInputRef = useRef(null);

  // Detail / edit state
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState({ word: "", meaning: "", example_en: "", example_ja: "", note: "" });
  const [detailFilter, setDetailFilter] = useState("all");
  const [isRenamingDeck, setIsRenamingDeck] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(null);
  const [previewFlipped, setPreviewFlipped] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [crossFilter, setCrossFilter] = useState("all");
  const [crossCount, setCrossCount] = useState(50);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: "deck"|"folder"|"word"|"stats"|"restore", id?, idx?, name }
  const [backupStatus, setBackupStatus] = useState("");

  // pending リスト（P3で本格的に使用。P1ではstate定義のみ）
  const [pending, setPending] = useState(() => loadFromStorage(STORAGE_KEY_PENDING, DEFAULT_PENDING));

  // Persist
  useEffect(() => { saveToStorage(STORAGE_KEY_DECKS, decks); }, [decks]);
  useEffect(() => { saveToStorage(STORAGE_KEY_STATS, stats); }, [stats]);
  useEffect(() => { saveToStorage(STORAGE_KEY_SETTINGS, settings); }, [settings]);
  useEffect(() => { saveToStorage(STORAGE_KEY_FOLDERS, folders); }, [folders]);
  useEffect(() => { saveToStorage(STORAGE_KEY_PENDING, pending); }, [pending]);

  // Cloud backup/restore
  const [cloudStatus, setCloudStatus] = useState(""); // "" | "saving" | "saved" | "restoring" | "restored" | "error"
  const autoRestoredRef = useRef(false);
  const cloudAbortRef = useRef(null); // クラウド通信の重複防止
  const lastAutoBackupAtRef = useRef(0);

  // デッキ1つ分の送信ペイロードを組み立てる
  const buildDeckPayload = useCallback((deck) => {
    const deckStats = {};
    for (const word of deck.words) {
      const key = statsKey(word);
      if (stats[key]) {
        deckStats[key] = stats[key];
      }
    }
    return { v: 2, deck: { ...deck }, stats: deckStats };
  }, [stats]);

  // 1つのデッキをクラウドに送信
  const syncDeck = useCallback(async (deck, signal) => {
    const url = settings.gasUrl;
    if (!url) throw new Error("no url");
    return fetchJson(url, { action: "updateDeck", data: buildDeckPayload(deck) }, signal);
  }, [settings.gasUrl, buildDeckPayload]);

  // meta.json を更新
  const syncMeta = useCallback(async (signal) => {
    const url = settings.gasUrl;
    if (!url) throw new Error("no url");
    return fetchJson(url, {
      action: "updateMeta",
      data: { v: 2, updatedAt: new Date().toISOString(), folders },
    }, signal);
  }, [settings.gasUrl, folders]);

  // デッキファイルをクラウドから削除（P3で使用開始、P1では定義のみ）
  const deleteDeckFromCloud = useCallback(async (deckId, signal) => {
    const url = settings.gasUrl;
    if (!url) throw new Error("no url");
    return fetchJson(url, { action: "deleteDeck", deckId }, signal);
  }, [settings.gasUrl]);

  const runCloudBackup = useCallback(async (opts = {}) => {
    const url = settings.gasUrl;
    if (!url) return false;

    if (cloudAbortRef.current) cloudAbortRef.current.abort();
    const controller = new AbortController();
    cloudAbortRef.current = controller;

    if (opts.silent !== true) setCloudStatus("saving");
    try {
      // 全デッキを順次送信
      for (const deck of decks) {
        if (controller.signal.aborted) return false;
        await syncDeck(deck, controller.signal);
      }
      // meta.json を送信
      if (!controller.signal.aborted) {
        await syncMeta(controller.signal);
      }
      if (opts.silent !== true) {
        setCloudStatus("saved");
        scheduleTimeout(() => setCloudStatus(""), 3000);
      }
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return false;
      if (opts.silent !== true) {
        setCloudStatus("error");
        scheduleTimeout(() => setCloudStatus(""), 3000);
      }
      return false;
    }
  }, [settings.gasUrl, decks, syncDeck, syncMeta, scheduleTimeout]);

  const runCloudRestore = useCallback(async (opts = {}) => {
    const url = settings.gasUrl;
    if (!url) return false;

    if (cloudAbortRef.current) cloudAbortRef.current.abort();
    const controller = new AbortController();
    cloudAbortRef.current = controller;

    if (opts.silent !== true) setCloudStatus("restoring");
    try {
      // 1. meta.json 取得
      const metaRes = await fetchJson(url, { action: "getMeta" }, controller.signal);
      const meta = metaRes.data;

      // 2. デッキ一覧取得
      const listRes = await fetchJson(url, { action: "listDecks" }, controller.signal);
      const deckIds = listRes.deckIds || [];

      // 3. 各デッキを順次取得
      const fetchedDecks = [];
      const fetchedStats = {};
      for (const deckId of deckIds) {
        if (controller.signal.aborted) return false;
        const deckRes = await fetchJson(url, { action: "getDeck", deckId }, controller.signal);
        if (deckRes.data) {
          fetchedDecks.push(deckRes.data.deck);
          Object.assign(fetchedStats, deckRes.data.stats);
        }
      }

      // 4. ローカル上書き（P1では単純適用。P5でトランザクション化）
      setDecks(fetchedDecks);
      setStats(fetchedStats);
      if (meta && meta.folders) setFolders(meta.folders);

      if (opts.silent !== true) {
        setCloudStatus("restored");
        scheduleTimeout(() => setCloudStatus(""), 3000);
      }
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return false;
      if (opts.silent !== true) {
        setCloudStatus("error");
        scheduleTimeout(() => setCloudStatus(""), 3000);
      }
      return false;
    }
  }, [settings.gasUrl, scheduleTimeout]);

  // Auto-restore on startup: if gasUrl is set and local data is empty
  useEffect(() => {
    if (autoRestoredRef.current) return;
    if (!settings.gasUrl) return;
    if (decks.length > 0 || folders.length > 0 || Object.keys(stats).length > 0) return;
    autoRestoredRef.current = true;
    runCloudRestore({ silent: true });
  }, [settings.gasUrl, decks.length, folders.length, stats, runCloudRestore]);

  // touchedDeckIds に含まれるデッキだけを差分同期
  const syncTouchedDecks = useCallback(async () => {
    if (!settings.gasUrl) return;
    if (touchedDeckIds.size === 0) return;

    if (cloudAbortRef.current) cloudAbortRef.current.abort();
    const controller = new AbortController();
    cloudAbortRef.current = controller;

    try {
      for (const deckId of touchedDeckIds) {
        if (controller.signal.aborted) return;
        const deck = decks.find(d => d.id === deckId);
        if (!deck) continue;
        await syncDeck(deck, controller.signal);
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
      console.warn("syncTouchedDecks failed", err);
    }
  }, [settings.gasUrl, touchedDeckIds, decks, syncDeck]);

  // 学習終了時: 触れたデッキだけ差分同期（5分デバウンス）
  useEffect(() => {
    if (view !== "result") return;
    if (!settings.gasUrl) return;
    if (touchedDeckIds.size === 0) return;
    const now = Date.now();
    if (now - lastAutoBackupAtRef.current < CLOUD_BACKUP_MIN_INTERVAL_MS) return;
    lastAutoBackupAtRef.current = now;
    syncTouchedDecks();
  }, [view, settings.gasUrl, touchedDeckIds]);

  // 指定デッキの同期を3秒後にスケジュール。連続呼び出しはタイマーリセット
  const scheduleDeckSync = useCallback((deck) => {
    if (!settings.gasUrl) return;

    const existing = deckSyncTimersRef.current.get(deck.id);
    if (existing !== undefined) {
      clearTimeout(existing);
      deckSyncTimersRef.current.delete(deck.id);
    }

    const tid = scheduleTimeout(() => {
      deckSyncTimersRef.current.delete(deck.id);
      const latestDeck = decksRef.current.find(d => d.id === deck.id);
      if (!latestDeck) return;
      const controller = new AbortController();
      syncDeck(latestDeck, controller.signal).catch(err => {
        if (err && err.name === "AbortError") return;
        console.warn("scheduled syncDeck failed", err);
      });
    }, 3000);

    deckSyncTimersRef.current.set(deck.id, tid);
  }, [settings.gasUrl, syncDeck, scheduleTimeout]);

  const currentCard = cards[currentIdx];

  // ─── DECK MANAGEMENT ───
  const saveDeck = (name, words, folderId = null) => {
    const id = Date.now().toString(36);
    const newDeck = { id, name, words, createdAt: Date.now(), folderId };
    setDecks(prev => [newDeck, ...prev]);
    return newDeck;
  };

  const deleteDeck = (id) => {
    setDecks(prev => prev.filter(d => d.id !== id));
  };

  // ─── FOLDER MANAGEMENT ───
  const createFolder = (name) => {
    const id = Date.now().toString(36) + "f";
    const folder = { id, name };
    setFolders(prev => [...prev, folder]);
    return folder;
  };

  const deleteFolder = (id) => {
    setDecks(prev => prev.map(d => d.folderId === id ? { ...d, folderId: null } : d));
    setFolders(prev => prev.filter(f => f.id !== id));
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "deck") {
      deleteDeck(deleteConfirm.id);
      if (activeDeck && activeDeck.id === deleteConfirm.id) setView("home");
    } else if (deleteConfirm.type === "folder") {
      deleteFolder(deleteConfirm.id);
      if (activeFolder && activeFolder.id === deleteConfirm.id) setView("home");
    } else if (deleteConfirm.type === "word") {
      const words = activeDeck.words.filter((_, i) => i !== deleteConfirm.idx);
      updateDeckWords(activeDeck.id, words);
      setEditingIdx(null);
    } else if (deleteConfirm.type === "stats") {
      setStats({});
    } else if (deleteConfirm.type === "restore") {
      runCloudRestore();
    }
    setDeleteConfirm(null);
  };

  const toggleFolderCollapse = (folderId) => {
    setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const moveDeckToFolder = (deckId, folderId) => {
    setDecks(prev => prev.map(d => d.id === deckId ? { ...d, folderId } : d));
  };

  const getDecksInFolder = (folderId) => decks.filter(d => d.folderId === folderId);
  const getUnfiledDecks = () => decks.filter(d => !d.folderId);

  const getMemoryLevelForWord = (w) => {
    const key = typeof w === "object" ? statsKey(w) : w;
    const st = stats[key];
    if (!st || st.seen === 0) return 0;
    const score = getMemoryScore(w);
    if (score >= 0.85) return 3;
    if (score >= 0.55) return 2;
    return 1;
  };

  // Cross-study: gather words from multiple decks, apply filter & count
  const startCrossStudy = (sourcDecks, filter, count, label) => {
    let allWords = sourcDecks.flatMap(d => d.words);
    if (filter !== "all") {
      const level = parseInt(filter);
      allWords = allWords.filter(w => getMemoryLevelForWord(w) === level);
    }
    // Deduplicate by id (or word for backward compat)
    const seen = new Set();
    allWords = allWords.filter(w => {
      const k = statsKey(w);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const selected = shuffle(allWords).slice(0, count);
    if (selected.length === 0) return;
    const tempDeck = { id: "__cross__", name: label, words: selected };
    setActiveDeck(tempDeck);
    setStudySourceLabel(label);
    const shuffled = shuffle(selected);
    setCards(shuffled);
    setCurrentIdx(0);
    setFlipped(false);
    setFlipDirection("right");
    setRound(1);
    setRoundUnknown([]);
    setPrevRoundKnown([]);
    setWaitingForTap(false);
    setPendingResult(null);
    setSwipeX(0);
    setAnimatingCards([]);
    setSessionTotal(0);
    setTouchedDeckIds(new Set());
    sessionIdRef.current = genId();
    setView("study");
  };

  // ─── MEMORY HELPERS ───
  const getMemoryScore = (w) => {
    const key = typeof w === "object" ? statsKey(w) : w;
    // activeDeck内の単語はMapからO(1)で取得、それ以外（横断学習等）はフォールバック
    const cached = memoryScoresMap.get(key);
    if (cached !== undefined) return cached;
    return computeMemoryScore(stats, w);
  };

  // Returns a reappear multiplier based on memory score
  // Low memory → higher chance to reappear, high memory → lower chance
  const getMemoryReappearMultiplier = (w) => {
    if (!settings.memoryReappear) return 1;
    const score = getMemoryScore(w);
    if (score >= 0.85) return 0.3;  // 定着: ほとんど再登場しない
    if (score >= 0.55) return 0.7;  // あと少し: やや減らす
    if (score > 0) return 1.3;      // 要復習: 多めに再登場
    return 1;                        // 未学習: ベースレートのまま
  };

  // ─── STUDY LOGIC ───
  const startStudy = (deck) => {
    setActiveDeck(deck);
    const shuffled = shuffle(deck.words);
    setCards(shuffled);
    setCurrentIdx(0);
    setFlipped(false);
    setFlipDirection("right");
    setRound(1);
    setRoundUnknown([]);
    setPrevRoundKnown([]);
    setWaitingForTap(false);
    setPendingResult(null);
    setSwipeX(0);
    setAnimatingCards([]);
    setSessionTotal(0);
    setTouchedDeckIds(new Set());
    sessionIdRef.current = genId();
    setView("study");
  };

  const recordResult = (card, correct, peeked) => {
    const key = statsKey(card);
    const now = new Date().toISOString();
    setStats(prev => {
      const old = prev[key] || { seen: 0, correct: 0, correctWithoutPeek: 0, log: [] };
      const log = [...(old.log || []), { date: now, correct, peeked, round, sid: sessionIdRef.current }].slice(-100);
      return {
        ...prev,
        [key]: {
          seen: old.seen + 1,
          correct: old.correct + (correct ? 1 : 0),
          correctWithoutPeek: old.correctWithoutPeek + (correct && !peeked ? 1 : 0),
          log,
        }
      };
    });
    setSessionTotal(prev => prev + 1);

    // 学習した単語の所属デッキを記録（横断学習対応）
    const deckId = wordToDeckMap.get(key);
    if (deckId) {
      setTouchedDeckIds(prev => {
        if (prev.has(deckId)) return prev;
        const next = new Set(prev);
        next.add(deckId);
        return next;
      });
    }
  };

  // Dismiss with trajectory based on swipe end position and velocity
  const dismissCard = (direction, correct, card, swipeEndX, swipeEndY) => {
    const wasFlipped = flipped;
    const id = ++animIdRef.current;

    // Record result at dismiss time (single source of truth)
    // peeked = true if user saw the answer before deciding (tapped to flip, then swiped)
    // peeked = false if user swiped before seeing the answer (first swipe = blind decision)
    const peeked = !waitingForTap;
    recordResult(card, correct, peeked);
    if (!correct) {
      setRoundUnknown(prev => [...prev, card]);
    }

    // Calculate exit trajectory from swipe position
    const exitX = direction === "right" ? 500 : -500;
    const exitY = swipeEndY ? (swipeEndY / (Math.abs(swipeEndX) || 1)) * Math.abs(exitX) * 0.3 : 0;
    const exitRotate = direction === "right" ? 15 : -15;

    setAnimatingCards(prev => [...prev, { id, card, wasFlipped, startX: swipeEndX || 0, startY: swipeEndY || 0, exitX, exitY, exitRotate, phase: "start" }]);

    // Phase 2: trigger exit on next frame
    scheduleRAF(() => {
      scheduleRAF(() => {
        setAnimatingCards(prev => prev.map(a => a.id === id ? { ...a, phase: "exit" } : a));
      });
    });

    scheduleTimeout(() => {
      setAnimatingCards(prev => prev.filter(a => a.id !== id));
    }, 1100);

    // Immediately advance
    setFlipped(false);
    setFlipDirection("right");
    setWaitingForTap(false);
    setPendingResult(null);
    setSwipeX(0);

    if (currentIdx + 1 < cards.length) {
      setCurrentIdx(prev => prev + 1);
    } else {
      const currentRoundKnown = cards.filter(c => !roundUnknown.includes(c) && c !== card);
      const allKnown = correct ? [...currentRoundKnown, card] : currentRoundKnown;
      const allUnknown = correct ? [...roundUnknown] : [...roundUnknown, card];

      const baseRate = round === 1 ? settings.reappearR1 : settings.reappearR2;
      const reappear = allKnown.filter(c => {
        const rate = Math.min(baseRate * getMemoryReappearMultiplier(c), 1);
        return Math.random() < rate;
      });
      const nextCards = [...allUnknown, ...reappear];

      if (nextCards.length <= 2) {
        setView("result");
      } else {
        setPrevRoundKnown(allKnown);
        setCards(shuffle(nextCards));
        setCurrentIdx(0);
        setRoundUnknown([]);
        setRound(r => r + 1);
      }
    }
  };

  const handleTap = () => {
    if (waitingForTap) {
      const dir = pendingResult === "correct" ? "right" : "left";
      dismissCard(dir, pendingResult === "correct", currentCard, 0, 0);
    } else if (!flipped) {
      setFlipped(true);
      setFlipDirection("right");
    }
  };

  // ─── TOUCH HANDLERS ───
  const [swipeY, setSwipeY] = useState(0);

  const onTouchStart = (e) => {
    const touch = e.touches[0];
    setSwipeStartX(touch.clientX);
    setSwipeStartY(touch.clientY);
    setIsHorizontalSwipe(null);
    setSwipeY(0);
  };

  const onTouchMove = (e) => {
    if (swipeStartX === null) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeStartX;
    const dy = touch.clientY - swipeStartY;

    if (isHorizontalSwipe === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        const horizontal = Math.abs(dx) > Math.abs(dy);
        setIsHorizontalSwipe(horizontal);
        if (!horizontal) return;
      } else {
        return;
      }
    }

    if (!isHorizontalSwipe) return;
    e.preventDefault();
    setSwipeX(dx);
    setSwipeY(dy);
  };

  const onTouchEnd = () => {
    if (isHorizontalSwipe && Math.abs(swipeX) > SWIPE_THRESHOLD) {
      const isCorrect = swipeX > 0;

      if (waitingForTap) {
        dismissCard(isCorrect ? "right" : "left", isCorrect, currentCard, swipeX, swipeY);
      } else if (flipped) {
        dismissCard(isCorrect ? "right" : "left", isCorrect, currentCard, swipeX, swipeY);
      } else {
        setFlipDirection(isCorrect ? "right" : "left");
        setFlipped(true);
        setWaitingForTap(true);
        setPendingResult(isCorrect ? "correct" : "incorrect");
      }
    }

    setSwipeX(0);
    setSwipeY(0);
    setSwipeStartX(null);
    setSwipeStartY(null);
    setIsHorizontalSwipe(null);
  };

  // ─── IMPORT HANDLERS ───
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target.result);
      if (!deckName) setDeckName(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const words = parseCSV(importText);
    if (words.length === 0) return;
    const name = deckName.trim() || `単語帳 ${decks.length + 1}`;
    const folderId = activeFolder ? activeFolder.id : null;
    saveDeck(name, words, folderId);
    setImportText("");
    setDeckName("");
    setView("home");
  };

  // ─── RENDER ───

  // Swipe visual feedback
  const swipeOpacity = Math.min(Math.abs(swipeX) / 120, 1);
  const swipeRotate = (swipeX / 800) * 8;

  // ── HOME ──
  if (view === "home") {
    const unfiledDecks = getUnfiledDecks();
    const totalWords = decks.reduce((sum, d) => sum + d.words.length, 0);

    const renderDeckItem = (deck) => {
      const wc = deck.words.length;
      const studied = deck.words.filter(w => stats[statsKey(w)]?.seen > 0).length;
      return (
        <div key={deck.id} style={s.deckCard}>
          <div style={s.deckInfo} onClick={() => { setActiveDeck(deck); setView("detail"); }}>
            <span style={s.deckName}>{deck.name}</span>
            <span style={s.deckMeta}>{wc}語 · {studied}語 学習済み</span>
          </div>
          <div style={s.deckActions}>
            <button style={s.deckPlayBtn} onClick={() => startStudy(deck)}>▶</button>
          </div>
        </div>
      );
    };

    return (
      <div style={s.shell}>
        <div style={s.page}>
          <header style={s.homeHeader}>
            <div style={s.brand}>
              <div style={s.logoIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="14" height="18" rx="2" stroke="#f0abfc" strokeWidth="1.5" fill="none"/>
                  <rect x="8" y="2" width="14" height="18" rx="2" stroke="#c084fc" strokeWidth="1.5" fill="rgba(192,132,252,0.08)"/>
                </svg>
              </div>
              <div>
                <h1 style={s.brandTitle}>Rapid Cycle</h1>
                <p style={s.brandSub}>高速周回フラッシュカード</p>
              </div>
            </div>
            <button style={s.settingsBtn} onClick={() => setView("settings")}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke={t.textMuted} strokeWidth="1.5"/>
                <path d="M16.2 12.2a1.4 1.4 0 00.28 1.54l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.54-.28 1.4 1.4 0 00-.84 1.28v.14a1.7 1.7 0 11-3.4 0v-.07a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.54.28l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.28-1.54 1.4 1.4 0 00-1.28-.84H2.3a1.7 1.7 0 110-3.4h.07a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.28-1.54l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.54.28h.07a1.4 1.4 0 00.84-1.28V2.3a1.7 1.7 0 113.4 0v.07a1.4 1.4 0 00.84 1.28 1.4 1.4 0 001.54-.28l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.28 1.54v.07a1.4 1.4 0 001.28.84h.14a1.7 1.7 0 110 3.4h-.07a1.4 1.4 0 00-1.28.84z" stroke={t.textMuted} strokeWidth="1.5"/>
              </svg>
            </button>
          </header>

          {/* Cross-study button */}
          {totalWords > 0 && (
            <button style={s.crossStudyBtn} onClick={() => { setActiveFolder(null); setView("crossSetup"); }}>
              <span style={{ fontSize: "16px" }}>🔀</span>
              <div>
                <span style={{ fontSize: "14px", fontWeight: "600", color: t.text }}>横断学習</span>
                <span style={{ fontSize: "12px", color: t.textMuted, marginLeft: "8px" }}>全{totalWords}語から出題</span>
              </div>
            </button>
          )}

          {decks.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>📚</div>
              <p style={s.emptyText}>単語帳がまだありません</p>
              <p style={s.emptyHint}>データを取り込んで最初の単語帳を作りましょう</p>
            </div>
          ) : (
            <div style={s.deckList}>
              {/* Folders with their decks nested */}
              {folders.map(folder => {
                const folderDecks = getDecksInFolder(folder.id);
                const folderWords = folderDecks.reduce((sum, d) => sum + d.words.length, 0);
                const isCollapsed = collapsedFolders[folder.id];
                return (
                  <div key={folder.id} style={{ marginBottom: "8px" }}>
                    <div style={s.deckCard}>
                      <div style={{ ...s.deckInfo, flexDirection: "row", alignItems: "center", gap: "10px" }} onClick={() => toggleFolderCollapse(folder.id)}>
                        <span style={{ fontSize: "12px", color: t.textMuted, transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={s.deckName}>📁 {folder.name}</span>
                          <span style={s.deckMeta}>{folderDecks.length}冊 · {folderWords}語</span>
                        </div>
                      </div>
                      <div style={s.deckActions}>
                        <button style={s.deckPlayBtn} onClick={() => { setActiveFolder(folder); setView("folder"); }}>→</button>
                      </div>
                    </div>
                    {!isCollapsed && folderDecks.length > 0 && (
                      <div style={{ marginLeft: "16px", borderLeft: `2px solid ${t.borderLight}`, paddingLeft: "12px", marginTop: "4px" }}>
                        {folderDecks.map(renderDeckItem)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unfiled decks — shown as regular deck items, no "未分類" header */}
              {unfiledDecks.length > 0 && (
                <>
                  {folders.length > 0 && unfiledDecks.length > 0 && <div style={{ height: "8px" }} />}
                  {unfiledDecks.map(renderDeckItem)}
                </>
              )}
            </div>
          )}

          <div style={s.homeActions}>
            <button style={s.primaryBtn} onClick={() => setView("import")}>
              + 単語帳を追加
            </button>
            <div style={{ display: "flex", gap: "8px" }}>
              {showNewFolder ? (
                <div style={{ display: "flex", gap: "6px", flex: 1 }}>
                  <input style={{ ...s.input, flex: 1, padding: "10px 12px", fontSize: "13px" }} value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="フォルダ名" autoFocus />
                  <button style={{ ...s.editSaveBtn, padding: "10px 16px" }} onClick={() => {
                    if (newFolderName.trim()) { createFolder(newFolderName.trim()); setNewFolderName(""); setShowNewFolder(false); }
                  }}>作成</button>
                  <button style={{ ...s.editCancelBtn, padding: "10px 12px" }} onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>✕</button>
                </div>
              ) : (
                <button style={{ ...s.ghostBtn, flex: 1 }} onClick={() => setShowNewFolder(true)}>
                  + フォルダを作成
                </button>
              )}
            </div>
            {decks.length === 0 && (
              <button style={s.ghostBtn} onClick={() => {
                const deck = saveDeck("TOEIC頻出サンプル", SAMPLE_WORDS);
                setActiveDeck(deck);
                setView("detail");
              }}>
                サンプルで試す
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── FOLDER VIEW ──
  if (view === "folder" && activeFolder) {
    const folderDecks = getDecksInFolder(activeFolder.id);
    const folderWords = folderDecks.reduce((sum, d) => sum + d.words.length, 0);

    return (
      <div style={s.shell}>
        <div style={s.page}>
          <header style={s.subHeader}>
            <button style={s.backBtn} onClick={() => setView("home")}>← 戻る</button>
            <h2 style={s.subTitle}>📁 {activeFolder.name}</h2>
          </header>

          {/* Folder cross-study */}
          {folderWords > 0 && (
            <button style={s.crossStudyBtn} onClick={() => { setView("crossSetup"); }}>
              <span style={{ fontSize: "16px" }}>🔀</span>
              <div>
                <span style={{ fontSize: "14px", fontWeight: "600", color: t.text }}>フォルダ横断学習</span>
                <span style={{ fontSize: "12px", color: t.textMuted, marginLeft: "8px" }}>{folderWords}語から出題</span>
              </div>
            </button>
          )}

          {folderDecks.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>📂</div>
              <p style={s.emptyText}>単語帳がありません</p>
              <p style={s.emptyHint}>単語帳の詳細ページからこのフォルダに移動できます</p>
            </div>
          ) : (
            <div style={s.deckList}>
              <p style={s.sectionLabel}>{folderDecks.length}冊の単語帳</p>
              {folderDecks.map(deck => {
                const wc = deck.words.length;
                const studied = deck.words.filter(w => stats[statsKey(w)]?.seen > 0).length;
                return (
                  <div key={deck.id} style={s.deckCard}>
                    <div style={s.deckInfo} onClick={() => { setActiveDeck(deck); setView("detail"); }}>
                      <span style={s.deckName}>{deck.name}</span>
                      <span style={s.deckMeta}>{wc}語 · {studied}語 学習済み</span>
                    </div>
                    <div style={s.deckActions}>
                      <button style={s.deckPlayBtn} onClick={() => startStudy(deck)}>▶</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: "24px" }}>
            <button style={s.smallDangerBtn} onClick={() => setDeleteConfirm({ type: "folder", id: activeFolder.id, name: activeFolder.name })}>
              このフォルダを削除
            </button>
          </div>

          {/* Confirmation modal */}
          {deleteConfirm && (() => {
            const labels = {
              deck:    { title: "単語帳を削除",       desc: `「${deleteConfirm.name}」を削除しますか？この操作は取り消せません。`, confirm: "削除する" },
              folder:  { title: "フォルダを削除",     desc: `「${deleteConfirm.name}」を削除しますか？中の単語帳は削除されず、フォルダ外に移動されます。`, confirm: "削除する" },
              word:    { title: "単語を削除",         desc: `「${deleteConfirm.name}」を削除しますか？`, confirm: "削除する" },
              stats:   { title: "学習記録をリセット", desc: "全ての学習記録をリセットしますか？単語帳は残ります。", confirm: "リセットする" },
              restore: { title: "クラウドから復元",   desc: "クラウドのデータで現在のデータを上書きしますか？", confirm: "復元する" },
            };
            const label = labels[deleteConfirm.type] || labels.deck;
            return (
              <div style={s.modalOverlay} onClick={() => setDeleteConfirm(null)}>
                <div style={s.modal} onClick={e => e.stopPropagation()}>
                  <p style={s.modalTitle}>{label.title}</p>
                  <p style={s.modalDesc}>{label.desc}</p>
                  <div style={s.modalActions}>
                    <button style={s.modalCancelBtn} onClick={() => setDeleteConfirm(null)}>キャンセル</button>
                    <button style={s.modalConfirmBtn} onClick={executeDelete}>{label.confirm}</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── CROSS STUDY SETUP ──
  if (view === "crossSetup") {
    const sourceDecks = activeFolder ? getDecksInFolder(activeFolder.id) : decks;
    const sourceLabel = activeFolder ? activeFolder.name : "全単語帳";
    let availableWords = sourceDecks.flatMap(d => d.words);
    // Deduplicate
    const seenW = new Set();
    availableWords = availableWords.filter(w => { const k = statsKey(w); if (seenW.has(k)) return false; seenW.add(k); return true; });
    const filteredCount = crossFilter === "all" ? availableWords.length
      : availableWords.filter(w => getMemoryLevelForWord(w) === parseInt(crossFilter)).length;

    const filters = [
      { key: "all", label: "全て" },
      { key: "0", label: "未学習" },
      { key: "1", label: "要復習" },
      { key: "2", label: "あと少し" },
      { key: "3", label: "定着" },
    ];
    const countOptions = [10, 20, 30, 50, 100, 200];

    return (
      <div style={s.shell}>
        <div style={s.page}>
          <header style={s.subHeader}>
            <button style={s.backBtn} onClick={() => setView(activeFolder ? "folder" : "home")}>← 戻る</button>
            <h2 style={s.subTitle}>横断学習</h2>
          </header>

          <p style={{ fontSize: "13px", color: t.textMuted, margin: "0 0 20px" }}>
            {sourceLabel}から{filteredCount}語が対象
          </p>

          {/* Memory filter */}
          <div style={s.formGroup}>
            <label style={s.label}>記憶度フィルタ</label>
            <div style={s.filterRow}>
              {filters.map(f => (
                <button key={f.key} onClick={() => setCrossFilter(f.key)}
                  style={crossFilter === f.key ? s.filterActive : s.filterInactive}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Count selector */}
          <div style={s.formGroup}>
            <label style={s.label}>出題数</label>
            <div style={s.filterRow}>
              {countOptions.map(n => (
                <button key={n} onClick={() => setCrossCount(n)}
                  style={crossCount === n ? s.filterActive : s.filterInactive}>
                  {n}語
                </button>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: t.textMuted, margin: "4px 0 0" }}>
              {filteredCount < crossCount ? `対象が${filteredCount}語のため、全問出題されます` : `${filteredCount}語からランダムに${crossCount}語を出題`}
            </p>
          </div>

          <button
            style={{ ...s.primaryBtn, marginTop: "20px", opacity: filteredCount > 0 ? 1 : 0.4 }}
            disabled={filteredCount === 0}
            onClick={() => startCrossStudy(sourceDecks, crossFilter, crossCount, `${sourceLabel}（横断）`)}
          >
            {Math.min(filteredCount, crossCount)}語で学習開始
          </button>
        </div>
      </div>
    );
  }

  // ── DETAIL ──
  const updateDeckWords = (deckId, newWords) => {
    setDecks(prev => prev.map(d => d.id === deckId ? { ...d, words: newWords } : d));
    setActiveDeck(prev => prev && prev.id === deckId ? { ...prev, words: newWords } : prev);
  };

  const startEdit = (idx) => {
    const w = activeDeck.words[idx];
    setEditForm({ word: w.word, meaning: w.meaning, example_en: w.example_en || "", example_ja: w.example_ja || "", note: w.note || "" });
    setEditingIdx(idx);
  };

  const startAdd = () => {
    setEditForm({ word: "", meaning: "", example_en: "", example_ja: "", note: "" });
    setEditingIdx("new");
  };

  const saveEdit = () => {
    if (!editForm.word.trim() || !editForm.meaning.trim()) return;
    const words = [...activeDeck.words];
    const fields = { word: editForm.word.trim(), meaning: editForm.meaning.trim(), example_en: editForm.example_en.trim(), example_ja: editForm.example_ja.trim(), note: editForm.note.trim() };
    if (editingIdx === "new") {
      words.push({ id: genId(), ...fields });
    } else {
      // Preserve existing ID
      words[editingIdx] = { ...words[editingIdx], ...fields };
    }
    updateDeckWords(activeDeck.id, words);
    setEditingIdx(null);
  };

  const deleteWord = (idx) => {
    const w = activeDeck.words[idx];
    setDeleteConfirm({ type: "word", idx, name: w.word });
  };

  const renameDeck = () => {
    if (!renameValue.trim()) return;
    const newName = renameValue.trim();
    setDecks(prev => prev.map(d => d.id === activeDeck.id ? { ...d, name: newName } : d));
    setActiveDeck(prev => prev ? { ...prev, name: newName } : prev);
    setIsRenamingDeck(false);
  };

  const exportDeck = async () => {
    if (!activeDeck) return;
    const header = "word,meaning,example_en,example_ja,note";
    const rows = activeDeck.words.map(w =>
      [w.word, w.meaning, w.example_en || "", w.example_ja || "", w.note || ""]
        .map(field => `"${field.replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    try {
      await navigator.clipboard.writeText(csv);
      setExportCopied(true);
      scheduleTimeout(() => setExportCopied(false), 2000);
    } catch {
      // Fallback: open in new window
      const w = window.open();
      if (w) { w.document.write(`<pre>${csv}</pre>`); }
    }
  };

  if (view === "detail" && activeDeck) {
    const words = activeDeck.words;

    const getMemoryLevel = (w) => {
      const key = typeof w === "object" ? statsKey(w) : w;
      const score = getMemoryScore(w);
      const st = stats[key];
      if (!st || st.seen === 0) return { level: 0, label: "未学習", color: t.textMuted, score: 0 };
      if (score >= 0.85) return { level: 3, label: "定着", color: "#4ade80", score };
      if (score >= 0.55) return { level: 2, label: "あと少し", color: "#facc15", score };
      return { level: 1, label: "要復習", color: "#f87171", score };
    };

    const masteredCount = words.filter(w => getMemoryLevel(w).level === 3).length;
    const avgAccuracy = (() => {
      const studied = words.filter(w => stats[statsKey(w)]?.seen > 0);
      if (studied.length === 0) return null;
      const total = studied.reduce((sum, w) => sum + getMemoryScore(w), 0);
      return Math.round((total / studied.length) * 100);
    })();

    const filters = [
      { key: "all", label: "全て" },
      { key: "0", label: "未学習" },
      { key: "1", label: "要復習" },
      { key: "2", label: "あと少し" },
      { key: "3", label: "定着" },
    ];
    const filteredWords = detailFilter === "all"
      ? words
      : words.filter(w => getMemoryLevel(w).level === parseInt(detailFilter));

    return (
      <div style={s.shell}>
        <div style={s.page}>
          <header style={s.subHeader}>
            <button style={s.backBtn} onClick={() => { setView("home"); setEditingIdx(null); setDetailFilter("all"); setIsRenamingDeck(false); }}>← 戻る</button>
            {isRenamingDeck ? (
              <div style={s.renameRow}>
                <input
                  style={s.renameInput}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") renameDeck(); }}
                />
                <button style={s.renameSaveBtn} onClick={renameDeck}>✓</button>
                <button style={s.renameCancelBtn} onClick={() => setIsRenamingDeck(false)}>✕</button>
              </div>
            ) : (
              <h2 style={s.subTitle} onClick={() => { setIsRenamingDeck(true); setRenameValue(activeDeck.name); }}>{activeDeck.name} <span style={s.editIcon}>✎</span></h2>
            )}
          </header>

          {/* Summary stats */}
          <div style={s.detailSummary}>
            <div style={s.detailStat}>
              <span style={s.detailStatValue}>{words.length}</span>
              <span style={s.detailStatLabel}>全単語</span>
            </div>
            <div style={s.detailStat}>
              <span style={{ ...s.detailStatValue, color: masteredCount > 0 ? "#4ade80" : t.text }}>{masteredCount}</span>
              <span style={s.detailStatLabel}>定着済み</span>
            </div>
            <div style={s.detailStat}>
              <span style={s.detailStatValue}>{avgAccuracy !== null ? `${avgAccuracy}%` : "—"}</span>
              <span style={s.detailStatLabel}>記憶度</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button
              style={{ ...s.primaryBtn, flex: 1, opacity: filteredWords.length > 0 ? 1 : 0.4 }}
              disabled={filteredWords.length === 0}
              onClick={() => {
                const tempDeck = { ...activeDeck, words: filteredWords };
                startStudy(tempDeck);
              }}
            >
              {detailFilter === "all"
                ? `学習を開始する`
                : `${filteredWords.length}語で学習する`
              }
            </button>
            <button style={{ ...s.exportBtn, borderColor: exportCopied ? "rgba(74, 222, 128, 0.3)" : t.borderLight }} onClick={exportDeck}>
              {exportCopied ? (
                <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: "600" }}>✓</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.textSub} strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              )}
            </button>
          </div>

          {/* Folder assignment */}
          {folders.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <select
                value={activeDeck.folderId || ""}
                onChange={e => {
                  const fid = e.target.value || null;
                  moveDeckToFolder(activeDeck.id, fid);
                  setActiveDeck(prev => prev ? { ...prev, folderId: fid } : prev);
                }}
                style={s.selectInput}
              >
                <option value="">未分類</option>
                {folders.map(f => <option key={f.id} value={f.id}>📁 {f.name}</option>)}
              </select>
            </div>
          )}

          {/* Filter chips */}
          <div style={s.filterRow}>
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setDetailFilter(f.key)}
                style={detailFilter === f.key ? s.filterActive : s.filterInactive}
              >
                {f.label}
                {f.key !== "all" && (() => {
                  const count = words.filter(w => getMemoryLevel(w).level === parseInt(f.key)).length;
                  return count > 0 ? ` ${count}` : "";
                })()}
              </button>
            ))}
          </div>

          {/* Word list */}
          <div style={s.wordList}>
            {filteredWords.length === 0 && (
              <p style={{ fontSize: "13px", color: t.textFaint, textAlign: "center", padding: "24px 0" }}>
                該当する単語がありません
              </p>
            )}
            {filteredWords.map((w, fi) => {
              const realIdx = words.indexOf(w);
              const mem = getMemoryLevel(w);
              const st = getWordStats(stats, w);
              const isEditing = editingIdx === realIdx;

              if (isEditing) {
                return (
                  <div key={realIdx} style={s.editCard}>
                    <div style={s.editFields}>
                      <input style={s.editInput} value={editForm.word} onChange={e => setEditForm(f => ({ ...f, word: e.target.value }))} placeholder="英単語" />
                      <input style={s.editInput} value={editForm.meaning} onChange={e => setEditForm(f => ({ ...f, meaning: e.target.value }))} placeholder="意味" />
                      <input style={{ ...s.editInput, fontSize: "12px" }} value={editForm.example_en} onChange={e => setEditForm(f => ({ ...f, example_en: e.target.value }))} placeholder="例文（英語）" />
                      <input style={{ ...s.editInput, fontSize: "12px" }} value={editForm.example_ja} onChange={e => setEditForm(f => ({ ...f, example_ja: e.target.value }))} placeholder="例文（和訳）" />
                      <input style={{ ...s.editInput, fontSize: "12px" }} value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="補足（任意）" />
                    </div>
                    <div style={s.editActions}>
                      <button style={s.editSaveBtn} onClick={saveEdit}>保存</button>
                      <button style={s.editCancelBtn} onClick={() => setEditingIdx(null)}>キャンセル</button>
                      <button style={s.editDeleteBtn} onClick={() => deleteWord(realIdx)}>削除</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={realIdx} style={s.wordItem} onClick={() => { setPreviewIdx(realIdx); setPreviewFlipped(false); }}>
                  <div style={s.wordItemLeft}>
                    <div style={{ ...s.memoryDot, background: mem.color }} />
                    <div style={s.wordItemText}>
                      <span style={s.wordItemWord}>{w.word}</span>
                      <span style={s.wordItemMeaning}>{w.meaning}</span>
                    </div>
                  </div>
                  <div style={s.wordItemRight}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                      <span style={{ ...s.memoryTag, color: mem.color, borderColor: mem.color }}>{mem.label}</span>
                      {st.seen > 0 && (
                        <span style={s.wordItemStats}>{Math.round(mem.score * 100)}%{(() => { const last = getLastStudied(stats, w); return last ? ` · ${formatRelativeDate(last)}` : ""; })()}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add new word */}
            {detailFilter === "all" && (
              editingIdx === "new" ? (
                <div style={s.editCard}>
                  <div style={s.editFields}>
                    <input style={s.editInput} value={editForm.word} onChange={e => setEditForm(f => ({ ...f, word: e.target.value }))} placeholder="英単語" autoFocus />
                    <input style={s.editInput} value={editForm.meaning} onChange={e => setEditForm(f => ({ ...f, meaning: e.target.value }))} placeholder="意味" />
                    <input style={{ ...s.editInput, fontSize: "12px" }} value={editForm.example_en} onChange={e => setEditForm(f => ({ ...f, example_en: e.target.value }))} placeholder="例文（英語）" />
                    <input style={{ ...s.editInput, fontSize: "12px" }} value={editForm.example_ja} onChange={e => setEditForm(f => ({ ...f, example_ja: e.target.value }))} placeholder="例文（和訳）" />
                    <input style={{ ...s.editInput, fontSize: "12px" }} value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="補足（任意）" />
                  </div>
                  <div style={s.editActions}>
                    <button style={s.editSaveBtn} onClick={saveEdit}>追加</button>
                    <button style={s.editCancelBtn} onClick={() => setEditingIdx(null)}>キャンセル</button>
                  </div>
                </div>
              ) : (
                <button style={s.addWordBtn} onClick={startAdd}>
                  + 単語を追加
                </button>
              )
            )}
          </div>

          {/* Delete deck */}
          <div style={{ paddingTop: "16px", paddingBottom: "16px" }}>
            <button style={s.smallDangerBtn} onClick={() => setDeleteConfirm({ type: "deck", id: activeDeck.id, name: activeDeck.name })}>
              この単語帳を削除
            </button>
          </div>

          {/* Card preview modal */}
          {previewIdx !== null && words[previewIdx] && (() => {
            const pw = words[previewIdx];
            const pParts = highlightWord(pw.example_en, pw.word);
            const pMem = getMemoryLevel(pw);
            const pSt = getWordStats(stats, pw);
            return (
              <div style={s.modalOverlay} onClick={() => setPreviewIdx(null)}>
                <div style={{ width: "100%", maxWidth: "400px", display: "flex", flexDirection: "column", gap: "14px", perspective: "1200px" }} onClick={e => e.stopPropagation()}>
                  {/* Preview card with flip */}
                  <div
                    style={{ ...s.flipContainer, cursor: "pointer" }}
                    onClick={() => setPreviewFlipped(!previewFlipped)}
                  >
                    <div style={{
                      ...s.flipInner,
                      transform: previewFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}>
                      {/* Front face */}
                      <div style={s.flipFace}>
                        <div style={{ ...s.card, height: "440px", margin: 0 }}>
                          <div style={s.exampleArea}>
                            {pw.example_en ? (
                              <p style={s.exampleSentence}>
                                {Array.isArray(pParts) ? pParts.map((part, i) => {
                                  const isHl = part.toLowerCase().startsWith(pw.word.toLowerCase());
                                  return isHl
                                    ? <span key={i} style={s.highlight}>{part}</span>
                                    : <span key={i}>{part}</span>;
                                }) : pw.example_en}
                              </p>
                            ) : (
                              <p style={{ ...s.exampleSentence, fontSize: "28px", fontWeight: "700", textAlign: "center", color: t.highlightText }}>
                                {pw.word}
                              </p>
                            )}
                          </div>
                          <p style={s.tapHint}>タップで裏面を表示</p>
                        </div>
                      </div>
                      {/* Back face */}
                      <div style={{ ...s.flipFace, ...s.flipBack }}>
                        <div style={{ ...s.card, height: "440px", margin: 0 }}>
                          {pw.example_en && (
                            <p style={{ ...s.exampleSentence, fontSize: "14px", color: t.textMuted }}>
                              {Array.isArray(pParts) ? pParts.map((part, i) => {
                                const isHl = part.toLowerCase().startsWith(pw.word.toLowerCase());
                                return isHl
                                  ? <span key={i} style={{ ...s.highlight, fontSize: "14px" }}>{part}</span>
                                  : <span key={i}>{part}</span>;
                              }) : pw.example_en}
                            </p>
                          )}
                          <div style={s.cardDivider} />
                          <div style={s.answerArea}>
                            <div style={s.wordMeaning}>
                              <span style={s.answerWord}>{pw.word}</span>
                              <span style={s.answerMeaningText}>{pw.meaning}</span>
                            </div>
                            {pw.example_ja && <p style={s.answerTranslation}>{pw.example_ja}</p>}
                            {pw.note && <p style={s.answerNote}>{pw.note}</p>}
                          </div>
                          <p style={s.tapHint}>タップで表面に戻す</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions below card */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button style={{ ...s.ghostBtn, flex: 1, padding: "12px" }} onClick={() => setPreviewIdx(null)}>
                      閉じる
                    </button>
                    <button style={{ ...s.primaryBtn, flex: 1, padding: "12px" }} onClick={() => {
                      setPreviewIdx(null);
                      startEdit(previewIdx);
                    }}>
                      編集する
                    </button>
                  </div>

                  {/* Stats badge */}
                  <div style={{ display: "flex", justifyContent: "center", gap: "12px", fontSize: "12px", color: t.textMuted }}>
                    <span style={{ color: pMem.color }}>{pMem.label}</span>
                    {pSt.seen > 0 && <span>{Math.round(pMem.score * 100)}%</span>}
                    {(() => { const last = getLastStudied(stats, pw); return last ? <span>{formatRelativeDate(last)}</span> : null; })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Confirmation modal */}
          {deleteConfirm && (() => {
            const labels = {
              deck:    { title: "単語帳を削除",       desc: `「${deleteConfirm.name}」を削除しますか？この操作は取り消せません。`, confirm: "削除する" },
              folder:  { title: "フォルダを削除",     desc: `「${deleteConfirm.name}」を削除しますか？中の単語帳は削除されず、フォルダ外に移動されます。`, confirm: "削除する" },
              word:    { title: "単語を削除",         desc: `「${deleteConfirm.name}」を削除しますか？`, confirm: "削除する" },
              stats:   { title: "学習記録をリセット", desc: "全ての学習記録をリセットしますか？単語帳は残ります。", confirm: "リセットする" },
              restore: { title: "クラウドから復元",   desc: "クラウドのデータで現在のデータを上書きしますか？", confirm: "復元する" },
            };
            const label = labels[deleteConfirm.type] || labels.deck;
            return (
              <div style={s.modalOverlay} onClick={() => setDeleteConfirm(null)}>
                <div style={s.modal} onClick={e => e.stopPropagation()}>
                  <p style={s.modalTitle}>{label.title}</p>
                  <p style={s.modalDesc}>{label.desc}</p>
                  <div style={s.modalActions}>
                    <button style={s.modalCancelBtn} onClick={() => setDeleteConfirm(null)}>キャンセル</button>
                    <button style={s.modalConfirmBtn} onClick={executeDelete}>{label.confirm}</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── SETTINGS ──
  if (view === "settings") {
    return (
      <div style={s.shell}>
        <div style={s.page}>
          <header style={s.subHeader}>
            <button style={s.backBtn} onClick={() => setView("home")}>← 戻る</button>
            <h2 style={s.subTitle}>設定</h2>
          </header>

          <div style={s.settingsSection}>
            <p style={s.sectionLabel}>テーマ</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setSettings(prev => ({ ...prev, theme: "dark" }))}
                style={{
                  ...s.primaryBtn,
                  flex: 1,
                  padding: "12px",
                  background: (settings.theme || "dark") === "dark" ? "linear-gradient(135deg, #a855f7, #7c3aed)" : "transparent",
                  border: (settings.theme || "dark") === "dark" ? "none" : `1px solid ${t.border}`,
                  color: (settings.theme || "dark") === "dark" ? "#fff" : t.textMuted,
                }}
              >
                🌙 ダーク
              </button>
              <button
                onClick={() => setSettings(prev => ({ ...prev, theme: "light" }))}
                style={{
                  ...s.primaryBtn,
                  flex: 1,
                  padding: "12px",
                  background: settings.theme === "light" ? "linear-gradient(135deg, #a855f7, #7c3aed)" : "transparent",
                  border: settings.theme === "light" ? "none" : `1px solid ${t.border}`,
                  color: settings.theme === "light" ? "#fff" : t.textMuted,
                }}
              >
                ☀️ ライト
              </button>
            </div>
          </div>

          <div style={s.settingsSection}>
            <p style={s.sectionLabel}>周回ロジック</p>

            <div style={s.settingItem}>
              <div style={s.settingHeader}>
                <span style={s.settingName}>R1 正答の再登場率</span>
                <span style={s.settingValue}>{Math.round(settings.reappearR1 * 100)}%</span>
              </div>
              <p style={s.settingDesc}>R1→R2 で、R1で正答した単語が再登場する確率</p>
              <input
                type="range"
                min="0" max="100" step="5"
                value={Math.round(settings.reappearR1 * 100)}
                onChange={e => setSettings(prev => ({ ...prev, reappearR1: parseInt(e.target.value) / 100 }))}
                style={s.slider}
              />
              <div style={s.sliderLabels}>
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <div style={s.settingItem}>
              <div style={s.settingHeader}>
                <span style={s.settingName}>R2以降 正答の再登場率</span>
                <span style={s.settingValue}>{Math.round(settings.reappearR2 * 100)}%</span>
              </div>
              <p style={s.settingDesc}>R2→R3以降で、前ラウンド正答の単語が再登場する確率</p>
              <input
                type="range"
                min="0" max="100" step="5"
                value={Math.round(settings.reappearR2 * 100)}
                onChange={e => setSettings(prev => ({ ...prev, reappearR2: parseInt(e.target.value) / 100 }))}
                style={s.slider}
              />
              <div style={s.sliderLabels}>
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <div style={s.settingItem}>
              <div style={s.settingHeader}>
                <span style={s.settingName}>記憶度による再登場率調整</span>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, memoryReappear: !prev.memoryReappear }))}
                  style={{
                    ...s.toggleBtn,
                    background: settings.memoryReappear ? "rgba(74, 222, 128, 0.15)" : "rgba(107, 104, 119, 0.1)",
                    color: settings.memoryReappear ? "#4ade80" : t.textMuted,
                    borderColor: settings.memoryReappear ? "rgba(74, 222, 128, 0.3)" : t.divider,
                  }}
                >
                  {settings.memoryReappear ? "ON" : "OFF"}
                </button>
              </div>
              <p style={s.settingDesc}>
                ONの場合、記憶度に応じて再登場率を自動調整します。
                {"\n"}定着: ×0.3 / あと少し: ×0.7 / 要復習: ×1.3
              </p>
            </div>
          </div>

          <div style={s.settingsSection}>
            <p style={s.sectionLabel}>クラウドバックアップ (GAS)</p>
            <div style={s.settingItem}>
              <p style={s.settingDesc}>
                Google Apps Script の Web アプリ URL を設定すると、学習セッション終了時に自動でバックアップされます。
              </p>
              <input
                type="url"
                value={settings.gasUrl || ""}
                onChange={e => setSettings(prev => ({ ...prev, gasUrl: e.target.value.trim() }))}
                placeholder="https://script.google.com/macros/s/.../exec"
                style={{ ...s.input, width: "100%", padding: "10px 12px", fontSize: "13px", marginTop: "8px", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  style={{ ...s.ghostBtn, flex: 1, padding: "10px", fontSize: "13px", opacity: settings.gasUrl ? 1 : 0.5 }}
                  disabled={!settings.gasUrl || cloudStatus === "saving" || cloudStatus === "restoring"}
                  onClick={() => runCloudBackup()}
                >
                  {cloudStatus === "saving" ? "保存中..." : cloudStatus === "saved" ? "✓ 保存完了" : "今すぐバックアップ"}
                </button>
                <button
                  style={{ ...s.ghostBtn, flex: 1, padding: "10px", fontSize: "13px", opacity: settings.gasUrl ? 1 : 0.5 }}
                  disabled={!settings.gasUrl || cloudStatus === "saving" || cloudStatus === "restoring"}
                  onClick={() => setDeleteConfirm({ type: "restore", name: "クラウドデータで上書き" })}
                >
                  {cloudStatus === "restoring" ? "復元中..." : cloudStatus === "restored" ? "✓ 復元完了" : "復元する"}
                </button>
              </div>
              {cloudStatus === "error" && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "8px 0 0" }}>通信に失敗しました。URL を確認してください。</p>
              )}
            </div>
          </div>

          <div style={s.settingsSection}>
            <p style={s.sectionLabel}>データのバックアップ</p>
            <div style={s.settingItem}>
              <p style={s.settingDesc}>
                全データ（単語帳・学習記録・フォルダ・設定）をコピーして保存できます。復元時は貼り付けてください。
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button style={{ ...s.ghostBtn, flex: 1, padding: "10px", fontSize: "13px" }}
                  onClick={async () => {
                    const payload = JSON.stringify({ decks, stats, folders, settings: { ...settings, gasUrl: undefined }, v: 1 });
                    try {
                      await navigator.clipboard.writeText(payload);
                      setBackupStatus("saved");
                      scheduleTimeout(() => setBackupStatus(""), 3000);
                    } catch {
                      setBackupStatus("error");
                      scheduleTimeout(() => setBackupStatus(""), 3000);
                    }
                  }}
                >
                  {backupStatus === "saved" ? "✓ コピー完了" : "全データをコピー"}
                </button>
                <button style={{ ...s.ghostBtn, flex: 1, padding: "10px", fontSize: "13px" }}
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const d = JSON.parse(text);
                      if (d.decks) setDecks(d.decks);
                      if (d.stats) setStats(d.stats);
                      if (d.folders) setFolders(d.folders);
                      if (d.settings) setSettings(prev => ({ ...prev, ...d.settings, gasUrl: prev.gasUrl }));
                      setBackupStatus("restored");
                      scheduleTimeout(() => setBackupStatus(""), 3000);
                    } catch {
                      setBackupStatus("error");
                      scheduleTimeout(() => setBackupStatus(""), 3000);
                    }
                  }}
                >
                  {backupStatus === "restored" ? "✓ 復元完了" : "貼り付けて復元"}
                </button>
              </div>
              {backupStatus === "error" && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "8px 0 0" }}>データの読み取りに失敗しました。コピーした内容を確認してください。</p>
              )}
            </div>
          </div>

          <div style={s.settingsSection}>
            <p style={s.sectionLabel}>データ管理</p>
            <button style={s.dangerBtn} onClick={() => setDeleteConfirm({ type: "stats", name: "学習記録" })}>
              学習記録をリセット
            </button>
          </div>

          <div style={{ marginTop: "auto", paddingTop: "20px" }}>
            <button style={s.ghostBtn} onClick={() => setSettings(prev => ({ ...DEFAULT_SETTINGS, gasUrl: prev.gasUrl }))}>
              デフォルトに戻す
            </button>
          </div>
        </div>

        {/* Confirmation modal */}
        {deleteConfirm && (() => {
          const labels = {
            deck:    { title: "単語帳を削除",       desc: `「${deleteConfirm.name}」を削除しますか？この操作は取り消せません。`, confirm: "削除する" },
            folder:  { title: "フォルダを削除",     desc: `「${deleteConfirm.name}」を削除しますか？中の単語帳は削除されず、フォルダ外に移動されます。`, confirm: "削除する" },
            word:    { title: "単語を削除",         desc: `「${deleteConfirm.name}」を削除しますか？`, confirm: "削除する" },
            stats:   { title: "学習記録をリセット", desc: "全ての学習記録をリセットしますか？単語帳は残ります。", confirm: "リセットする" },
            restore: { title: "クラウドから復元",   desc: "クラウドのデータで現在のデータを上書きしますか？", confirm: "復元する" },
          };
          const label = labels[deleteConfirm.type] || labels.deck;
          return (
            <div style={s.modalOverlay} onClick={() => setDeleteConfirm(null)}>
              <div style={s.modal} onClick={e => e.stopPropagation()}>
                <p style={s.modalTitle}>{label.title}</p>
                <p style={s.modalDesc}>{label.desc}</p>
                <div style={s.modalActions}>
                  <button style={s.modalCancelBtn} onClick={() => setDeleteConfirm(null)}>キャンセル</button>
                  <button style={s.modalConfirmBtn} onClick={executeDelete}>{label.confirm}</button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ── IMPORT ──
  if (view === "import") {
    const preview = importText ? parseCSV(importText) : [];
    return (
      <div style={s.shell}>
        <div style={s.page}>
          <header style={s.subHeader}>
            <button style={s.backBtn} onClick={() => { setView("home"); setImportText(""); setDeckName(""); }}>← 戻る</button>
            <h2 style={s.subTitle}>単語帳を追加</h2>
          </header>

          <div style={s.formGroup}>
            <label style={s.label}>単語帳の名前</label>
            <input
              type="text"
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              placeholder="例: TOEIC 800語"
              style={s.input}
            />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>データの入力</label>
            <button style={s.fileBtn} onClick={() => fileInputRef.current?.click()}>
              📁 CSVファイルを選択
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={"word,meaning,example_en,example_ja,note\nprocurement,調達,The procurement was delayed.,調達が遅れた。,動詞procureの名詞形\n\n（タブ区切りにも対応・noteは省略可）"}
              style={s.textarea}
              spellCheck={false}
            />
          </div>

          {preview.length > 0 && (
            <div style={s.previewBox}>
              <p style={s.previewLabel}>プレビュー: {preview.length}語を検出</p>
              <div style={s.previewScroll}>
                {preview.slice(0, 5).map((w, i) => (
                  <div key={i} style={s.previewItem}>
                    <span style={s.previewWord}>{w.word}</span>
                    <span style={s.previewMeaning}>{w.meaning}</span>
                  </div>
                ))}
                {preview.length > 5 && <p style={s.previewMore}>...他{preview.length - 5}語</p>}
              </div>
            </div>
          )}

          <div style={s.importHint}>
            <span>💡</span>
            <span>Claudeに「この単語帳の内容を word,meaning,example_en,example_ja,note のCSV形式にして」と頼めば、そのまま貼り付けられます（noteは省略可）</span>
          </div>

          <button
            style={{ ...s.primaryBtn, opacity: preview.length > 0 ? 1 : 0.4 }}
            onClick={handleImport}
            disabled={preview.length === 0}
          >
            {preview.length}語を保存して開始
          </button>
        </div>
      </div>
    );
  }

  // ── STUDY ──
  if (view === "study" && currentCard) {
    const stackCards = [];
    for (let i = 0; i < Math.min(3, cards.length - currentIdx); i++) {
      stackCards.push(cards[currentIdx + i]);
    }

    const topCard = stackCards[0];
    const topParts = highlightWord(topCard.example_en, topCard.word);

    // Helper to render a card's front face content
    const renderFront = (card) => {
      const parts = highlightWord(card.example_en, card.word);
      return (
        <div style={s.card}>
          <div style={s.exampleArea}>
            {card.example_en ? (
              <p style={s.exampleSentence}>
                {Array.isArray(parts) ? parts.map((part, i) => {
                  const isHl = part.toLowerCase().startsWith(card.word.toLowerCase());
                  return isHl ? <span key={i} style={s.highlight}>{part}</span> : <span key={i}>{part}</span>;
                }) : card.example_en}
              </p>
            ) : (
              <p style={{ ...s.exampleSentence, fontSize: "28px", fontWeight: "700", textAlign: "center", color: t.highlightText }}>
                {card.word}
              </p>
            )}
          </div>
          <p style={s.tapHint}>タップで意味を表示</p>
        </div>
      );
    };

    const renderBack = (card) => {
      const parts = highlightWord(card.example_en, card.word);
      return (
        <div style={s.card}>
          <div style={s.exampleArea}>
            <p style={{ ...s.exampleSentence, fontSize: "16px", color: "#7a7688" }}>
              {Array.isArray(parts) ? parts.map((part, i) => {
                const isHl = part.toLowerCase().startsWith(card.word.toLowerCase());
                return isHl ? <span key={i} style={{ ...s.highlight, fontSize: "16px" }}>{part}</span> : <span key={i}>{part}</span>;
              }) : card.example_en}
            </p>
          </div>
          <div style={s.cardDivider} />
          <div style={s.answerArea}>
            <div style={s.wordMeaning}>
              <span style={s.answerWord}>{card.word}</span>
              <span style={s.answerMeaningText}>{card.meaning}</span>
            </div>
            {card.example_ja && <p style={s.answerTranslation}>{card.example_ja}</p>}
            {card.note && <p style={s.answerNote}>{card.note}</p>}
          </div>
        </div>
      );
    };

    return (
      <div style={s.shell}>
        <div style={s.studyPage}>
          {/* Header */}
          <div style={s.studyNav}>
            <button style={s.backBtn} onClick={() => setShowQuitModal(true)}>✕</button>
            <div style={s.studyMeta}>
              <span style={s.roundLabel}>R{round}</span>
              <span style={s.cardCount}>{currentIdx + 1}/{cards.length}</span>
            </div>
          </div>

          {/* Progress */}
          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width: `${(currentIdx / cards.length) * 100}%` }} />
          </div>

          {/* Swipe indicators */}
          {swipeX !== 0 && (
            <>
              <div style={{ ...s.swipeIndicator, ...s.swipeRight, opacity: swipeX > 0 ? swipeOpacity : 0 }}>
                <span style={s.swipeIcon}>○</span>
              </div>
              <div style={{ ...s.swipeIndicator, ...s.swipeLeft, opacity: swipeX < 0 ? swipeOpacity : 0 }}>
                <span style={s.swipeIcon}>✕</span>
              </div>
            </>
          )}

          {/* Card entrance animation */}
          <style>{`
            @keyframes cardPromote {
              0% { transform: scale(0.96) translateY(16px); opacity: 0.85; filter: brightness(0.85); }
              60% { transform: scale(1.0) translateY(2px); opacity: 1; filter: brightness(0.98); }
              100% { transform: scale(1.0) translateY(0px); opacity: 1; filter: brightness(1); }
            }
          `}</style>

          {/* Card stack */}
          <div style={s.cardArea}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={handleTap}
          >
            <div style={s.stackContainer}>
              {/* Background cards */}
              {stackCards.slice(1).reverse().map((card, reverseIdx) => {
                const depth = stackCards.length - 1 - reverseIdx;
                return (
                  <div key={`bg-${currentIdx + depth}`} style={{
                    ...s.stackCard,
                    transform: `scale(${1 - depth * 0.04}) translateY(${depth * 16}px)`,
                    zIndex: 10 - depth,
                    opacity: 1,
                    transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
                  }}>
                    <div style={{ ...s.card, background: t.cardBgStack, border: `1px solid ${t.cardBorderStack}`, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
                      <div style={s.exampleArea}>
                        <p style={{ ...s.exampleSentence, color: t.cardTextStack }}>
                          {card.example_en || card.word}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Animating (flying out) cards */}
              {animatingCards.map(anim => {
                const isExit = anim.phase === "exit";
                return (
                  <div key={`anim-${anim.id}`} style={{
                    ...s.stackCard,
                    zIndex: 25,
                    transform: isExit
                      ? `translateX(${anim.exitX}px) translateY(${anim.exitY}px) rotate(${anim.exitRotate}deg)`
                      : `translateX(${anim.startX}px) translateY(${anim.startY}px) rotate(${(anim.startX / 800) * 8}deg)`,
                    opacity: isExit ? 0 : 1,
                    transition: isExit ? "transform 1s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.85s ease-out" : "none",
                    pointerEvents: "none",
                  }}>
                    {anim.wasFlipped ? renderBack(anim.card) : renderFront(anim.card)}
                  </div>
                );
              })}

              {/* Current top card with entrance animation */}
              <div key={`top-${currentIdx}-${round}`} style={{
                ...s.stackCard,
                zIndex: 20,
                transform: `translateX(${swipeX}px) translateY(${swipeY}px) rotate(${swipeRotate}deg)`,
                transition: swipeX !== 0 ? "none" : "transform 0.12s ease-out",
                animation: swipeX === 0 && !flipped ? "cardPromote 0.4s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
              }}>
                <div style={s.flipContainer}>
                  <div style={{
                    ...s.flipInner,
                    transform: flipped
                      ? (flipDirection === "left" ? "rotateY(-180deg)" : "rotateY(180deg)")
                      : "rotateY(0deg)",
                    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}>
                    <div style={s.flipFace}>{renderFront(topCard)}</div>
                    <div style={{ ...s.flipFace, ...s.flipBack, transform: flipDirection === "left" ? "rotateY(-180deg)" : "rotateY(180deg)" }}>
                      {renderBack(topCard)}
                      <div style={{ position: "absolute", bottom: "36px", left: 0, right: 0, textAlign: "center" }}>
                        {waitingForTap && <p style={s.tapHint}>タップで次へ</p>}
                        {flipped && !waitingForTap && <p style={s.tapHint}>スワイプで回答</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Swipe instruction */}
          <div style={s.swipeInstruction}>
            <span style={s.swipeInstructLeft}>← わからない</span>
            <span style={s.swipeInstructRight}>わかる →</span>
          </div>

          {/* Quit confirmation modal */}
          {showQuitModal && (
            <div style={s.modalOverlay} onClick={() => setShowQuitModal(false)}>
              <div style={s.modal} onClick={e => e.stopPropagation()}>
                <p style={s.modalTitle}>学習を中断しますか？</p>
                <p style={s.modalDesc}>学習記録は保存されますが、次回は最初からやり直しになります。</p>
                <div style={s.modalActions}>
                  <button style={s.modalCancelBtn} onClick={() => setShowQuitModal(false)}>続ける</button>
                  <button style={s.modalConfirmBtn} onClick={() => { setShowQuitModal(false); setView(activeDeck && activeDeck.id !== "__cross__" ? "detail" : "home"); }}>中断する</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT ──
  if (view === "result") {
    return (
      <div style={s.shell}>
        <div style={s.page}>
          <div style={s.resultContent}>
            <div style={s.checkCircle}>✓</div>
            <h2 style={s.resultTitle}>完了！</h2>

            <div style={s.resultStats}>
              <div style={s.statBox}>
                <span style={s.statValue}>{activeDeck?.words.length || 0}</span>
                <span style={s.statLabel}>単語数</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statValue}>{round}</span>
                <span style={s.statLabel}>ラウンド</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statValue}>{sessionTotal}</span>
                <span style={s.statLabel}>総レビュー</span>
              </div>
            </div>

            <div style={s.resultBtns}>
              <button style={s.primaryBtn} onClick={() => startStudy(activeDeck)}>
                もう一周する
              </button>
              {activeDeck && activeDeck.id !== "__cross__" && (
                <button style={s.ghostBtn} onClick={() => { setView("detail"); }}>
                  単語リストを見る
                </button>
              )}
              <button style={s.ghostBtn} onClick={() => setView("home")}>
                ホームに戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── STYLES ───
const font = "'DM Sans', 'Noto Sans JP', -apple-system, sans-serif";
const mono = "'JetBrains Mono', 'SF Mono', monospace";

function makeStyles(t) { return {
  shell: {
    minHeight: "100vh",
    minHeight: "100dvh",
    background: t.bg,
    color: t.text,
    fontFamily: font,
    WebkitFontSmoothing: "antialiased",
    overflowX: "hidden",
  },
  page: {
    maxWidth: "500px",
    margin: "0 auto",
    padding: "20px 20px env(safe-area-inset-bottom, 20px)",
    minHeight: "100vh",
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
  },

  // ── Home ──
  homeHeader: {
    paddingTop: "env(safe-area-inset-top, 12px)",
    marginBottom: "32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsBtn: {
    width: "40px",
    height: "40px",
    border: "none",
    borderRadius: "10px",
    background: "rgba(107, 104, 119, 0.08)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
    padding: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  logoIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    background: "rgba(192, 132, 252, 0.06)",
    border: "1px solid rgba(192, 132, 252, 0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: "20px",
    fontWeight: "700",
    margin: 0,
    color: "#f0ecf9",
    letterSpacing: "-0.3px",
  },
  brandSub: {
    fontSize: "11px",
    color: t.textMuted,
    margin: 0,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    marginTop: "2px",
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: t.textMuted,
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    margin: "0 0 12px",
  },
  deckList: {
    flex: 1,
  },
  deckCard: {
    display: "flex",
    alignItems: "center",
    background: t.inputBg,
    border: "1px solid #1e1e28",
    borderRadius: "14px",
    marginBottom: "8px",
    overflow: "hidden",
    transition: "border-color 0.2s",
  },
  deckInfo: {
    flex: 1,
    padding: "16px 18px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  deckName: {
    fontSize: "15px",
    fontWeight: "600",
    color: t.text,
  },
  deckMeta: {
    fontSize: "12px",
    color: t.textMuted,
  },
  deckActions: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    paddingRight: "8px",
  },
  deckPlayBtn: {
    width: "36px",
    height: "36px",
    border: "none",
    borderRadius: "10px",
    background: "rgba(192, 132, 252, 0.08)",
    color: "#c084fc",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  deckDeleteBtn: {
    width: "36px",
    height: "36px",
    border: "none",
    borderRadius: "10px",
    background: "transparent",
    color: t.textFaint,
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "48px 0",
  },
  emptyIcon: {
    fontSize: "40px",
    marginBottom: "8px",
    opacity: 0.6,
  },
  emptyText: {
    fontSize: "16px",
    fontWeight: "600",
    color: t.textSub,
    margin: 0,
  },
  emptyHint: {
    fontSize: "13px",
    color: "#5a5668",
    margin: 0,
  },
  crossStudyBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 18px",
    background: "rgba(168, 85, 247, 0.06)",
    border: "1px solid rgba(168, 85, 247, 0.15)",
    borderRadius: "14px",
    cursor: "pointer",
    marginBottom: "16px",
    WebkitTapHighlightColor: "transparent",
    fontFamily: font,
    textAlign: "left",
  },
  selectInput: {
    width: "100%",
    padding: "10px 14px",
    background: t.inputBg,
    border: "1px solid #26263a",
    borderRadius: "10px",
    color: t.text,
    fontSize: "13px",
    fontFamily: font,
    outline: "none",
    WebkitAppearance: "none",
    appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b6877' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
  },
  homeActions: {
    marginTop: "auto",
    paddingTop: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  primaryBtn: {
    padding: "16px",
    background: "linear-gradient(135deg, #a855f7, #7c3aed)",
    border: "none",
    borderRadius: "14px",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: font,
    textAlign: "center",
    WebkitTapHighlightColor: "transparent",
  },
  ghostBtn: {
    padding: "14px",
    background: "transparent",
    border: "1px solid #2a2835",
    borderRadius: "14px",
    color: t.textSub,
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: font,
    textAlign: "center",
    WebkitTapHighlightColor: "transparent",
  },

  // ── Detail ──
  renameRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flex: 1,
  },
  renameInput: {
    flex: 1,
    padding: "8px 12px",
    background: t.inputBg,
    border: "1px solid rgba(168, 85, 247, 0.3)",
    borderRadius: "8px",
    color: t.text,
    fontSize: "16px",
    fontWeight: "600",
    fontFamily: font,
    outline: "none",
    WebkitAppearance: "none",
  },
  renameSaveBtn: {
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "8px",
    background: "rgba(74, 222, 128, 0.1)",
    color: "#4ade80",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  renameCancelBtn: {
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "8px",
    background: "rgba(148, 144, 160, 0.08)",
    color: t.textMuted,
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  editIcon: {
    fontSize: "14px",
    color: t.textFaint,
    marginLeft: "4px",
  },
  exportBtn: {
    width: "52px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: t.inputBg,
    border: "1px solid #1e1e28",
    borderRadius: "14px",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    flexShrink: 0,
  },
  filterRow: {
    display: "flex",
    gap: "6px",
    marginBottom: "14px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    paddingBottom: "4px",
  },
  filterActive: {
    padding: "6px 14px",
    border: "none",
    borderRadius: "20px",
    background: "rgba(168, 85, 247, 0.15)",
    color: "#c084fc",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: font,
    whiteSpace: "nowrap",
    WebkitTapHighlightColor: "transparent",
  },
  filterInactive: {
    padding: "6px 14px",
    border: "1px solid #1e1e28",
    borderRadius: "20px",
    background: "transparent",
    color: t.textMuted,
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: font,
    whiteSpace: "nowrap",
    WebkitTapHighlightColor: "transparent",
  },
  detailSummary: {
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
  },
  detailStat: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "16px 8px",
    background: t.inputBg,
    borderRadius: "12px",
    border: "1px solid #1e1e28",
  },
  detailStatValue: {
    fontSize: "20px",
    fontWeight: "700",
    fontFamily: mono,
    color: t.text,
  },
  detailStatLabel: {
    fontSize: "10px",
    color: t.textMuted,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  wordList: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    paddingBottom: "32px",
  },
  wordItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: t.inputBg,
    borderRadius: "10px",
    gap: "12px",
  },
  wordItemLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: 1,
    minWidth: 0,
  },
  memoryDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  wordItemText: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  wordItemWord: {
    fontSize: "14px",
    fontWeight: "600",
    color: t.text,
    fontFamily: mono,
  },
  wordItemMeaning: {
    fontSize: "12px",
    color: t.textMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  wordItemRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  memoryTag: {
    fontSize: "10px",
    fontWeight: "600",
    padding: "3px 8px",
    borderRadius: "6px",
    border: "1px solid",
    opacity: 0.8,
    whiteSpace: "nowrap",
  },
  wordItemStats: {
    fontSize: "11px",
    color: t.textFaint,
    fontFamily: mono,
  },
  editCard: {
    background: t.inputBg,
    border: "1px solid rgba(168, 85, 247, 0.25)",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  editFields: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  editInput: {
    padding: "10px 12px",
    background: "#0c0c0e",
    border: "1px solid #2a2835",
    borderRadius: "8px",
    color: t.text,
    fontSize: "14px",
    fontFamily: font,
    outline: "none",
    WebkitAppearance: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  editActions: {
    display: "flex",
    gap: "8px",
  },
  editSaveBtn: {
    flex: 1,
    padding: "10px",
    background: "linear-gradient(135deg, #a855f7, #7c3aed)",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: font,
    WebkitTapHighlightColor: "transparent",
  },
  editCancelBtn: {
    flex: 1,
    padding: "10px",
    background: "transparent",
    border: "1px solid #2a2835",
    borderRadius: "8px",
    color: t.textSub,
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: font,
    WebkitTapHighlightColor: "transparent",
  },
  editDeleteBtn: {
    padding: "10px 14px",
    background: "rgba(239, 68, 68, 0.06)",
    border: "1px solid rgba(239, 68, 68, 0.15)",
    borderRadius: "8px",
    color: "#f87171",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: font,
    WebkitTapHighlightColor: "transparent",
  },
  addWordBtn: {
    width: "100%",
    padding: "14px",
    background: "transparent",
    border: "1px dashed #2a2835",
    borderRadius: "10px",
    color: t.textMuted,
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: font,
    textAlign: "center",
    WebkitTapHighlightColor: "transparent",
    marginTop: "4px",
  },

  // ── Settings ──
  settingsSection: {
    marginBottom: "28px",
  },
  settingItem: {
    background: t.inputBg,
    border: "1px solid #1e1e28",
    borderRadius: "14px",
    padding: "18px",
    marginBottom: "12px",
  },
  settingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  settingName: {
    fontSize: "14px",
    fontWeight: "600",
    color: t.text,
  },
  settingValue: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#c084fc",
    fontFamily: mono,
  },
  settingDesc: {
    fontSize: "12px",
    color: "#5a5668",
    margin: "0 0 14px",
    lineHeight: "1.5",
  },
  slider: {
    width: "100%",
    height: "4px",
    WebkitAppearance: "none",
    appearance: "none",
    background: t.divider,
    borderRadius: "2px",
    outline: "none",
    accentColor: "#a855f7",
    cursor: "pointer",
  },
  sliderLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "10px",
    color: t.textMuted,
    marginTop: "6px",
  },
  dangerBtn: {
    width: "100%",
    padding: "14px",
    background: "rgba(239, 68, 68, 0.06)",
    border: "1px solid rgba(239, 68, 68, 0.15)",
    borderRadius: "14px",
    color: "#f87171",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: font,
    textAlign: "center",
    WebkitTapHighlightColor: "transparent",
  },
  smallDangerBtn: {
    width: "100%",
    padding: "10px",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    color: t.textMuted,
    fontSize: "12px",
    fontWeight: "400",
    cursor: "pointer",
    fontFamily: font,
    textAlign: "center",
    WebkitTapHighlightColor: "transparent",
  },
  toggleBtn: {
    padding: "5px 14px",
    border: "1px solid",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: mono,
    WebkitTapHighlightColor: "transparent",
  },

  // ── Import ──
  subHeader: {
    paddingTop: "env(safe-area-inset-top, 12px)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "28px",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: t.textSub,
    fontSize: "15px",
    cursor: "pointer",
    padding: "8px 4px",
    fontFamily: font,
    WebkitTapHighlightColor: "transparent",
  },
  subTitle: {
    fontSize: "18px",
    fontWeight: "700",
    margin: 0,
    color: t.text,
  },
  formGroup: {
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: t.textMuted,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  input: {
    padding: "14px 16px",
    background: t.inputBg,
    border: "1px solid #1e1e28",
    borderRadius: "12px",
    color: t.text,
    fontSize: "15px",
    fontFamily: font,
    outline: "none",
    WebkitAppearance: "none",
  },
  fileBtn: {
    padding: "12px 16px",
    background: t.inputBg,
    border: "1px dashed #2a2835",
    borderRadius: "12px",
    color: t.textSub,
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: font,
    textAlign: "center",
    WebkitTapHighlightColor: "transparent",
  },
  textarea: {
    padding: "14px 16px",
    background: t.inputBg,
    border: "1px solid #1e1e28",
    borderRadius: "12px",
    color: t.text,
    fontSize: "13px",
    fontFamily: mono,
    lineHeight: "1.8",
    minHeight: "160px",
    resize: "vertical",
    outline: "none",
    WebkitAppearance: "none",
    boxSizing: "border-box",
    width: "100%",
  },
  previewBox: {
    background: t.inputBg,
    border: "1px solid #1e1e28",
    borderRadius: "12px",
    padding: "14px 16px",
    marginBottom: "16px",
  },
  previewLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#a855f7",
    margin: "0 0 10px",
  },
  previewScroll: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  previewItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  previewWord: {
    fontSize: "13px",
    fontWeight: "600",
    color: t.text,
    fontFamily: mono,
  },
  previewMeaning: {
    fontSize: "12px",
    color: t.textMuted,
    textAlign: "right",
  },
  previewMore: {
    fontSize: "12px",
    color: t.textFaint,
    margin: "4px 0 0",
    textAlign: "center",
  },
  importHint: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "12px 14px",
    background: "rgba(168, 85, 247, 0.04)",
    border: "1px solid rgba(168, 85, 247, 0.08)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "#7a7688",
    lineHeight: "1.6",
    marginBottom: "20px",
  },

  // ── Study ──
  studyPage: {
    maxWidth: "500px",
    margin: "0 auto",
    padding: "12px 16px env(safe-area-inset-bottom, 16px)",
    minHeight: "100vh",
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    touchAction: "none",
    overscrollBehavior: "none",
  },
  studyNav: {
    paddingTop: "env(safe-area-inset-top, 8px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  studyMeta: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  roundLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#c084fc",
    fontFamily: mono,
    padding: "3px 8px",
    background: "rgba(192, 132, 252, 0.08)",
    borderRadius: "6px",
  },
  cardCount: {
    fontSize: "13px",
    fontWeight: "600",
    color: t.textMuted,
    fontFamily: mono,
  },
  progressTrack: {
    width: "100%",
    height: "2px",
    background: "#22222e",
    borderRadius: "1px",
    marginBottom: "20px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #a855f7, #c084fc)",
    borderRadius: "1px",
    transition: "width 0.3s ease",
  },
  swipeIndicator: {
    position: "fixed",
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    fontWeight: "600",
    transition: "opacity 0.1s",
    pointerEvents: "none",
    zIndex: 10,
  },
  swipeRight: {
    right: "12px",
    color: "#4ade80",
  },
  swipeLeft: {
    left: "12px",
    color: "#f87171",
  },
  swipeIcon: {
    fontSize: "40px",
    fontWeight: "300",
  },
  cardArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    perspective: "1200px",
    touchAction: "none",
  },
  stackContainer: {
    width: "100%",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stackCard: {
    position: "absolute",
    width: "100%",
    willChange: "transform",
    transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
  },
  stackBgCard: {
    background: "#131319",
    border: "1px solid #1a1a24",
  },
  flipContainer: {
    width: "100%",
    position: "relative",
  },
  flipInner: {
    width: "100%",
    transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
    transformStyle: "preserve-3d",
    position: "relative",
  },
  flipFace: {
    width: "100%",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  },
  flipBack: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    transform: "rotateY(180deg)",
  },
  card: {
    width: "100%",
    height: "440px",
    background: t.surface,
    border: "1px solid #2e2e40",
    borderRadius: "20px",
    padding: "40px 28px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "24px",
    boxSizing: "border-box",
    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
    overflow: "hidden",
  },
  exampleArea: {},
  exampleSentence: {
    fontSize: "20px",
    fontWeight: "500",
    lineHeight: "1.7",
    color: "#c8c5be",
    margin: 0,
  },
  highlight: {
    color: t.highlightText,
    fontWeight: "700",
    borderBottom: "2px solid rgba(168, 85, 247, 0.3)",
    paddingBottom: "1px",
  },
  cardDivider: {
    width: "100%",
    height: "1px",
    background: "linear-gradient(90deg, transparent, #2a2835, transparent)",
  },
  answerArea: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  wordMeaning: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  answerWord: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#c084fc",
    fontFamily: mono,
    letterSpacing: "0.5px",
  },
  answerMeaningText: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#f0ecf9",
    lineHeight: "1.4",
  },
  answerTranslation: {
    fontSize: "14px",
    color: t.textMuted,
    lineHeight: "1.8",
    margin: 0,
    padding: "2px 0 2px 14px",
    borderLeft: "2px solid #2a2835",
  },
  answerNote: {
    fontSize: "12px",
    color: "#7a7688",
    lineHeight: "1.7",
    margin: 0,
    padding: "10px 14px",
    background: "rgba(168, 85, 247, 0.04)",
    border: "1px solid rgba(168, 85, 247, 0.08)",
    borderRadius: "8px",
  },
  tapHint: {
    fontSize: "12px",
    color: t.textMuted,
    textAlign: "center",
    margin: "8px 0 0",
    letterSpacing: "0.5px",
  },
  swipeInstruction: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 4px",
  },
  swipeInstructLeft: {
    fontSize: "11px",
    color: t.textMuted,
  },
  swipeInstructRight: {
    fontSize: "11px",
    color: t.textMuted,
  },
  unknownBadge: {
    textAlign: "center",
    fontSize: "12px",
    color: t.textMuted,
    padding: "8px",
    background: "rgba(248, 113, 113, 0.04)",
    borderRadius: "8px",
    border: "1px solid rgba(248, 113, 113, 0.08)",
  },

  // ── Result ──
  resultContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "24px",
  },
  checkCircle: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "rgba(74, 222, 128, 0.06)",
    border: "1.5px solid rgba(74, 222, 128, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "32px",
    color: "#4ade80",
  },
  resultTitle: {
    fontSize: "22px",
    fontWeight: "700",
    margin: 0,
    color: t.text,
  },
  resultStats: {
    display: "flex",
    gap: "12px",
    width: "100%",
    maxWidth: "360px",
  },
  statBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "18px 12px",
    background: t.inputBg,
    borderRadius: "14px",
    border: "1px solid #1e1e28",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: "700",
    fontFamily: mono,
    color: t.text,
  },
  statLabel: {
    fontSize: "10px",
    color: t.textMuted,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  resultBtns: {
    width: "100%",
    maxWidth: "360px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "8px",
  },

  // ── Modal ──
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: "24px",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  modal: {
    width: "100%",
    maxWidth: "320px",
    background: t.surface,
    border: "1px solid #2e2e40",
    borderRadius: "18px",
    padding: "28px 24px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  modalTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: t.text,
    margin: 0,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: "13px",
    color: t.textMuted,
    margin: "0 0 12px",
    textAlign: "center",
    lineHeight: "1.5",
  },
  modalActions: {
    display: "flex",
    gap: "8px",
  },
  modalCancelBtn: {
    flex: 1,
    padding: "13px",
    background: "linear-gradient(135deg, #a855f7, #7c3aed)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: font,
    WebkitTapHighlightColor: "transparent",
  },
  modalConfirmBtn: {
    flex: 1,
    padding: "13px",
    background: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    borderRadius: "12px",
    color: "#f87171",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: font,
    WebkitTapHighlightColor: "transparent",
  },
}; }

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
