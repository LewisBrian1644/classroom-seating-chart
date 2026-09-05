// ============================================================================
//  CLASSROOM SEATING CHART — 共享核心逻辑
//  被 index.html(学生视图) 与 admin.html(管理员换座) 共同加载。
//  只包含纯逻辑与 localStorage 读写,不依赖 DOM。
// ============================================================================

const NUM_GROUPS = 5;
const NUM_ROWS = 6;
const VIRTUAL_STUDENT = 49;
const CHANGES_KEY = 'seat-arrangement-changes';
const UNSEATED_STUDENTS = [1]; // 鲁唐扬真 — 本学期不排座(表外)

// 每组可用的排号(第1排=前排,靠后=第6排)
// 第1组 2-4排 · 第2/3/4组 1-6排 · 第5组 2-6排(共26桌)
const GROUP_ROWS = {
  1: [2, 3, 4],
  2: [1, 2, 3, 4, 5, 6],
  3: [1, 2, 3, 4, 5, 6],
  4: [1, 2, 3, 4, 5, 6],
  5: [2, 3, 4, 5, 6],
};

function hasDesk(group, row) {
  return (GROUP_ROWS[group] || []).includes(row);
}

// Student ID → name mapping for initial arrangement
// 1=鲁唐扬真(本学期暂不排座,放表外)
const STUDENT_NAMES = {
  1:'鲁唐扬真', 2:'王浩宇',
  3:'单俊杰', 4:'唐梓耀', 5:'周加灵', 6:'仝亚盈',
  7:'宋欣哲', 8:'邵振琦', 9:'韩语哲', 10:'熊晨伊',
  11:'黄启宸', 12:'马亚勋',
  13:'李彦节', 14:'杨曜铭', 15:'车俊贤', 16:'李丞阳',
  17:'余芃澄', 18:'何炫毅', 19:'李庭葳', 20:'桂钰欢',
  21:'蔡磊', 22:'王奕霖',
  23:'郑光朔', 24:'吴子墨', 25:'贺奥凯', 26:'于昕呈',
  27:'刘耘松', 28:'鲍奕丞', 29:'代一尘', 30:'王传栋',
  31:'李博文', 32:'杨李吉',
  33:'于阅', 34:'高若元', 35:'杜卓航', 36:'刘一诺',
  37:'郭振宇', 38:'周至柔', 39:'陈柯璟', 40:'邓轶辰',
  41:'蒋滇粤', 42:'李梓维', 43:'刘涛', 44:'代岑',
  45:'樊霖洁', 46:'隆竞瑶', 47:'叶恒铭', 48:'周钇寰',
};

// ============================================================================
//  初始座位(第 0 周基准)
//  布局:第1组 2-4排;第2/3/4组 1-6排;第5组 2-6排(共26桌)
//  鲁唐扬真(1号)本学期不排座;王浩宇/仝亚盈/于阅 为单人座
//  每桌: { students: [leftId, rightId], initGroup, initRow }
// ============================================================================
function buildInitialDesks() {
  const assignments = [
    // 第1组 (2-4排)
    [1, 2, [4, 39]],            // 唐梓耀 / 陈柯璟
    [1, 3, [7, 43]],            // 宋欣哲 / 刘涛
    [1, 4, [37, 40]],           // 郭振宇 / 邓轶辰
    // 第2组 (1-6排)
    [2, 1, [31, 22]],           // 李博文 / 王奕霖
    [2, 2, [23, 38]],           // 郑光朔 / 周至柔
    [2, 3, [5, 46]],            // 周加灵 / 隆竞瑶
    [2, 4, [42, 28]],           // 李梓维 / 鲍奕丞
    [2, 5, [19, 8]],            // 李庭葳 / 邵振琦
    [2, 6, [11, 48]],           // 黄启宸 / 周钇寰
    // 第3组 (1-6排)
    [3, 1, [15, 24]],           // 车俊贤 / 吴子墨
    [3, 2, [34, 3]],            // 高若元 / 单俊杰
    [3, 3, [35, 45]],           // 杜卓航 / 樊霖洁
    [3, 4, [32, 21]],           // 杨李吉 / 蔡磊
    [3, 5, [29, 12]],           // 代一尘 / 马亚勋
    [3, 6, [33, null]],         // 于阅 — 单人
    // 第4组 (1-6排)
    [4, 1, [17, 18]],           // 余芃澄 / 何炫毅
    [4, 2, [26, 13]],           // 于昕呈 / 李彦节
    [4, 3, [41, 30]],           // 蒋滇粤 / 王传栋
    [4, 4, [6, null]],          // 仝亚盈 — 单人
    [4, 5, [2, null]],          // 王浩宇 — 单人
    [4, 6, [null, null]],       // 空桌(原鲁唐位)
    // 第5组 (2-6排)
    [5, 2, [9, 27]],            // 韩语哲 / 刘耘松
    [5, 3, [16, 14]],           // 李丞阳 / 杨曜铭
    [5, 4, [10, 36]],           // 熊晨伊 / 刘一诺
    [5, 5, [44, 20]],           // 代岑 / 桂钰欢
    [5, 6, [47, 25]],           // 叶恒铭 / 贺奥凯
  ];

  return assignments.map(([g, r, seats], i) => ({
    id: i,
    students: seats,
    initGroup: g,
    initRow: r,
    isAlone: seats[0] !== null && seats[1] === null,
  }));
}

// ============================================================================
//  轮换逻辑:每周 组号+1、排号-1(第1排往前回绕到第6排)。
//  3 个例外(目标组没位子,跳到第2组的空位)——落点经过排列,让全体串成
//  一个 26 桌的大环(不出现 3~4 桌的小循环):
//    第4组第2排 → 第2组第6排
//    第5组第2排 → 第2组第4排
//    第5组第6排 → 第2组第5排
// ============================================================================
function nextPosition(group, row) {
  if (group === 4 && row === 2) return { group: 2, row: 6 };
  if (group === 5 && row === 2) return { group: 2, row: 4 };
  if (group === 5 && row === 6) return { group: 2, row: 5 };
  return {
    group: (group % NUM_GROUPS) + 1,
    row: row === 1 ? NUM_ROWS : row - 1,
  };
}

function naturalPosition(initGroup, initRow, weeks) {
  let g = initGroup, r = initRow;
  for (let w = 0; w < weeks; w++) {
    const next = nextPosition(g, r);
    g = next.group;
    r = next.row;
  }
  return { group: g, row: r };
}

function rotateDesks(desks, weeks) {
  return desks.map(d => {
    const nat = naturalPosition(d.initGroup, d.initRow, weeks);
    return { ...d, group: nat.group, row: nat.row };
  });
}

// 校验:轮换后每桌都落在有效桌位上(不出界)
function verifyRotation(maxWeeks) {
  const desks = buildInitialDesks();
  for (let w = 0; w <= maxWeeks; w++) {
    for (const d of desks) {
      const nat = naturalPosition(d.initGroup, d.initRow, w);
      if (!hasDesk(nat.group, nat.row)) {
        return { ok: false, desk: d, week: w, pos: nat };
      }
    }
  }
  return { ok: true };
}

// ============================================================================
//  换座记录: [{ startDate: 'YYYY-MM-DD', desks: [...], note }]
//  自 startDate 起,座位使用该基准并继续每周轮换
// ============================================================================
function getChanges() {
  try {
    const raw = localStorage.getItem(CHANGES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return [];
}

function setChanges(changes) {
  localStorage.setItem(CHANGES_KEY, JSON.stringify(changes));
}

function addChange(change) {
  const changes = getChanges();
  changes.push(change);
  setChanges(changes);
}

function removeChange(index) {
  const changes = getChanges();
  changes.splice(index, 1);
  setChanges(changes);
}

function getArrangementForDate(dateStr) {
  const changes = getChanges()
    .filter(c => c.startDate && c.startDate <= dateStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (changes.length) {
    const latest = changes[changes.length - 1];
    return { desks: latest.desks, baselineStart: latest.startDate, isOverride: true };
  }
  return {
    desks: buildInitialDesks(),
    baselineStart: formatDate(getSemesterStart()),
    isOverride: false,
  };
}

function weeksBetween(startDateStr, endDateStr) {
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  return Math.floor((end - start) / (7 * 24 * 60 * 60 * 1000));
}

function getDeskPositionsForDate(dateStr) {
  const { desks, baselineStart } = getArrangementForDate(dateStr);
  const weeks = weeksBetween(baselineStart, dateStr);
  return rotateDesks(desks, Math.max(0, weeks));
}

// ============================================================================
//  日期 / 周 工具
// ============================================================================
function getSemesterStart() {
  const stored = localStorage.getItem('seat-semester-start');
  if (stored) return new Date(stored + 'T00:00:00');
  return new Date('2026-09-01T00:00:00');
}

function setSemesterStart(date) {
  localStorage.setItem('seat-semester-start', date.toISOString().slice(0, 10));
}

function getWeekNumber(date, semesterStart) {
  const diffMs = date.getTime() - semesterStart.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function getWeekStartDate(weekNum, semesterStart) {
  const d = new Date(semesterStart);
  d.setDate(d.getDate() + weekNum * 7);
  return d;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

// 把日期对齐到所在「周」的第一天(与主页按周查看的锚点一致),
// 这样换座记录在整周内生效,不会因为选了周中某天而主页看不到。
function snapToWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const semStart = getSemesterStart();
  const weekNum = getWeekNumber(d, semStart);
  return formatDate(getWeekStartDate(weekNum, semStart));
}

// ============================================================================
//  学生姓名(可持久化)
// ============================================================================
function getDefaultNames() {
  return { ...STUDENT_NAMES };
}

function loadNames() {
  try {
    const raw = localStorage.getItem('seat-student-names');
    if (raw) return { ...getDefaultNames(), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return getDefaultNames();
}

function saveName(id, name) {
  const names = loadNames();
  names[id] = name;
  localStorage.setItem('seat-student-names', JSON.stringify(names));
}

function getStudentName(id) {
  if (id === null) return '';
  if (id === VIRTUAL_STUDENT) return '(空)';
  const names = loadNames();
  return names[id] || `${id}号`;
}

// 原始姓名(空座位/虚拟座位返回空串),供管理员编辑用
function getRawStudentName(id) {
  if (id === null || id === undefined || id === VIRTUAL_STUDENT) return '';
  const names = loadNames();
  return names[id] || '';
}

// name → id 反查表
function buildNameToIdMap() {
  const names = loadNames();
  const map = {};
  for (const [id, name] of Object.entries(names)) {
    if (name && name.trim()) map[name.trim()] = Number(id);
  }
  return map;
}

// 新增学生(返回新 ID,跳过 49 号虚拟座位)
function addStudent(name) {
  name = (name || '').trim();
  if (!name) return null;
  const names = loadNames();
  const nextId = Math.max(VIRTUAL_STUDENT, ...Object.keys(names).map(Number)) + 1;
  names[nextId] = name;
  localStorage.setItem('seat-student-names', JSON.stringify(names));
  return nextId;
}
