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
    [4, 6, [null, null]],       // 空桌(初始无人坐,作为普通桌一起轮换)
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
//  轮换逻辑:每周 组号+1、排号-1(第1排回绕到第6排)——自然轨迹是 30 大环。
//  第1组、第5组没有第1排(第2排才和其它组的第1排平齐),所以换座时把它们的
//  排号整体减 1 再参与「排-1」,这样前排(第2排)回绕才正确。
//  布局不规则,某桌按「组+1排-1」会落到没有该排的组 =「坐不下」,此时临时
//  去有空位的组「借坐」;下一周仍按它本来的自然轨迹走(借坐只影响当周,
//  不改变它下周的自然位置,即「下一周够坐就回到原来的组」)。
//  空桌透明:空桌的自然位置可被借坐,空桌最后落到剩下的那个空位上。
// ============================================================================
function rowOffset(group) {
  return (group === 1 || group === 5) ? -1 : 0;
}

function naturalNext(group, row) {
  const nRow = row + rowOffset(group);                 // 归一化:第1/5组第2排 = 第1排
  const newGroup = (group % NUM_GROUPS) + 1;
  const newNRow = nRow === 1 ? NUM_ROWS : nRow - 1;    // 排-1,第1排回绕到第6排
  return { group: newGroup, row: newNRow - rowOffset(newGroup) };
}

function naturalPosition(initGroup, initRow, weeks) {
  let g = initGroup, r = initRow;
  for (let w = 0; w < weeks; w++) {
    const n = naturalNext(g, r);
    g = n.group; r = n.row;
  }
  return { group: g, row: r };
}

function rotateDesks(desks, weeks) {
  // 1. 每桌按自然轨迹算位置(可能落到无效位置 = 坐不下)
  const positions = desks.map(d => {
    const nat = naturalPosition(d.initGroup, d.initRow, weeks);
    return { ...d, group: nat.group, row: nat.row };
  });

  // 2. 空桌透明:单独拿出来,其自然位置也算空位
  const emptyDesk = positions.find(d => d.students[0] === null && d.students[1] === null);
  const occupied = positions.filter(d => d !== emptyDesk);

  // 3. 自然位置有效的桌占住位置;无效的桌需要「借坐」
  const taken = new Set();
  const borrowers = [];
  for (const d of occupied) {
    if (hasDesk(d.group, d.row)) taken.add(d.group + ',' + d.row);
    else borrowers.push(d);
  }

  // 4. 空位 = 所有有效位置中没被占住的(含空桌自然位置)
  const free = [];
  for (let g = 1; g <= NUM_GROUPS; g++) {
    for (const r of GROUP_ROWS[g]) {
      if (!taken.has(g + ',' + r)) free.push({ group: g, row: r });
    }
  }

  // 5. 借坐分配:优先本组空位,否则第2组;借坐桌按归一化排号从小到大排序,
  //    让前排的桌借前排空位、后排的桌借后排空位,保持前后相对顺序
  borrowers.sort((a, b) => ((a.row + rowOffset(a.group)) - (b.row + rowOffset(b.group))) || (a.group - b.group));
  const remaining = free.slice();
  for (const b of borrowers) {
    const targetGroup = b.group; // 自然轨迹里它本应去的组
    let slot = remaining.find(f => f.group === targetGroup);
    if (!slot) slot = remaining.find(f => f.group === 2);
    if (!slot) slot = remaining[0];
    if (slot) {
      b.group = slot.group; b.row = slot.row;
      remaining.splice(remaining.indexOf(slot), 1);
    }
  }

  // 6. 空桌落到剩下的空位
  if (emptyDesk && remaining.length) {
    emptyDesk.group = remaining[0].group;
    emptyDesk.row = remaining[0].row;
  }

  // 7. 填满规则:空桌不在最后一排,就把其后桌往前移,把空桌顶到最后一排
  for (let g = 1; g <= NUM_GROUPS; g++) {
    const rows = GROUP_ROWS[g];
    const lastRow = rows[rows.length - 1];
    const groupDesks = positions.filter(d => d.group === g);
    const e = groupDesks.find(d => d.students[0] === null && d.students[1] === null);
    if (!e || e.row === lastRow) continue;
    for (const d of groupDesks) {
      if (d !== e && d.row > e.row) d.row -= 1;
    }
    e.row = lastRow;
  }

  return positions;
}

// 校验:轮换后每桌都落在有效桌位上且不重叠
function verifyRotation(maxWeeks) {
  const desks = buildInitialDesks();
  for (let w = 0; w <= maxWeeks; w++) {
    const pos = rotateDesks(desks, w);
    const seen = new Set();
    for (const d of pos) {
      if (!hasDesk(d.group, d.row)) {
        return { ok: false, desk: d, week: w, pos: { group: d.group, row: d.row } };
      }
      const k = d.group + ',' + d.row;
      if (seen.has(k)) {
        return { ok: false, desk: d, week: w, pos: { group: d.group, row: d.row } };
      }
      seen.add(k);
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
