// ============================================================================
//  班级座位表 v2.0.0 — 共享核心逻辑
//  被 index.html(学生视图) 与 admin.html(管理员) 共同加载。
//  纯逻辑 + localStorage 读写,不依赖 DOM。
//
//  模型(与旧版 v1 的区别):
//   * 存在两套坐标 ——「标准座位表」与「实际座位表」。
//   * 标准座位表:所有组顶部对齐(第 1 组 1-4 排、第 2 组 1-5 排、第 3 组 1-6 排、
//     第 4 组 1-5 排、第 5 组 1-5 排),轮换直接作用在标准坐标上。
//   * 实际座位表:教室真实形状(第 1 组 2-4 排、第 2/3/4 组 1-6 排、第 5 组 2-6 排),
//     是最终展示的座位表。第 1、5 组(以及 V1 中因鲁唐扬真固定而让位的第 4 组)
//     在标准基础上整体下移一排。
//   * 轮换规则:每周 组号 +1、排号 +1;排号按「小组」(同桌初始所在组)的回绕上限取模。
//   * 标准→实际:能直接落进实际形状的桌直接放;落不进的「溢出桌」按
//     「组号差绝对值 + 排号差绝对值」的距离,以总距离最小(即平均值最小)填入空桌。
//   * 特殊规则:熊晨伊/刘一诺、仝亚盈、杜卓航/樊霖洁、周加灵/隆竞瑶 四桌
//     若落到第 5 组,则与第 4 组同排交换。
// ============================================================================

const NUM_GROUPS = 5;
const NUM_ROWS = 6;

// localStorage / KV 键
const KEY_START          = 'seat-semester-start';
const KEY_INITIAL_V1     = 'seat-initial-v1';
const KEY_INITIAL_V2     = 'seat-initial-v2';
const KEY_ACTIVE_VERSION = 'seat-active-version';

// ============================================================================
//  实际教室形状:每个组有哪些「实际排」(真实存在的桌子)
// ============================================================================
const ACTUAL_ROWS = {
  1: [2, 3, 4],           // 第 1 组 2-4 排
  2: [1, 2, 3, 4, 5, 6],  // 第 2 组 1-6 排
  3: [1, 2, 3, 4, 5, 6],
  4: [1, 2, 3, 4, 5, 6],
  5: [2, 3, 4, 5, 6],     // 第 5 组 2-6 排
};

// ============================================================================
//  初始座位表(标准坐标)。group = 小组(1-5,固定不变),row = 该小组内的标准排号。
//  students = [左, 右],单人则右侧为 null。
//  V1 含鲁唐扬真(固定第 4 组第 1 排,不参与轮换);V2 不含。
// ============================================================================

// 鲁唐扬真 —— V1 中固定在第四组第 1 排(标准第 0 排),不轮换,不计入第四小组
const LU_TANG_YANG_ZHEN = '鲁唐扬真';

function V1_DESKS() {
  return [
    // 第一小组(初始第 1 组,4 桌,8 人)—— 实际 2-4 排 + 溢出 1 桌
    { group: 1, row: 1, students: ['唐梓耀', '周寰'] },
    { group: 1, row: 2, students: ['黄启宸', '陈柯璟'] },
    { group: 1, row: 3, students: ['宋欣哲', '刘涛'] },
    { group: 1, row: 4, students: ['郭振宇', '邓轶辰'] },

    // 第二小组(5 桌,10 人)
    { group: 2, row: 1, students: ['李博文', '王奕霖'] },
    { group: 2, row: 2, students: ['郑光朔', '周至柔'] },
    { group: 2, row: 3, students: ['周加灵', '隆竞瑶'] },
    { group: 2, row: 4, students: ['李梓维', '鲍奕丞'] },
    { group: 2, row: 5, students: ['李庭葳', '邵振琦'] },

    // 第三小组(6 桌,11 人)
    { group: 3, row: 1, students: ['车俊贤', '吴子墨'] },
    { group: 3, row: 2, students: ['高若元', '单俊杰'] },
    { group: 3, row: 3, students: ['杜卓航', '樊霖洁'] },
    { group: 3, row: 4, students: ['杨李吉', '蔡磊'] },
    { group: 3, row: 5, students: ['代一尘', '马亚勋'] },
    { group: 3, row: 6, students: ['于阅', null] },

    // 第四小组(5 桌,8 人;鲁唐扬真单独固定)
    { group: 4, row: 1, students: ['余芃澄', '何炫毅'] },
    { group: 4, row: 2, students: ['于听呈', '李彦节'] },
    { group: 4, row: 3, students: ['蒋滇粵', '王传栋'] },
    { group: 4, row: 4, students: ['仝亚盈', null] },
    { group: 4, row: 5, students: ['王浩宇', null] },

    // 第五小组(5 桌,10 人)
    { group: 5, row: 1, students: ['韩语哲', '刘耘松'] },
    { group: 5, row: 2, students: ['李丞阳', '杨曜铭'] },
    { group: 5, row: 3, students: ['熊晨伊', '刘一诺'] },
    { group: 5, row: 4, students: ['代岑', '桂钰欢'] },
    { group: 5, row: 5, students: ['叶恒铭', '贺奥凯'] },
  ];
}

// 是否 V1 含鲁唐扬真
function hasLu(version) {
  return version === 1;
}

// 组装某版本的全部桌(含固定桌)
function buildVersionDesks(version) {
  const desks = loadInitialDesks(version);
  const list = desks.map((d, i) => ({ ...d, id: i, fixed: false }));
  if (hasLu(version)) {
    list.push({ id: 'LU', fixed: true, group: 4, row: 0, students: [LU_TANG_YANG_ZHEN, null] });
  }
  return list;
}

// ============================================================================
//  初始座位表读写(允许管理员覆盖;默认用内置 V1/V2)
// ============================================================================
function defaultInitialDesks(version) {
  // V1 与 V2 的初始名单相同;鲁唐扬真由 buildVersionDesks 按版本(hasLu)单独加入。
  return V1_DESKS();
}

function initialKey(version) {
  return version === 1 ? KEY_INITIAL_V1 : KEY_INITIAL_V2;
}

function loadInitialDesks(version) {
  try {
    const raw = localStorage.getItem(initialKey(version));
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return defaultInitialDesks(version);
}

function saveInitialDesks(version, desks) {
  localStorage.setItem(initialKey(version), JSON.stringify(desks));
}

// ============================================================================
//  小组回绕上限 = 该小组(同桌初始所在组)的标准最大排号
//  由初始桌数据推导(管理员改表后自动更新)
// ============================================================================
function groupMaxRow(desks) {
  const max = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of desks) {
    if (d.fixed) continue;
    if (d.row > max[d.group]) max[d.group] = d.row;
  }
  return max;
}

// ============================================================================
//  轮换:组 +1、排 +1(排按小组回绕上限取模)
//  返回每桌在「标准坐标」下的位置 { group, row }
// ============================================================================
function standardPositions(version, weeks) {
  const desks = buildVersionDesks(version);
  const maxRow = groupMaxRow(desks);
  return desks.map((d) => {
    if (d.fixed) {
      // 鲁唐扬真固定:第 4 组,标准第 0 排(实际第 1 排)
      return { ...d, group: 4, stdRow: 0 };
    }
    const g = ((d.group - 1 + weeks) % NUM_GROUPS) + 1;
    const m = maxRow[d.group] || 1;
    const r = ((d.row - 1 + weeks) % m) + 1;
    return { ...d, group: g, stdRow: r };
  });
}

// 标准排 → 实际排(第 1、5 组下移一排;V1 第 4 组因鲁唐扬真让位也下移一排)
function stdToActualRow(group, stdRow, version) {
  if (group === 1 || group === 5) return stdRow + 1;
  if (group === 4 && hasLu(version)) return stdRow + 1;
  return stdRow;
}

// ============================================================================
//  距离:两桌之间 = |组号差| + |排号差|
// ============================================================================
function distance(g1, r1, g2, r2) {
  return Math.abs(g1 - g2) + Math.abs(r1 - r2);
}

// 最小总距离(即平均值最小)的最优指派:溢出桌 -> 空桌
// 溢出桌数 n 与空桌数 m 都极小(通常仅 1),直接回溯枚举即可求最优。
function assignMinCost(costs) {
  const n = costs.length;
  const m = n ? costs[0].length : 0;
  if (n === 0) return [];
  const assign = new Array(n).fill(-1);
  const used = new Array(m).fill(false);
  let best = Infinity;
  (function dfs(i, total, path) {
    if (i === n) {
      if (total < best) { best = total; for (let k = 0; k < n; k++) assign[k] = path[k]; }
      return;
    }
    for (let j = 0; j < m; j++) {
      if (used[j]) continue;
      used[j] = true;
      path[i] = j;
      dfs(i + 1, total + costs[i][j], path);
      used[j] = false;
    }
  })(0, 0, new Array(n));
  return assign; // assign[i] = 空桌下标
}

// ============================================================================
//  第五组交换规则:特殊四桌若落到第 5 组,与第 4 组同排交换
// ============================================================================
// 特殊四桌:键与输入都用同一次 sort() 生成,避免手写名字顺序出错(如 熊/刘 的码点序)。
const SPECIAL_DESK_KEYS = new Set(
  [
    ['熊晨伊', '刘一诺'],
    ['仝亚盈'],
    ['杜卓航', '樊霖洁'],
    ['周加灵', '隆竞瑶'],
  ].map((pair) => pair.slice().sort().join('|'))
);

function isSpecialDesk(students) {
  return SPECIAL_DESK_KEYS.has(students.filter(Boolean).slice().sort().join('|'));
}

// ============================================================================
//  主入口:给定版本与周数,返回「实际座位表」的完整放置结果
//  返回 Map: key = `${group},${actualRow}` -> { students, group, actualRow, special, fixed }
// ============================================================================
function getActualSeating(version, weeks) {
  const std = standardPositions(version, weeks);

  // 1) 固定桌直接落位(鲁唐扬真)
  const placement = new Map();
  for (const d of std) {
    if (d.fixed) {
      placement.set(`4,1`, { students: d.students, group: 4, actualRow: 1, fixed: true, special: false });
    }
  }

  // 2) 可轮换桌:算实际排,能落进实际形状的直接放;落不进的记为溢出
  const overflow = [];
  for (const d of std) {
    if (d.fixed) continue;
    const actualRow = stdToActualRow(d.group, d.stdRow, version);
    const key = `${d.group},${actualRow}`;
    if ((ACTUAL_ROWS[d.group] || []).includes(actualRow) && !placement.has(key)) {
      placement.set(key, { students: d.students, group: d.group, actualRow, fixed: false, special: isSpecialDesk(d.students) });
    } else {
      // 溢出桌:记录其「概念实际坐标」(可能越界),用于计算距离
      overflow.push({ ...d, actualRow, special: isSpecialDesk(d.students) });
    }
  }

  // 3) 收集空的实际桌位
  const empty = [];
  for (let g = 1; g <= NUM_GROUPS; g++) {
    for (const r of ACTUAL_ROWS[g]) {
      if (!placement.has(`${g},${r}`)) empty.push({ group: g, row: r });
    }
  }

  // 4) 最优指派:溢出桌 -> 空桌(总距离最小)
  if (overflow.length && empty.length) {
    const costs = overflow.map((o) => empty.map((e) => distance(o.group, o.actualRow, e.group, e.row)));
    const assign = assignMinCost(costs);
    overflow.forEach((o, i) => {
      const j = assign[i];
      if (j >= 0) {
        const e = empty[j];
        placement.set(`${e.group},${e.row}`, { students: o.students, group: e.group, actualRow: e.row, fixed: false, special: o.special });
      }
    });
  }

  // 5) 第五组交换:特殊桌落第 5 组 -> 与第 4 组同排(非特殊、非固定)桌交换
  swapOutOfGroupFive(placement);

  return placement;
}

function swapOutOfGroupFive(placement) {
  // 第 5 组中的特殊桌
  const specialInFive = [];
  for (const [key, desk] of placement) {
    if (desk.group === 5 && desk.special && !desk.fixed) {
      specialInFive.push({ key, desk });
    }
  }
  // 第 4 组中可交换的非特殊、非固定桌(优先同排,其次就近)
  const swapTargets = [];
  for (const [key, desk] of placement) {
    if (desk.group === 4 && !desk.special && !desk.fixed) {
      swapTargets.push({ key, desk });
    }
  }

  for (const { key, desk } of specialInFive) {
    // 优先同排;否则挑离得最近的第 4 组非特殊桌
    let best = null;
    for (const t of swapTargets) {
      const d = distance(desk.group, desk.actualRow, t.desk.group, t.desk.actualRow);
      if (!best || d < best.d) best = { t, d };
    }
    if (!best) continue; // 第 4 组没有可交换的非特殊桌(极端情况),放弃
    const { t } = best;
    // 交换位置:特殊桌去第 4 组,非特殊桌去第 5 组
    const targetKey = t.key;
    const target = t.desk;
    placement.set(targetKey, { ...desk, group: 4, actualRow: target.actualRow });
    placement.set(key, { ...target, group: 5, actualRow: desk.actualRow });
    // 该非特殊桌已被换走,移出候选
    swapTargets.splice(swapTargets.indexOf(t), 1);
  }
}

// ============================================================================
//  日期 / 周 工具
// ============================================================================
function getSemesterStart() {
  const stored = localStorage.getItem(KEY_START);
  if (stored) return new Date(stored + 'T00:00:00');
  return new Date('2026-09-01T00:00:00');
}

function setSemesterStart(date) {
  localStorage.setItem(KEY_START, formatDate(date));
}

// 某日期相对学期开始的周数(0 = 起始那周,即第 1 周)
function weeksSinceStart(date) {
  const start = getSemesterStart();
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

// 第 n 周(0 起)的第一天
function weekStartDate(weekNum) {
  const d = getSemesterStart();
  d.setDate(d.getDate() + weekNum * 7);
  return d;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 当前激活的版本(默认 V1)
function getActiveVersion() {
  const stored = localStorage.getItem(KEY_ACTIVE_VERSION);
  return stored === '2' ? 2 : 1;
}

function setActiveVersion(v) {
  localStorage.setItem(KEY_ACTIVE_VERSION, String(v));
}

// 供页面使用:某日期的实际座位表(按日期折算周数)
function getSeatingForDate(version, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const weeks = Math.max(0, weeksSinceStart(date));
  return getActualSeating(version, weeks);
}

// ============================================================================
//  校验:连续 N 周,每桌都落在有效实际桌位且不重叠
// ============================================================================
function verifyRotation(version, maxWeeks) {
  for (let w = 0; w <= maxWeeks; w++) {
    const placement = getActualSeating(version, w);
    const seen = new Set();
    for (const [key, desk] of placement) {
      if (!(ACTUAL_ROWS[desk.group] || []).includes(desk.actualRow)) {
        return { ok: false, week: w, key, desk };
      }
      if (seen.has(key)) return { ok: false, week: w, key, desk, dup: true };
      seen.add(key);
    }
  }
  return { ok: true };
}
