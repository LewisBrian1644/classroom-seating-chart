// ============================================================================
//  CLASSROOM SEATING CHART — 共享核心逻辑
//  被 index.html(学生视图) 与 admin.html(管理员换座) 共同加载。
//  只包含纯逻辑与 localStorage 读写,不依赖 DOM。
// ============================================================================

const NUM_GROUPS = 5;
const NUM_ROWS = 5;
const FIXED_STUDENT = 1;   // 鲁唐扬真 — 固定座位,单人
const ALONE_STUDENT = 2;   // 王浩宇 — 单人单座
const VIRTUAL_STUDENT = 49;
const CHANGES_KEY = 'seat-arrangement-changes';

// Student ID → name mapping for initial arrangement
// IDs: 1=鲁唐扬真(fixed) 2=王浩宇(alone) 3-48=others row by row
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
//  鲁唐扬真(1号)固定在 4组1排;韩语哲/熊晨伊换到 (4,5) 腾出位置。
//  每桌: { students: [leftId, rightId], initGroup, initRow }
// ============================================================================
function buildInitialDesks() {
  const assignments = [
    // Row 1 (front)
    [1,1, [3,4]],                     // 单俊杰 / 唐梓耀
    [2,1, [5,6]],                     // 周加灵 / 仝亚盈
    [3,1, [7,8]],                     // 宋欣哲 / 邵振琦
    [4,1, [FIXED_STUDENT, null]],     // 鲁唐扬真 — 固定单人
    [5,1, [11,12]],                   // 黄启宸 / 马亚勋
    // Row 2
    [1,2, [13,14]],                   // 李彦节 / 杨曜铭
    [2,2, [15,16]],                   // 车俊贤 / 李丞阳
    [3,2, [17,18]],                   // 余芃澄 / 何炫毅
    [4,2, [19,20]],                   // 李庭葳 / 桂钰欢
    [5,2, [21,22]],                   // 蔡磊 / 王奕霖
    // Row 3
    [1,3, [23,24]],                   // 郑光朔 / 吴子墨
    [2,3, [25,26]],                   // 贺奥凯 / 于昕呈
    [3,3, [27,28]],                   // 刘耘松 / 鲍奕丞
    [4,3, [29,30]],                   // 代一尘 / 王传栋
    [5,3, [31,32]],                   // 李博文 / 杨李吉
    // Row 4
    [1,4, [33,34]],                   // 于阅 / 高若元
    [2,4, [35,36]],                   // 杜卓航 / 刘一诺
    [3,4, [ALONE_STUDENT, VIRTUAL_STUDENT]], // 王浩宇 — 单人
    [4,4, [37,38]],                   // 郭振宇 / 周至柔
    [5,4, [39,40]],                   // 陈柯璟 / 邓轶辰
    // Row 5 (back)
    [1,5, [41,42]],                   // 蒋滇粤 / 李梓维
    [2,5, [43,44]],                   // 刘涛 / 代岑
    [3,5, [45,46]],                   // 樊霖洁 / 隆竞瑶
    [4,5, [9,10]],                    // 韩语哲 / 熊晨伊 (调换至此)
    [5,5, [47,48]],                   // 叶恒铭 / 周钇寰
  ];

  return assignments.map(([g, r, seats], i) => ({
    id: i,
    students: seats,
    initGroup: g,
    initRow: r,
    isFixed: seats[0] === FIXED_STUDENT || seats[1] === FIXED_STUDENT,
    isAlone: seats[0] === ALONE_STUDENT || seats[1] === ALONE_STUDENT,
  }));
}

// ============================================================================
//  轮换逻辑:每周 组号+1、排号-1;每第 5 周 组号额外 +1
// ============================================================================
function naturalPosition(initGroup, initRow, weeks) {
  const specialWeeks = Math.floor(weeks / 5);
  const groupShift = weeks + specialWeeks;
  const rowShift = -weeks;

  const g = ((initGroup - 1 + groupShift) % NUM_GROUPS + NUM_GROUPS) % NUM_GROUPS + 1;
  const r = ((initRow - 1 + rowShift) % NUM_ROWS + NUM_ROWS) % NUM_ROWS + 1;
  return { group: g, row: r };
}

function rotateDesks(desks, weeks) {
  const positions = desks.map(d => {
    const nat = naturalPosition(d.initGroup, d.initRow, weeks);
    return {
      ...d,
      group: d.isFixed ? d.initGroup : nat.group,
      row: d.isFixed ? d.initRow : nat.row,
      naturalGroup: nat.group,
      naturalRow: nat.row,
    };
  });

  // 冲突处理:若某个非固定桌落在固定桌的位置,与其自然位置对调
  const fixedDesk = positions.find(d => d.isFixed);
  if (fixedDesk) {
    const collider = positions.find(d =>
      !d.isFixed && d.group === fixedDesk.initGroup && d.row === fixedDesk.initRow
    );
    if (collider) {
      collider.group = fixedDesk.naturalGroup;
      collider.row = fixedDesk.naturalRow;
    }
  }

  return positions;
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

function verifyRowCoverage(desk, maxWeeks) {
  const rows = [];
  for (let w = 0; w <= maxWeeks; w++) {
    const pos = naturalPosition(desk.initGroup, desk.initRow, w);
    rows.push(pos.row);
  }
  for (let start = 0; start + 9 < rows.length; start++) {
    const windowRows = new Set(rows.slice(start, start + 10));
    if (windowRows.size < NUM_ROWS) {
      return { ok: false, start, rows: rows.slice(start, start + 10) };
    }
  }
  return { ok: true };
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
