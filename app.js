// app.js

// ----------------------------------------------------
// 1. STATE & CONSTANTS
// ----------------------------------------------------
let state = {
  words: [],
  history: {
    lastStudiedDate: null,
    streak: 0,
    activity: {} // { "2026-07-12": 15, ... }
  },
  currentSession: {
    mode: null, // 'morning' | 'afternoon' | 'evening' | 'night'
    words: [],
    currentIndex: 0,
    wrongList: [] // For night mode loop
  },
  // Drag state for swipe
  drag: {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    element: null
  },
  // Autoplay state for Morning Mode
  autoplay: {
    intervalId: null,
    playing: false
  }
};

// LocalStorage Keys
const STORAGE_WORDS_KEY = 'kyousei_vocab_words';
const STORAGE_HISTORY_KEY = 'kyousei_vocab_history';

// ----------------------------------------------------
// 2. INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initLucide();
  loadDataFromStorage();
  determineTheme();
  setupEventListeners();
  renderDashboard();
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function loadDataFromStorage() {
  try {
    const rawWords = localStorage.getItem(STORAGE_WORDS_KEY);
    const rawHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
    
    if (rawWords) {
      state.words = JSON.parse(rawWords);
    }
    if (rawHistory) {
      state.history = JSON.parse(rawHistory);
    }
    
    // Auto-load default vocabulary if database is empty
    if (!state.words || state.words.length === 0) {
      loadDefaultWords();
    } else {
      repairSectionIdsIfNeeded();
    }
  } catch (e) {
    console.error('LocalStorageの読み込みに失敗しました', e);
  }
}

function loadDefaultWords() {
  Papa.parse('target1900_words.csv', {
    download: true,
    header: false,
    skipEmptyLines: true,
    complete: function(results) {
      processImportedData(results.data, true);
    },
    error: function(err) {
      console.error('デフォルト単語データの自動読み込みに失敗しました:', err);
    }
  });
}

function repairSectionIdsIfNeeded() {
  if (!state.words || state.words.length === 0) return;
  
  const hasInvalidSection = state.words.some(w => w.section_id > 19);
  if (!hasInvalidSection) return;
  
  console.log('検出：無効なセクションIDが存在します。自動修復を開始します...');
  
  Papa.parse('target1900_words.csv', {
    download: true,
    header: false,
    skipEmptyLines: true,
    complete: function(results) {
      const rows = results.data;
      if (rows.length === 0) return;
      
      let startIdx = 0;
      if (rows[0][0].includes('番号') || rows[0][0].includes('セクション') || rows[0][1].toLowerCase().includes('word') || rows[0][1].includes('単語')) {
        startIdx = 1;
      }
      
      const wordToSectionMap = {};
      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 3) continue;
        const col1 = parseInt(row[0].trim(), 10);
        const wordStr = row[1].trim();
        const sectionId = Math.floor((col1 - 1) / 100) + 1;
        wordToSectionMap[wordStr] = sectionId;
      }
      
      let repairedCount = 0;
      state.words.forEach(w => {
        const correctSectionId = wordToSectionMap[w.word];
        if (correctSectionId && w.section_id !== correctSectionId) {
          w.section_id = correctSectionId;
          w.id = `${correctSectionId}-${w.word}`;
          repairedCount++;
        }
      });
      
      if (repairedCount > 0) {
        console.log(`自動修復完了：${repairedCount}単語のセクションIDを修正しました。`);
        saveDataToStorage();
        renderDashboard();
      }
    },
    error: function(err) {
      console.error('セクション修復用データの読み込みに失敗しました:', err);
    }
  });
}

function saveDataToStorage() {
  try {
    localStorage.setItem(STORAGE_WORDS_KEY, JSON.stringify(state.words));
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(state.history));
  } catch (e) {
    console.error('LocalStorageの保存に失敗しました', e);
  }
}

function getTodayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ----------------------------------------------------
// 3. THEME MANAGEMENT
// ----------------------------------------------------
function determineTheme() {
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleTheme() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.theme = 'light';
  } else {
    document.documentElement.classList.add('dark');
    localStorage.theme = 'dark';
  }
}

// ----------------------------------------------------
// 4. ROUTING & VIEW CONTROLLER
// ----------------------------------------------------
function showView(viewId) {
  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-study').classList.add('hidden');
  document.getElementById('view-import').classList.add('hidden');
  
  document.getElementById(viewId).classList.remove('hidden');
  
  if (viewId === 'view-dashboard') {
    renderDashboard();
  }
}

// ----------------------------------------------------
// 5. DASHBOARD RENDERER
// ----------------------------------------------------
function renderDashboard() {
  updateStreakAndCounts();
  renderOverallProgress();
  renderSectionProgressList();
  renderHeatmap();
  initLucide();
}

function updateStreakAndCounts() {
  const total = state.words.length;
  const mastered = state.words.filter(w => w.status === 'mastered').length;
  
  document.getElementById('txt-streak-count').textContent = state.history.streak || 0;
  document.getElementById('txt-mastered-count').textContent = mastered;
  document.getElementById('txt-total-count').textContent = `/ ${total}語`;
}

function renderOverallProgress() {
  const total = state.words.length;
  if (total === 0) {
    document.getElementById('txt-progress-percentage').textContent = '0%';
    document.getElementById('bar-mastered').style.width = '0%';
    document.getElementById('bar-learning').style.width = '0%';
    return;
  }
  
  const mastered = state.words.filter(w => w.status === 'mastered').length;
  const learning = state.words.filter(w => w.status === 'learning').length;
  
  const masteredPct = (mastered / total) * 100;
  const learningPct = (learning / total) * 100;
  
  document.getElementById('txt-progress-percentage').textContent = `${Math.round(masteredPct)}%`;
  document.getElementById('bar-mastered').style.width = `${masteredPct}%`;
  document.getElementById('bar-learning').style.width = `${learningPct}%`;
}

function renderSectionProgressList() {
  const container = document.getElementById('list-sections-progress');
  container.innerHTML = '';
  
  // Section IDs 1 to 19 (Target 1900 assumption, 100 words per section)
  const totalSections = 19;
  
  for (let s = 1; s <= totalSections; s++) {
    const secWords = state.words.filter(w => w.section_id === s);
    const secTotal = secWords.length;
    const secMastered = secWords.filter(w => w.status === 'mastered').length;
    
    let pct = 0;
    if (secTotal > 0) {
      pct = Math.round((secMastered / secTotal) * 100);
    }
    
    // Determine color based on progress
    let colorClass = 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    if (secTotal > 0) {
      if (pct === 100) {
        colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900';
      } else if (pct > 50) {
        colorClass = 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-900';
      } else if (pct > 0) {
        colorClass = 'bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-950/30 dark:text-brand-400 dark:border-brand-900/40';
      }
    }
    
    const badge = document.createElement('div');
    badge.className = `border text-[10px] font-bold py-1 px-1.5 rounded-lg text-center flex flex-col justify-center transition-all ${colorClass}`;
    badge.innerHTML = `
      <span>S${s}</span>
      <span class="text-[9px] opacity-80">${secTotal > 0 ? pct + '%' : '未登録'}</span>
    `;
    container.appendChild(badge);
  }
}

function renderHeatmap() {
  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';
  
  const today = new Date();
  const daysToShow = 35; // 5 weeks
  
  // Align start to the Sunday 5 weeks ago
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysToShow + 1);
  
  // Draw cell for each day
  for (let i = 0; i < daysToShow; i++) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const count = state.history.activity[dateStr] || 0;
    
    let colorClass = 'bg-slate-100 dark:bg-slate-800';
    if (count > 20) {
      colorClass = 'bg-emerald-600 dark:bg-emerald-500';
    } else if (count > 10) {
      colorClass = 'bg-emerald-400 dark:bg-emerald-700';
    } else if (count > 0) {
      colorClass = 'bg-emerald-200 dark:bg-emerald-900/50';
    }
    
    const cell = document.createElement('div');
    cell.className = `w-2.5 h-2.5 rounded-sm transition-all ${colorClass}`;
    cell.title = `${dateStr} : ${count}単語学習`;
    grid.appendChild(cell);
  }
}

// ----------------------------------------------------
// 6. CSV PARSING & DATA MANAGEMENT
// ----------------------------------------------------
function handleCSVImport(file) {
  if (!file) return;
  
  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: function(results) {
      processImportedData(results.data);
    },
    error: function(err) {
      alert('CSVの解析に失敗しました: ' + err.message);
    }
  });
}

function processImportedData(rows, isSilent = false) {
  if (rows.length === 0) return;
  
  // Skip header if matches
  let startIdx = 0;
  const firstRow = rows[0];
  if (firstRow[0].includes('番号') || firstRow[0].includes('セクション') || firstRow[1].toLowerCase().includes('word') || firstRow[1].includes('単語')) {
    startIdx = 1;
  }
  
  // Detect if the first column contains serial numbers (1-1900) or section IDs (1-19)
  let isSerialNumber = false;
  
  // 1. Check header if available
  if (firstRow && firstRow[0]) {
    const headerText = firstRow[0].trim();
    if (headerText === '番号' || headerText.toLowerCase() === 'no' || headerText.toLowerCase() === 'id') {
      isSerialNumber = true;
    } else if (headerText.includes('セクション') || headerText.toLowerCase().includes('section')) {
      isSerialNumber = false;
    }
  }
  
  // 2. If header auto-detection wasn't definitive, scan values
  if (!isSerialNumber) {
    let hasValGreaterThan19 = false;
    let hasDuplicates = false;
    const seenValues = new Set();
    
    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 1) continue;
      const val = parseInt(row[0].trim(), 10);
      if (!isNaN(val)) {
        if (val > 19) {
          hasValGreaterThan19 = true;
        }
        if (seenValues.has(val)) {
          hasDuplicates = true;
        }
        seenValues.add(val);
      }
    }
    
    if (hasValGreaterThan19) {
      isSerialNumber = true;
    } else if (!hasDuplicates && seenValues.size > 1) {
      isSerialNumber = true;
    }
  }
  
  let addedCount = 0;
  const newWords = [];
  
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;
    
    const col1 = parseInt(row[0].trim(), 10); // Section ID or Word Number
    const wordStr = row[1].trim();
    const meaningStr = row[2].trim();
    
    // Optional extended columns (Part of speech, Example sentence, Example translation)
    const partOfSpeechStr = row[3] ? row[3].trim() : '';
    const exampleStr = row[4] ? row[4].trim() : '';
    const exampleMeaningStr = row[5] ? row[5].trim() : '';
    
    if (!wordStr || !meaningStr) continue;
    
    // Auto-detect section_id
    let sectionId = 1;
    if (isSerialNumber) {
      // It is a serial number (1-1900)
      sectionId = Math.floor((col1 - 1) / 100) + 1;
    } else {
      // It is a section ID (1-19)
      sectionId = col1;
    }
    
    // Fallback if NaN
    if (isNaN(sectionId)) sectionId = 1;
    
    newWords.push({
      id: `${sectionId}-${wordStr}`,
      word: wordStr,
      meaning: meaningStr,
      section_id: sectionId,
      status: 'new',
      lastStudiedDate: null,
      
      // Study statistics
      correctCount: 0,
      mistakeCount: 0,
      reviewCount: 0,
      
      // Forgetting curve metrics (SM-2)
      interval: 0,
      easeFactor: 2.5,
      reps: 0,
      nextReviewDate: null,
      
      // User memo
      memo: '',
      
      // Extended vocabulary details
      partOfSpeech: partOfSpeechStr,
      example: exampleStr,
      exampleMeaning: exampleMeaningStr
    });
    addedCount++;
  }
  
  if (newWords.length > 0) {
    // Merge: If word ID exists, update meaning/details but preserve statistics and memo
    newWords.forEach(nw => {
      const existsIdx = state.words.findIndex(w => w.id === nw.id);
      if (existsIdx === -1) {
        state.words.push(nw);
      } else {
        const existing = state.words[existsIdx];
        existing.meaning = nw.meaning;
        if (nw.partOfSpeech) existing.partOfSpeech = nw.partOfSpeech;
        if (nw.example) existing.example = nw.example;
        if (nw.exampleMeaning) existing.exampleMeaning = nw.exampleMeaning;
        
        // Data migration / safe-guards for existing users
        if (existing.correctCount === undefined) existing.correctCount = 0;
        if (existing.mistakeCount === undefined) existing.mistakeCount = 0;
        if (existing.reviewCount === undefined) existing.reviewCount = 0;
        if (existing.interval === undefined) existing.interval = 0;
        if (existing.easeFactor === undefined) existing.easeFactor = 2.5;
        if (existing.reps === undefined) existing.reps = 0;
        if (existing.nextReviewDate === undefined) existing.nextReviewDate = null;
        if (existing.memo === undefined) existing.memo = '';
      }
    });
    
    saveDataToStorage();
    showImportStats();
    if (!isSilent) {
      alert(`${addedCount}語のデータをインポートしました！`);
    }
    renderDashboard();
  }
}

function loadDemoData() {
  const demo = [];
  // Section 1: 100 words (subset)
  const sampleWords = [
    { word: "create", meaning: "を創り出す；を引き起こす", partOfSpeech: "動詞", example: "He wants to create a new website.", exampleMeaning: "彼は新しいウェブサイトを立ち上げたいと思っている。" },
    { word: "increase", meaning: "増加する；を増やす", partOfSpeech: "動詞", example: "The population continues to increase.", exampleMeaning: "人口は増加し続けている。" },
    { word: "improve", meaning: "を向上させる；よくなる", partOfSpeech: "動詞", example: "I need to improve my English speaking skills.", exampleMeaning: "英語を話すスキルを向上させる必要がある。" },
    { word: "mean", meaning: "を意味する；つもりである", partOfSpeech: "動詞", example: "What does this word mean?", exampleMeaning: "この単語はどういう意味ですか？" },
    { word: "own", meaning: "を所有している；を認める", partOfSpeech: "動詞", example: "They own a beautiful house by the lake.", exampleMeaning: "彼らは湖のそばに美しい家を所有している。" },
    { word: "include", meaning: "を含む", partOfSpeech: "動詞", example: "Does the price include tax?", exampleMeaning: "価格に税金は含まれていますか？" },
    { word: "consider", meaning: "を見なす；について考える", partOfSpeech: "動詞", example: "Please consider my proposal.", exampleMeaning: "私の提案を検討してください。" },
    { word: "allow", meaning: "を許す；を与える", partOfSpeech: "動詞", example: "Smoking is not allowed inside.", exampleMeaning: "館内での喫煙は許可されていません。" },
    { word: "suggest", meaning: "を提案する；を暗示する", partOfSpeech: "動詞", example: "She suggested going to the park.", exampleMeaning: "彼女は公園に行くことを提案した。" },
    { word: "produce", meaning: "を生産する；を取り出す", partOfSpeech: "動詞", example: "The factory produces thousands of cars a day.", exampleMeaning: "その工場は1日に何千台もの車を生産している。" }
  ];
  
  sampleWords.forEach((item, index) => {
    demo.push({
      id: `1-${item.word}`,
      word: item.word,
      meaning: item.meaning,
      section_id: 1,
      status: 'new',
      lastStudiedDate: null,
      
      // Study statistics
      correctCount: 0,
      mistakeCount: 0,
      reviewCount: 0,
      
      // Forgetting curve metrics (SM-2)
      interval: 0,
      easeFactor: 2.5,
      reps: 0,
      nextReviewDate: null,
      
      // User memo
      memo: '',
      
      // Extended details
      partOfSpeech: item.partOfSpeech || '',
      example: item.example || '',
      exampleMeaning: item.exampleMeaning || ''
    });
  });
  
  state.words = demo;
  saveDataToStorage();
  showImportStats();
  alert('デモデータをロードしました！ (セクション1: 10単語 - 例文付き)');
  renderDashboard();
}

function clearDatabase() {
  if (confirm('すべての登録データを削除しますか？学習履歴もリセットされます。')) {
    state.words = [];
    state.history = { lastStudiedDate: null, streak: 0, activity: {} };
    saveDataToStorage();
    showImportStats();
    renderDashboard();
  }
}

function showImportStats() {
  const box = document.getElementById('import-stats-box');
  if (state.words.length > 0) {
    box.classList.remove('hidden');
    document.getElementById('txt-import-total').textContent = state.words.length;
    
    const uniqueSecs = [...new Set(state.words.map(w => w.section_id))].length;
    document.getElementById('txt-import-sections').textContent = uniqueSecs;
    
    const mastered = state.words.filter(w => w.status === 'mastered').length;
    document.getElementById('txt-import-mastered').textContent = mastered;
  } else {
    box.classList.add('hidden');
  }
}

// ----------------------------------------------------
// 6.5. DEVICE SYNC (EXPORT/IMPORT BY CODE)
// ----------------------------------------------------
function encodeStatuses(words) {
  // Convert word status to a bitmask representation
  // 1900 words, 4 words per byte = 475 bytes
  const bytes = new Uint8Array(475);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const statusVal = word.status === 'mastered' ? 2 : (word.status === 'learning' ? 1 : 0);
    const byteIndex = Math.floor(i / 4);
    const bitOffset = (i % 4) * 2;
    bytes[byteIndex] |= (statusVal << bitOffset);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeStatuses(base64Str, words) {
  const binary = atob(base64Str);
  let updatedCount = 0;
  for (let i = 0; i < words.length; i++) {
    const byteIndex = Math.floor(i / 4);
    if (byteIndex >= binary.length) break;
    const byteVal = binary.charCodeAt(byteIndex);
    const bitOffset = (i % 4) * 2;
    const statusVal = (byteVal >> bitOffset) & 3;
    
    const newStatus = statusVal === 2 ? 'mastered' : (statusVal === 1 ? 'learning' : 'new');
    
    // Status hierarchy rank
    const currentRank = words[i].status === 'mastered' ? 2 : (words[i].status === 'learning' ? 1 : 0);
    if (statusVal > currentRank) {
      words[i].status = newStatus;
      words[i].lastStudiedDate = getTodayString(); // Mark as studied today if progress advanced
      updatedCount++;
    }
  }
  return updatedCount;
}

function generateSyncCode() {
  if (state.words.length === 0) {
    alert('同期する単語データがありません。');
    return null;
  }
  
  const payload = {
    s: encodeStatuses(state.words),
    h: {
      s: state.history.streak,
      d: state.history.lastStudiedDate,
      a: state.history.activity
    },
    t: Date.now()
  };
  
  const jsonStr = JSON.stringify(payload);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < utf8Bytes.byteLength; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary);
}

function applySyncCode(base64Str) {
  try {
    const binary = atob(base64Str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const payload = JSON.parse(jsonStr);
    
    if (!payload.s || !payload.h) {
      throw new Error('同期データのフォーマットが正しくありません。');
    }
    
    // Ensure words exist
    if (state.words.length === 0) {
      loadDefaultWords();
    }
    
    // Decode word statuses
    const updatedCount = decodeStatuses(payload.s, state.words);
    
    // Merge history streak
    if (payload.h.s > state.history.streak) {
      state.history.streak = payload.h.s;
    }
    
    // Merge lastStudiedDate
    if (payload.h.d) {
      if (!state.history.lastStudiedDate || payload.h.d > state.history.lastStudiedDate) {
        state.history.lastStudiedDate = payload.h.d;
      }
    }
    
    // Merge activity
    if (payload.h.a) {
      for (const [date, count] of Object.entries(payload.h.a)) {
        state.history.activity[date] = Math.max(state.history.activity[date] || 0, count);
      }
    }
    
    saveDataToStorage();
    showImportStats();
    renderDashboard();
    
    alert(`同期が成功しました！\n${updatedCount}語の進捗と学習履歴を同期・マージしました。`);
    return true;
  } catch (err) {
    alert('同期データの適用に失敗しました。無効なコードかコピーが不完全な可能性があります。\nエラー: ' + err.message);
    return false;
  }
}


// ----------------------------------------------------
// 7. STUDY CYCLE CONTROLLER (Morning, Afternoon, Evening, Night)
// ----------------------------------------------------
function startStudySession(mode) {
  if (state.words.length === 0) {
    alert('単語データが登録されていません。まずはCSVインポートまたはデモデータのロードを行ってください。');
    showView('view-import');
    return;
  }
  
  state.currentSession.mode = mode;
  state.currentSession.currentIndex = 0;
  state.currentSession.wrongList = [];
  
  let targetWords = [];
  let modeTitle = '学習セッション';
  let modeDesc = '';
  
  const today = getTodayString();
  
  switch(mode) {
    case 'morning':
      // 朝: 新規単語(new)の閲覧（ランダムに15単語）
      modeTitle = '【朝】新規単語の閲覧';
      modeDesc = '発音を聞きながら意味を素早くインプット';
      
      const newWords = state.words.filter(w => w.status === 'new');
      if (newWords.length > 0) {
        targetWords = shuffleArray(newWords).slice(0, 15);
      } else {
        // 新規がない場合は学習中や全体からランダム
        targetWords = shuffleArray(state.words).slice(0, 15);
      }
      break;
      
    case 'afternoon':
      // 昼: 今日の復習予定単語 ＆ 学習中単語をミックスして出題
      modeTitle = '【昼】仕分けテスト';
      modeDesc = '左右スワイプで仕分け (右:わかる / 左:わからない)';
      
      // 1. 今日の復習が必要な既習単語 (nextReviewDate <= today)
      const reviewPending = state.words.filter(w => 
        w.status === 'mastered' && 
        w.nextReviewDate && 
        w.nextReviewDate <= today
      );
      
      // 2. 学習中の単語
      const learningWords = state.words.filter(w => w.status === 'learning');
      
      // 3. 不足分を補う新規単語
      const newForAfternoon = state.words.filter(w => w.status === 'new');
      
      // マージしてシャッフル
      let merged = [...reviewPending, ...learningWords];
      merged = shuffleArray(merged);
      
      // 20語に満たない場合は新規を足す
      if (merged.length < 20 && newForAfternoon.length > 0) {
        const shuffledNew = shuffleArray(newForAfternoon);
        const needed = 20 - merged.length;
        merged = [...merged, ...shuffledNew.slice(0, needed)];
      }
      
      targetWords = merged.slice(0, 20);
      
      // Fallback
      if (targetWords.length === 0) {
        targetWords = shuffleArray(state.words).slice(0, 15);
      }
      break;
      
    case 'evening':
      // 夕方: 習得済み(mastered)から、特に復習期日を迎えたものを優先して出題
      modeTitle = '【夕方】過去の復習';
      modeDesc = '習得済みの記憶を間隔反復で定着確認';
      
      const masteredWords = state.words.filter(w => w.status === 'mastered');
      if (masteredWords.length === 0) {
        alert('習得済み(Mastered)の単語がありません。まずは昼のテストで仕分けてください。');
        return;
      }
      
      // 復習期日を迎えているもの（nextReviewDateが無い、または今日以前のもの）
      const dueMastered = masteredWords.filter(w => !w.nextReviewDate || w.nextReviewDate <= today);
      // まだ期日でないもの
      const notDueMastered = masteredWords.filter(w => w.nextReviewDate && w.nextReviewDate > today);
      
      let eveningList = shuffleArray(dueMastered);
      
      // 15語に満たない場合は、他の習得済みから補充
      if (eveningList.length < 15 && notDueMastered.length > 0) {
        const extra = shuffleArray(notDueMastered);
        eveningList = [...eveningList, ...extra.slice(0, 15 - eveningList.length)];
      }
      
      targetWords = eveningList.slice(0, 15);
      break;
      
    case 'night':
      // 夜: 「学習中(learning)」の単語のみをサドンデス形式で（シャッフルして出題）
      modeTitle = '【夜】今日の総復習';
      modeDesc = '間違えた単語のサドンデスループ';
      
      const nightLearning = state.words.filter(w => w.status === 'learning');
      if (nightLearning.length === 0) {
        alert('現在「学習中(Learning)」の単語はありません！');
        return;
      }
      targetWords = shuffleArray(nightLearning);
      break;
  }
  
  state.currentSession.words = targetWords;
  showView('view-study');
  
  // Render headers
  document.getElementById('txt-study-title').textContent = modeTitle;
  document.getElementById('txt-study-mode-desc').textContent = modeDesc;
  
  // Stop any active autoplay on session start
  stopAutoplay();

  // Adjust control buttons dynamically based on mode
  const btnNo = document.getElementById('btn-action-no');
  const btnYes = document.getElementById('btn-action-yes');
  
  if (mode === 'morning') {
    // Morning Mode: Left button -> Autoplay Start/Pause, Right button -> Next card
    btnNo.innerHTML = `<svg class="w-6 h-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    btnNo.title = "オートプレイ開始";
    btnNo.className = "w-12 h-12 rounded-full border border-amber-200 dark:border-amber-900/30 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 flex items-center justify-center transition-all shadow-sm active:scale-90";
    
    btnYes.innerHTML = `<svg class="w-6 h-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
    btnYes.title = "次の単語";
    btnYes.className = "w-12 h-12 rounded-full border border-amber-200 dark:border-amber-900/30 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 flex items-center justify-center transition-all shadow-sm active:scale-90";
  } else {
    // Default Mode: Left button -> Dislike (red X), Right button -> Like (green check)
    btnNo.innerHTML = `<svg class="w-6 h-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    btnNo.title = "わからない";
    btnNo.className = "w-12 h-12 rounded-full border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center justify-center transition-all shadow-sm active:scale-90";
    
    btnYes.innerHTML = `<svg class="w-6 h-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    btnYes.title = "わかる";
    btnYes.className = "w-12 h-12 rounded-full border border-emerald-200 dark:border-emerald-900/30 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center justify-center transition-all shadow-sm active:scale-90";
  }

  // Show first card
  renderCurrentCard();
}

function renderCurrentCard() {
  const session = state.currentSession;
  const arena = document.getElementById('card-arena');
  
  // Clear old cards (except empty state)
  const cards = arena.querySelectorAll('.study-card');
  cards.forEach(c => c.remove());
  
  const total = session.words.length;
  const current = session.currentIndex;
  
  if (current >= total) {
    // Session completed!
    handleSessionComplete();
    return;
  }
  
  document.getElementById('arena-empty-state').classList.add('hidden');
  document.getElementById('txt-study-progress').textContent = `${current + 1}/${total}`;
  document.getElementById('bar-study-progress').style.width = `${((current) / total) * 100}%`;
  
  const word = session.words[current];
  
  // Create card element
  const card = document.createElement('div');
  card.className = 'study-card absolute inset-0 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-lg cursor-pointer transform origin-bottom transition-all select-none preserve-3d';
  
  card.innerHTML = `
    <!-- Front Face -->
    <div class="card-face-front absolute inset-0 flex flex-col justify-between p-6 backface-hidden">
      <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
        <span>SECTION ${word.section_id}</span>
        <span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 uppercase">${word.status}</span>
      </div>
      <div class="text-center py-10 flex-1 flex flex-col justify-center">
        <h2 class="text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none">${word.word}</h2>
        <span class="text-xs text-slate-400 mt-4 block">(タップして意味を表示)</span>
      </div>
      <div class="text-center text-[10px] text-slate-300">
        Swipe Left: ✕ | Swipe Right: ✓
      </div>
    </div>
    
    <!-- Back Face -->
    <div class="card-face-back absolute inset-0 flex flex-col justify-between p-5 rotate-y-180 backface-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-2 border-brand-500/20 rounded-3xl opacity-0 pointer-events-none overflow-y-auto">
      <div class="flex justify-between items-center text-[10px] font-bold text-brand-500">
        <span>MEANING & DETAILS</span>
        <button class="btn-card-tts p-1.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
          <svg class="w-4 h-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
        </button>
      </div>
      
      <div class="text-center py-3 flex-1 flex flex-col justify-center space-y-3">
        <div>
          ${word.partOfSpeech ? `<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 uppercase tracking-wider">${word.partOfSpeech}</span>` : ''}
          <p class="text-xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed mt-1 px-2">${word.meaning}</p>
        </div>
        
        <!-- Example sentence if available -->
        ${word.example ? `
        <div class="text-left bg-slate-100/50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
          <span class="text-[8px] font-bold text-slate-400 block mb-0.5">EXAMPLE</span>
          <p class="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">${word.example}</p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${word.exampleMeaning || ''}</p>
        </div>
        ` : ''}

        <!-- Study Stats -->
        <div class="grid grid-cols-3 gap-1 text-[9px] text-slate-500 dark:text-slate-400 bg-slate-100/40 dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
          <div>
            <span class="block text-[7px] text-slate-400">復習間隔</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">${word.interval || 0}日</span>
          </div>
          <div>
            <span class="block text-[7px] text-slate-400">正答率</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">${word.reviewCount ? Math.round((word.correctCount / word.reviewCount) * 100) : 0}%</span>
          </div>
          <div>
            <span class="block text-[7px] text-slate-400">予定日</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">${word.nextReviewDate ? word.nextReviewDate.slice(5) : '本日'}</span>
          </div>
        </div>

        <!-- Memo Area -->
        <div class="text-left space-y-0.5">
          <label class="text-[8px] font-bold text-slate-400 block">マイメモ (自動保存)</label>
          <textarea class="txt-card-memo w-full h-11 text-[11px] p-1.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none placeholder-slate-300 dark:placeholder-slate-700" placeholder="覚え方などをメモできます...">${word.memo || ''}</textarea>
        </div>
      </div>
      
      <div class="text-center text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
        スワイプして仕分ける
      </div>
    </div>

    <!-- Swipe overlays -->
    <div class="overlay-like absolute inset-0 bg-emerald-500/10 border-4 border-emerald-500 rounded-3xl flex items-center justify-center opacity-0 transition-opacity duration-100 backface-hidden pointer-events-none">
      <span class="text-2xl font-extrabold text-emerald-500 border-4 border-emerald-500 px-4 py-2 rounded-xl rotate-12">MASTERED</span>
    </div>
    <div class="overlay-nope absolute inset-0 bg-red-500/10 border-4 border-red-500 rounded-3xl flex items-center justify-center opacity-0 transition-opacity duration-100 backface-hidden pointer-events-none">
      <span class="text-2xl font-extrabold text-red-500 border-4 border-red-500 px-4 py-2 rounded-xl -rotate-12">LEARNING</span>
    </div>
  `;
  
  arena.appendChild(card);
  
  // Memo input handlers to prevent card flip or drag during typing
  const memoTextarea = card.querySelector('.txt-card-memo');
  if (memoTextarea) {
    const stopEvents = ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'touchmove'];
    stopEvents.forEach(evt => {
      memoTextarea.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
    });
    
    // Auto-save input to state & LocalStorage
    memoTextarea.addEventListener('input', (e) => {
      const targetWord = state.words.find(w => w.id === word.id);
      if (targetWord) {
        targetWord.memo = e.target.value;
        saveDataToStorage();
      }
    });
  }

  initLucide();
  
  // Setup drag & drop physics for the card
  setupDragHandlers(card);
  
  // TTS auto-play in morning mode
  if (session.mode === 'morning') {
    speakWord(word.word);
  }
}

function handleSessionComplete() {
  document.getElementById('arena-empty-state').classList.remove('hidden');
  document.getElementById('bar-study-progress').style.width = '100%';
  document.getElementById('txt-study-progress').textContent = '完了';
  
  // Custom text per mode
  const mode = state.currentSession.mode;
  let desc = 'お疲れ様でした！このセクションの学習が完了しました。';
  
  if (mode === 'night' && state.currentSession.wrongList.length > 0) {
    // Loop wrong answers in night mode
    desc = `総復習中：間違えた ${state.currentSession.wrongList.length} 語を再学習します。`;
    document.getElementById('txt-empty-desc').textContent = desc;
    
    // Create new loop
    setTimeout(() => {
      state.currentSession.words = [...state.currentSession.wrongList];
      state.currentSession.currentIndex = 0;
      state.currentSession.wrongList = [];
      renderCurrentCard();
    }, 1500);
    return;
  }
  
  document.getElementById('txt-empty-desc').textContent = desc;
  
  // Streak & activity record
  updateActivityHistory();
}

function updateActivityHistory() {
  const today = getTodayString();
  
  // Add to activity count
  const sessionCount = state.currentSession.words.length;
  state.history.activity[today] = (state.history.activity[today] || 0) + sessionCount;
  
  // Streak logic
  if (state.history.lastStudiedDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    
    if (state.history.lastStudiedDate === yesterdayStr) {
      state.history.streak += 1;
    } else if (state.history.streak === 0 || state.history.lastStudiedDate === null) {
      state.history.streak = 1;
    }
    state.history.lastStudiedDate = today;
  }
  
  saveDataToStorage();
}

// ----------------------------------------------------
// 8. TINDER SWIPE & CARD INTERACTION PHYSICS
// ----------------------------------------------------
function setupDragHandlers(card) {
  let isFlipped = false;
  let hasDragged = false;
  
  // Track start positions to filter tiny movements (clicks) from actual drags
  let startX = 0;
  let startY = 0;

  // Unified function to update style.transform
  const updateTransform = (x = 0, y = 0, r = 0) => {
    const flipRotation = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
    card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${r}deg) ${flipRotation}`;
    
    // Toggle opacity & pointer events to work around browser backface-visibility engine bugs
    const front = card.querySelector('.card-face-front');
    const back = card.querySelector('.card-face-back');
    if (front && back) {
      if (isFlipped) {
        front.style.opacity = '0';
        front.style.pointerEvents = 'none';
        back.style.opacity = '1';
        back.style.pointerEvents = 'auto';
      } else {
        front.style.opacity = '1';
        front.style.pointerEvents = 'auto';
        back.style.opacity = '0';
        back.style.pointerEvents = 'none';
      }
    }
  };

  // Expose flip toggle to external button clicks
  card.toggleFlip = () => {
    isFlipped = !isFlipped;
    updateTransform(0, 0, 0);
  };

  // Click handler for flips (highly reliable across all browsers/emulators)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.btn-card-tts')) return;
    
    if (hasDragged) {
      // Consume the click event if we were dragging
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    card.toggleFlip();
  });

  // TTS Speaker inside back card
  const ttsBtn = card.querySelector('.btn-card-tts');
  if (ttsBtn) {
    ttsBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid flipping when clicking audio
      const word = state.currentSession.words[state.currentSession.currentIndex];
      speakWord(word.word);
    });
  }

  // Pointer / Drag Events
  const startDrag = (x, y) => {
    state.drag.active = true;
    state.drag.startX = x;
    state.drag.startY = y;
    startX = x;
    startY = y;
    hasDragged = false;
    state.drag.element = card;
    card.classList.remove('card-drag-transition');
  };

  const moveDrag = (x, y) => {
    if (!state.drag.active) return;
    
    const diffX = x - state.drag.startX;
    const diffY = y - state.drag.startY;
    
    // If the movement is more than 8px, treat it as a drag
    if (Math.abs(x - startX) > 8 || Math.abs(y - startY) > 8) {
      hasDragged = true;
    }
    
    state.drag.currentX = diffX;
    state.drag.currentY = diffY;
    
    const rotate = diffX / 10;
    updateTransform(diffX, diffY, rotate);
    
    // Overlays opacity
    const overlayLike = card.querySelector('.overlay-like');
    const overlayNope = card.querySelector('.overlay-nope');
    
    if (diffX > 20) {
      overlayLike.style.opacity = Math.min(diffX / 100, 1);
      overlayNope.style.opacity = 0;
    } else if (diffX < -20) {
      overlayNope.style.opacity = Math.min(Math.abs(diffX) / 100, 1);
      overlayLike.style.opacity = 0;
    } else {
      overlayLike.style.opacity = 0;
      overlayNope.style.opacity = 0;
    }
  };

  const endDrag = () => {
    if (!state.drag.active) return;
    state.drag.active = false;
    
    const diffX = state.drag.currentX;
    const swipeThreshold = 100;
    
    card.classList.add('card-drag-transition');
    
    if (hasDragged && (diffX > swipeThreshold || diffX < -swipeThreshold)) {
      if (diffX > swipeThreshold) {
        // Swipe Right -> Mastered
        swipeCardOut('right');
      } else {
        // Swipe Left -> Learning
        swipeCardOut('left');
      }
    } else {
      // Bounce back to stable position
      updateTransform(0, 0, 0);
      const overlayLike = card.querySelector('.overlay-like');
      const overlayNope = card.querySelector('.overlay-nope');
      if (overlayLike) overlayLike.style.opacity = 0;
      if (overlayNope) overlayNope.style.opacity = 0;
      
      // Delay resetting hasDragged to let the click handler consume the drag click
      setTimeout(() => {
        hasDragged = false;
      }, 50);
    }
    
    state.drag.currentX = 0;
    state.drag.currentY = 0;
  };

  // Dynamic window listeners bound only during active drag
  const onMouseMove = (e) => {
    moveDrag(e.clientX, e.clientY);
  };
  
  const onMouseUp = () => {
    endDrag();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  // Mouse handlers
  card.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('.btn-card-tts')) return; // Left click only, avoid buttons
    startDrag(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Touch handlers (Touch events handle window scope via changedTouches/targetTouches natively)
  const onTouchMove = (e) => {
    if (!state.drag.active) return;
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  };

  const onTouchEnd = () => {
    endDrag();
    card.removeEventListener('touchmove', onTouchMove);
    card.removeEventListener('touchend', onTouchEnd);
  };

  card.addEventListener('touchstart', (e) => {
    if (e.target.closest('.btn-card-tts')) return;
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
    card.addEventListener('touchmove', onTouchMove);
    card.addEventListener('touchend', onTouchEnd);
  });
}

function swipeCardOut(direction) {
  const card = state.drag.element;
  if (!card) return;
  
  const currentWord = state.currentSession.words[state.currentSession.currentIndex];
  
  if (state.currentSession.mode === 'morning') {
    // Morning Mode: Swipe does not sort as learned/not-learned.
    // Both directions mean "viewed" and move it to 'learning' status for afternoon tests.
    card.classList.add(direction === 'right' ? 'card-swipe-out-right' : 'card-swipe-out-left');
    updateWordStatus(currentWord.id, 'learning');
  } else {
    // Standard sorting modes
    if (direction === 'right') {
      card.classList.add('card-swipe-out-right');
      recordStudyResult(currentWord.id, true);
    } else {
      card.classList.add('card-swipe-out-left');
      recordStudyResult(currentWord.id, false);
      
      // Add to wrong list for night mode cycle if active
      if (state.currentSession.mode === 'night') {
        state.currentSession.wrongList.push(currentWord);
      }
    }
  }

  // Load next card after swipe animation finishes
  setTimeout(() => {
    state.currentSession.currentIndex++;
    renderCurrentCard();
  }, 300);
}

function updateWordStatus(wordId, status) {
  const word = state.words.find(w => w.id === wordId);
  if (word) {
    word.status = status;
    word.lastStudiedDate = getTodayString();
    
    // Safe initialization
    if (word.correctCount === undefined) word.correctCount = 0;
    if (word.mistakeCount === undefined) word.mistakeCount = 0;
    if (word.reviewCount === undefined) word.reviewCount = 0;
    if (word.interval === undefined) word.interval = 0;
    if (word.easeFactor === undefined) word.easeFactor = 2.5;
    if (word.reps === undefined) word.reps = 0;
    if (word.memo === undefined) word.memo = '';
    
    saveDataToStorage();
  }
}

function recordStudyResult(wordId, isCorrect) {
  const word = state.words.find(w => w.id === wordId);
  if (!word) return;

  const todayStr = getTodayString();
  
  // Safe initialization
  if (word.correctCount === undefined) word.correctCount = 0;
  if (word.mistakeCount === undefined) word.mistakeCount = 0;
  if (word.reviewCount === undefined) word.reviewCount = 0;
  if (word.interval === undefined) word.interval = 0;
  if (word.easeFactor === undefined) word.easeFactor = 2.5;
  if (word.reps === undefined) word.reps = 0;
  if (word.memo === undefined) word.memo = '';

  word.reviewCount++;
  word.lastStudiedDate = todayStr;

  if (isCorrect) {
    word.correctCount++;
    word.status = 'mastered';
    word.reps++;
    
    // Calculate memory interval
    if (word.reps === 1) {
      word.interval = 1; // 1 day
    } else if (word.reps === 2) {
      word.interval = 4; // 4 days
    } else {
      word.interval = Math.round(word.interval * word.easeFactor);
    }
    
    // Increase ease factor slightly
    word.easeFactor = Math.min(2.5, word.easeFactor + 0.1);
  } else {
    word.mistakeCount++;
    word.status = 'learning';
    word.reps = 0;
    word.interval = 1; // Review next day
    
    // Decrease ease factor
    word.easeFactor = Math.max(1.3, word.easeFactor - 0.2);
  }

  // Calculate next review date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + word.interval);
  const y = nextDate.getFullYear();
  const m = String(nextDate.getMonth() + 1).padStart(2, '0');
  const d = String(nextDate.getDate()).padStart(2, '0');
  word.nextReviewDate = `${y}-${m}-${d}`;

  saveDataToStorage();
}

// Autoplay controllers for Morning Mode
function toggleAutoplay() {
  if (state.autoplay.playing) {
    stopAutoplay();
  } else {
    startAutoplay();
  }
}

function startAutoplay() {
  if (state.autoplay.playing) return;
  state.autoplay.playing = true;
  
  const btnNo = document.getElementById('btn-action-no');
  btnNo.innerHTML = `<svg class="w-6 h-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
  btnNo.title = "一時停止";
  
  let phase = 0; // 0: show word -> show meaning, 1: show meaning -> next word
  
  state.autoplay.intervalId = setInterval(() => {
    const activeCard = document.querySelector('.study-card');
    if (!activeCard) {
      stopAutoplay();
      return;
    }
    
    if (phase === 0) {
      // Flip to show meaning
      if (typeof activeCard.toggleFlip === 'function') {
        activeCard.toggleFlip();
      }
      phase = 1;
    } else {
      // Go to next card
      phase = 0;
      state.drag.element = activeCard;
      swipeCardOut('right');
    }
  }, 1500);
}

function stopAutoplay() {
  state.autoplay.playing = false;
  if (state.autoplay.intervalId) {
    clearInterval(state.autoplay.intervalId);
    state.autoplay.intervalId = null;
  }
  const btnNo = document.getElementById('btn-action-no');
  if (btnNo && state.currentSession.mode === 'morning') {
    btnNo.innerHTML = `<svg class="w-6 h-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    btnNo.title = "オートプレイ開始";
  }
}

function speakWord(text) {
  if ('speechSynthesis' in window) {
    // Cancel active speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}

// ----------------------------------------------------
// 10. EVENTS SETUP
// ----------------------------------------------------
function setupEventListeners() {
  // Theme Toggle
  document.getElementById('btn-dark-toggle').addEventListener('click', toggleTheme);

  // Navigations
  document.getElementById('btn-nav-import').addEventListener('click', () => {
    showImportStats();
    showView('view-import');
  });
  
  document.getElementById('btn-import-back').addEventListener('click', () => showView('view-dashboard'));
  document.getElementById('btn-finish-import').addEventListener('click', () => showView('view-dashboard'));
  document.getElementById('btn-study-back').addEventListener('click', () => {
    stopAutoplay();
    showView('view-dashboard');
  });
  
  // Dashboard Task Buttons
  document.getElementById('btn-task-morning').addEventListener('click', () => startStudySession('morning'));
  document.getElementById('btn-task-afternoon').addEventListener('click', () => startStudySession('afternoon'));
  document.getElementById('btn-task-evening').addEventListener('click', () => startStudySession('evening'));
  document.getElementById('btn-task-night').addEventListener('click', () => startStudySession('night'));
  
  // CSV Import handlers
  const fileInput = document.getElementById('csv-file-input');
  const dropZone = document.getElementById('drop-zone');
  
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleCSVImport(file);
  });
  
  // Drag & drop logic
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-brand-500', 'bg-brand-50/20');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-brand-500', 'bg-brand-50/20');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-brand-500', 'bg-brand-50/20');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleCSVImport(file);
    } else {
      alert('CSVファイルをドロップしてください。');
    }
  });

  // Setup Demo Data button
  document.getElementById('btn-load-demo').addEventListener('click', loadDemoData);
  document.getElementById('btn-clear-database').addEventListener('click', clearDatabase);
  
  // Study Footer Action Buttons
  document.getElementById('btn-action-no').addEventListener('click', () => {
    if (state.currentSession.mode === 'morning') {
      toggleAutoplay();
    } else {
      const activeCard = document.querySelector('.study-card');
      if (activeCard) {
        state.drag.element = activeCard;
        swipeCardOut('left');
      }
    }
  });
  
  document.getElementById('btn-action-yes').addEventListener('click', () => {
    const activeCard = document.querySelector('.study-card');
    if (activeCard) {
      state.drag.element = activeCard;
      // In morning mode this functions as "Next Card"
      swipeCardOut('right');
    }
  });
  
  document.getElementById('btn-action-flip').addEventListener('click', () => {
    console.log("Flip button clicked!");
    const activeCard = document.querySelector('.study-card');
    if (activeCard) {
      if (typeof activeCard.toggleFlip === 'function') {
        activeCard.toggleFlip();
      } else {
        console.warn("toggleFlip function is not bound to active card", activeCard);
      }
    } else {
      console.warn("No active card found to flip.");
    }
  });
  
  document.getElementById('btn-action-speak').addEventListener('click', () => {
    const session = state.currentSession;
    if (session.words[session.currentIndex]) {
      speakWord(session.words[session.currentIndex].word);
    }
  });

  document.getElementById('btn-empty-return').addEventListener('click', () => {
    stopAutoplay();
    showView('view-dashboard');
  });

  // Device Sync UI event handlers
  const btnShowExport = document.getElementById('btn-show-export');
  const btnShowImport = document.getElementById('btn-show-import');
  const exportBox = document.getElementById('sync-export-box');
  const importBox = document.getElementById('sync-import-box');
  
  if (btnShowExport && btnShowImport) {
    btnShowExport.addEventListener('click', () => {
      const code = generateSyncCode();
      if (code) {
        document.getElementById('txt-sync-code-output').value = code;
        exportBox.classList.remove('hidden');
        importBox.classList.add('hidden');
        
        // Generate QR Code URL
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(code)}`;
        const qrContainer = document.getElementById('sync-qrcode-container');
        const qrImg = document.getElementById('img-sync-qrcode');
        qrImg.src = qrUrl;
        qrContainer.classList.remove('hidden');
      }
    });
    
    btnShowImport.addEventListener('click', () => {
      importBox.classList.remove('hidden');
      exportBox.classList.add('hidden');
    });
    
    document.getElementById('btn-copy-sync-code').addEventListener('click', () => {
      const textarea = document.getElementById('txt-sync-code-output');
      textarea.select();
      try {
        navigator.clipboard.writeText(textarea.value).then(() => {
          alert('同期コードをクリップボードにコピーしました！別のデバイスに貼り付けてください。');
        }).catch(err => {
          document.execCommand('copy');
          alert('同期コードをコピーしました！');
        });
      } catch (e) {
        document.execCommand('copy');
        alert('同期コードをコピーしました！');
      }
    });
    
    document.getElementById('btn-apply-sync').addEventListener('click', () => {
      const codeInput = document.getElementById('txt-sync-code-input').value.trim();
      if (!codeInput) {
        alert('同期コードを入力してください。');
        return;
      }
      if (confirm('別のデバイスの学習進捗を取り込み、現在の履歴とマージします。よろしいですか？')) {
        applySyncCode(codeInput);
      }
    });
  }

  // JSON Backup UI event handlers
  const btnExportFile = document.getElementById('btn-export-file');
  const btnTriggerImportFile = document.getElementById('btn-trigger-import-file');
  const backupFileInput = document.getElementById('backup-file-input');
  
  if (btnExportFile && btnTriggerImportFile && backupFileInput) {
    btnExportFile.addEventListener('click', () => {
      exportBackupToFile();
    });
    
    btnTriggerImportFile.addEventListener('click', () => {
      backupFileInput.click();
    });
    
    backupFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        importBackupFromFile(file);
        backupFileInput.value = ''; // Reset
      }
    });
  }
}

function exportBackupToFile() {
  if (state.words.length === 0) {
    alert('エクスポートするデータがありません。');
    return;
  }
  const backupData = {
    words: state.words,
    history: state.history,
    exportDate: new Date().toISOString()
  };
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `target1900_backup_${getTodayString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackupFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.words || !data.history) {
        throw new Error('バックアップファイルのフォーマットが正しくありません。');
      }
      
      if (confirm(`インポートを実行しますか？現在のデータが上書きされます。\n(登録単語数: ${data.words.length}語)`)) {
        state.words = data.words;
        state.history = data.history;
        
        // Data migration / safe-guards on import
        state.words.forEach(word => {
          if (word.correctCount === undefined) word.correctCount = 0;
          if (word.mistakeCount === undefined) word.mistakeCount = 0;
          if (word.reviewCount === undefined) word.reviewCount = 0;
          if (word.interval === undefined) word.interval = 0;
          if (word.easeFactor === undefined) word.easeFactor = 2.5;
          if (word.reps === undefined) word.reps = 0;
          if (word.nextReviewDate === undefined) word.nextReviewDate = null;
          if (word.memo === undefined) word.memo = '';
        });
        
        saveDataToStorage();
        showImportStats();
        renderDashboard();
        alert('バックアップファイルからデータを正常に復元しました！');
      }
    } catch (err) {
      alert('ファイルのインポートに失敗しました。正しいJSONバックアップファイルか確認してください。\nエラー: ' + err.message);
    }
  };
  reader.readAsText(file);
}
