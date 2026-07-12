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
  } catch (e) {
    console.error('LocalStorageの読み込みに失敗しました', e);
  }
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

function processImportedData(rows) {
  if (rows.length === 0) return;
  
  // Skip header if matches
  let startIdx = 0;
  const firstRow = rows[0];
  if (firstRow[0].includes('番号') || firstRow[0].includes('セクション') || firstRow[1].toLowerCase().includes('word') || firstRow[1].includes('単語')) {
    startIdx = 1;
  }
  
  let addedCount = 0;
  const newWords = [];
  
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;
    
    const col1 = parseInt(row[0].trim(), 10); // Section ID or Word Number
    const wordStr = row[1].trim();
    const meaningStr = row[2].trim();
    
    if (!wordStr || !meaningStr) continue;
    
    // Auto-detect section_id
    let sectionId = 1;
    if (col1 > 100) {
      // It is likely serial number (1-1900)
      sectionId = Math.floor((col1 - 1) / 100) + 1;
    } else {
      // It is likely section ID (1-19)
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
      lastStudiedDate: null
    });
    addedCount++;
  }
  
  if (newWords.length > 0) {
    // Append or replace
    // For prototype, we merge. If word ID exists, we preserve status
    newWords.forEach(nw => {
      const exists = state.words.find(w => w.id === nw.id);
      if (!exists) {
        state.words.push(nw);
      }
    });
    
    saveDataToStorage();
    showImportStats();
    alert(`${addedCount}語のデータをインポートしました！`);
    renderDashboard();
  }
}

function loadDemoData() {
  const demo = [];
  // Section 1: 100 words (subset)
  const sampleWords = [
    { word: "create", meaning: "を創り出す；を引き起こす" },
    { word: "increase", meaning: "増加する；を増やす" },
    { word: "improve", meaning: "を向上させる；よくなる" },
    { word: "mean", meaning: "を意味する；つもりである" },
    { word: "own", meaning: "を所有している；を認める" },
    { word: "include", meaning: "を含む" },
    { word: "consider", meaning: "を見なす；について考える" },
    { word: "allow", meaning: "を許す；を与える" },
    { word: "suggest", meaning: "を提案する；を暗示する" },
    { word: "produce", meaning: "を生産する；を取り出す" }
  ];
  
  sampleWords.forEach((item, index) => {
    demo.push({
      id: `1-${item.word}`,
      word: item.word,
      meaning: item.meaning,
      section_id: 1,
      status: 'new',
      lastStudiedDate: null
    });
  });
  
  state.words = demo;
  saveDataToStorage();
  showImportStats();
  alert('デモデータをロードしました！ (セクション1: 10単語)');
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
      // 朝: 新規単語(new)の閲覧（本日分、または最初のセクションのnew）
      modeTitle = '【朝】新規単語の閲覧';
      modeDesc = '発音を聞きながら意味を素早くインプット';
      targetWords = state.words.filter(w => w.status === 'new').slice(0, 15); // Prototype limit 15 for demo
      if (targetWords.length === 0) {
        // Fallback to learning
        targetWords = state.words.slice(0, 15);
      }
      break;
      
    case 'afternoon':
      // 昼: 今日の新規・学習中単語 ＆ 前日までの習得済み単語を交互に出題
      modeTitle = '【昼】仕分けテスト';
      modeDesc = '左右スワイプで仕分け (右:わかる / 左:わからない)';
      
      const newOrLearning = state.words.filter(w => w.status === 'new' || w.status === 'learning');
      const mastered = state.words.filter(w => w.status === 'mastered');
      
      // Interleaving merge (1 active, 1 mastered, etc.)
      const limit = Math.min(newOrLearning.length, 15);
      const activeList = newOrLearning.slice(0, limit);
      const masteredList = mastered.slice(0, limit);
      
      targetWords = [];
      for (let i = 0; i < limit; i++) {
        if (activeList[i]) targetWords.push(activeList[i]);
        if (masteredList[i]) targetWords.push(masteredList[i]);
      }
      
      // If still empty, load any words
      if (targetWords.length === 0) {
        targetWords = state.words.slice(0, 10);
      }
      break;
      
    case 'evening':
      // 夕方: 習得済み(mastered)からランダム抽出
      modeTitle = '【夕方】過去の復習';
      modeDesc = '習得済みの記憶を間隔反復で定着確認';
      targetWords = state.words.filter(w => w.status === 'mastered');
      // Shuffle & limit
      targetWords = targetWords.sort(() => 0.5 - Math.random()).slice(0, 10);
      if (targetWords.length === 0) {
        alert('習得済み(Mastered)の単語がありません。まずは昼のテストで仕分けてください。');
        return;
      }
      break;
      
    case 'night':
      // 夜: 「学習中(learning)」の単語のみをサドンデス形式で
      modeTitle = '【夜】今日の総復習';
      modeDesc = '間違えた単語のサドンデスループ';
      targetWords = state.words.filter(w => w.status === 'learning');
      if (targetWords.length === 0) {
        alert('現在「学習中(Learning)」の単語はありません！');
        return;
      }
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
    <div class="card-face-back absolute inset-0 flex flex-col justify-between p-6 rotate-y-180 backface-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-2 border-brand-500/20 rounded-3xl opacity-0 pointer-events-none">
      <div class="flex justify-between items-center text-[10px] font-bold text-brand-500">
        <span>MEANING</span>
        <button class="btn-card-tts p-1.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
          <svg class="w-4 h-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
        </button>
      </div>
      <div class="text-center py-10 flex-1 flex flex-col justify-center">
        <p class="text-xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed px-2">${word.meaning}</p>
      </div>
      <div class="text-center text-[10px] text-slate-400">
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
      updateWordStatus(currentWord.id, 'mastered');
    } else {
      card.classList.add('card-swipe-out-left');
      updateWordStatus(currentWord.id, 'learning');
      
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
    saveDataToStorage();
  }
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
}
