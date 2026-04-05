/**
 * 八字排盘核心算法
 * 包含：天干地支、年柱月柱日柱时柱计算、十神、藏干、大运排列
 */

// ==================== 基础数据 ====================

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

const WU_XING_MAP = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
  '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土',
  '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金',
  '戌': '土', '亥': '水'
};

const YIN_YANG_MAP = {
  '甲': '阳', '乙': '阴', '丙': '阳', '丁': '阴', '戊': '阳',
  '己': '阴', '庚': '阳', '辛': '阴', '壬': '阳', '癸': '阴',
  '子': '阳', '丑': '阴', '寅': '阳', '卯': '阴', '辰': '阳',
  '巳': '阴', '午': '阳', '未': '阴', '申': '阳', '酉': '阴',
  '戌': '阳', '亥': '阴'
};

// 地支藏干表 { 地支: [本气, 中气, 余气] }
const CANG_GAN = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '庚', '戊'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲']
};

// 十神关系
const SHI_SHEN_TABLE = {
  '同_同': '比肩', '同_异': '劫财',
  '生_同': '食神', '生_异': '伤官',
  '克_同': '偏财', '克_异': '正财',
  '被克_同': '七杀', '被克_异': '正官',
  '被生_同': '偏印', '被生_异': '正印'
};

// 五行相生：木→火→土→金→水→木
const SHENG_MAP = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
// 五行相克：木→土→水→火→金→木
const KE_MAP = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };

// ==================== 节气数据（1900-2100精确数据） ====================
// 每年24节气的儒略日偏移，用于精确计算节气日期
// 这里用简化算法，基于天文算法近似

/**
 * 计算指定年份某节气的近似日期
 * @param {number} year 年份
 * @param {number} termIndex 节气序号 0=小寒 1=大寒 2=立春 ... 23=大寒
 * @returns {Date} 节气日期
 */
function getSolarTerm(year, termIndex) {
  // 使用寿星万年历算法的简化版本
  // 节气角度：从小寒(285°)开始，每个节气15°
  const termAngles = [285, 300, 315, 330, 345, 0, 15, 30, 45, 60, 75, 90,
                      105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270];
  
  // 每个节气的大约月日（平气近似）
  const termDates = [
    [1, 6], [1, 20],   // 小寒、大寒
    [2, 4], [2, 19],   // 立春、雨水
    [3, 6], [3, 21],   // 惊蛰、春分
    [4, 5], [4, 20],   // 清明、谷雨
    [5, 6], [5, 21],   // 立夏、小满
    [6, 6], [6, 21],   // 芒种、夏至
    [7, 7], [7, 23],   // 小暑、大暑
    [8, 7], [8, 23],   // 立秋、处暑
    [9, 8], [9, 23],   // 白露、秋分
    [10, 8], [10, 23], // 寒露、霜降
    [11, 7], [11, 22], // 立冬、小雪
    [12, 7], [12, 22]  // 大雪、冬至
  ];

  const [month, day] = termDates[termIndex];
  // 简化：年份修正（闰年等影响约±1-2天）
  let adjustDay = day;
  // 世纪修正
  const century = Math.floor(year / 100);
  if (century === 19) adjustDay += 1;
  if (century === 21) adjustDay -= 1;
  // 闰年修正
  if (year % 4 === 0 && month <= 2) adjustDay -= 1;
  
  return new Date(year, month - 1, adjustDay);
}

// 十二节（用于月柱和起运计算，非中气）
// 索引：0=小寒 2=立春 4=惊蛰 6=清明 8=立夏 10=芒种 12=小暑 14=立秋 16=白露 18=寒露 20=立冬 22=大雪
const JIE_INDICES = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

/**
 * 获取某年所有十二节的日期
 */
function getJieQiDates(year) {
  return JIE_INDICES.map(idx => ({
    index: idx,
    date: getSolarTerm(year, idx),
    name: ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', 
           '小暑', '立秋', '白露', '寒露', '立冬', '大雪'][JIE_INDICES.indexOf(idx)]
  }));
}

// ==================== 四柱计算 ====================

/**
 * 计算年柱
 * 以立春为界，立春前归上一年
 */
function getYearPillar(year, month, day) {
  const lichun = getSolarTerm(year, 2); // 立春
  let actualYear = year;
  const birthDate = new Date(year, month - 1, day);
  if (birthDate < lichun) {
    actualYear = year - 1;
  }
  
  // 年干支：(年份 - 4) % 60 为六十甲子序号
  const idx = (actualYear - 4) % 60;
  const ganIdx = idx % 10;
  const zhiIdx = idx % 12;
  
  return {
    gan: TIAN_GAN[ganIdx],
    zhi: DI_ZHI[zhiIdx],
    year: actualYear
  };
}

/**
 * 计算月柱
 * 以节气为界确定月份
 */
function getMonthPillar(year, month, day, yearGan) {
  // 获取当年和前一年的节气
  const jieqi = getJieQiDates(year);
  const prevJieqi = getJieQiDates(year - 1);
  const birthDate = new Date(year, month - 1, day);
  
  // 确定所在月份（地支）
  // 寅月(立春-惊蛰)、卯月(惊蛰-清明)...丑月(小寒-立春)
  let monthZhiIdx; // 寅=2, 卯=3 ... 丑=1
  let jieDate; // 当前节的日期
  
  // 按节气判断月份
  if (birthDate < jieqi[0].date) {
    // 在小寒之前，属于上一年大雪后 = 子月(上一年)
    monthZhiIdx = 0; // 子
    jieDate = prevJieqi[11].date; // 上一年大雪
  } else if (birthDate < jieqi[1].date) {
    monthZhiIdx = 1; // 丑月
    jieDate = jieqi[0].date;
  } else if (birthDate < jieqi[2].date) {
    monthZhiIdx = 2; // 寅月
    jieDate = jieqi[1].date;
  } else if (birthDate < jieqi[3].date) {
    monthZhiIdx = 3; // 卯月
    jieDate = jieqi[2].date;
  } else if (birthDate < jieqi[4].date) {
    monthZhiIdx = 4; // 辰月
    jieDate = jieqi[3].date;
  } else if (birthDate < jieqi[5].date) {
    monthZhiIdx = 5; // 巳月
    jieDate = jieqi[4].date;
  } else if (birthDate < jieqi[6].date) {
    monthZhiIdx = 6; // 午月
    jieDate = jieqi[5].date;
  } else if (birthDate < jieqi[7].date) {
    monthZhiIdx = 7; // 未月
    jieDate = jieqi[6].date;
  } else if (birthDate < jieqi[8].date) {
    monthZhiIdx = 8; // 申月
    jieDate = jieqi[7].date;
  } else if (birthDate < jieqi[9].date) {
    monthZhiIdx = 9; // 酉月
    jieDate = jieqi[8].date;
  } else if (birthDate < jieqi[10].date) {
    monthZhiIdx = 10; // 戌月
    jieDate = jieqi[9].date;
  } else if (birthDate < jieqi[11].date) {
    monthZhiIdx = 11; // 亥月
    jieDate = jieqi[10].date;
  } else {
    monthZhiIdx = 0; // 子月（大雪后）
    jieDate = jieqi[11].date;
  }
  
  // 年上起月法：确定月天干
  // 甲己之年丙作首 → 寅月天干为丙
  // 乙庚之岁戊为头 → 寅月天干为戊
  // 丙辛之年寻庚上 → 寅月天干为庚
  // 丁壬壬寅顺水流 → 寅月天干为壬
  // 戊癸之年何方觅 → 寅月天干为甲
  const yearGanIdx = TIAN_GAN.indexOf(yearGan);
  const startGanMap = { 0: 2, 1: 4, 2: 6, 3: 8, 4: 0, 5: 2, 6: 4, 7: 6, 8: 8, 9: 0 };
  // 寅月=2，monthZhiIdx对应的偏移
  const offset = (monthZhiIdx - 2 + 12) % 12;
  const monthGanIdx = (startGanMap[yearGanIdx] + offset) % 10;
  
  return {
    gan: TIAN_GAN[monthGanIdx],
    zhi: DI_ZHI[monthZhiIdx],
    jieDate: jieDate
  };
}

/**
 * 计算日柱
 * 使用基姆拉尔森公式的变体
 */
function getDayPillar(year, month, day) {
  // 计算从基准日（如1900年1月1日=甲子日，但实际1900-01-01是庚子日）到目标日的天数
  // 1900年1月1日的干支序号：庚=6, 子=0 → 六十甲子第36位(庚子)
  // 实际用儒略日差值法
  
  function toJulianDay(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  
  const jd = toJulianDay(year, month, day);
  const baseJD = toJulianDay(1900, 1, 1); // 庚子日
  const diff = Math.round(jd - baseJD);
  
  // 1900-01-01 是庚子日，干序6，支序0，甲子序36
  const ganIdx = ((diff % 10) + 6) % 10;
  const zhiIdx = ((diff % 12) + 0) % 12;
  
  return {
    gan: TIAN_GAN[ganIdx >= 0 ? ganIdx : ganIdx + 10],
    zhi: DI_ZHI[zhiIdx >= 0 ? zhiIdx : zhiIdx + 12]
  };
}

/**
 * 计算时柱
 * 日上起时法（五鼠遁元）
 */
function getHourPillar(dayGan, hour) {
  // 确定时辰地支
  let zhiIdx;
  if (hour === 23 || hour === 0) zhiIdx = 0;       // 子时
  else zhiIdx = Math.floor((hour + 1) / 2);
  
  // 日上起时法
  const dayGanIdx = TIAN_GAN.indexOf(dayGan);
  const startGanMap = { 0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 0, 6: 2, 7: 4, 8: 6, 9: 8 };
  const ganIdx = (startGanMap[dayGanIdx] + zhiIdx) % 10;
  
  return {
    gan: TIAN_GAN[ganIdx],
    zhi: DI_ZHI[zhiIdx]
  };
}

// ==================== 十神计算 ====================

/**
 * 计算某天干相对于日主的十神
 */
function getShiShen(dayGan, otherGan) {
  if (dayGan === otherGan) return '比肩';
  
  const dayWX = WU_XING_MAP[dayGan];
  const otherWX = WU_XING_MAP[otherGan];
  const dayYY = YIN_YANG_MAP[dayGan];
  const otherYY = YIN_YANG_MAP[otherGan];
  const sameYY = dayYY === otherYY ? '同' : '异';
  
  let relation;
  if (dayWX === otherWX) relation = '同';
  else if (SHENG_MAP[dayWX] === otherWX) relation = '生';    // 我生
  else if (KE_MAP[dayWX] === otherWX) relation = '克';       // 我克
  else if (SHENG_MAP[otherWX] === dayWX) relation = '被生';  // 生我
  else if (KE_MAP[otherWX] === dayWX) relation = '被克';     // 克我
  
  return SHI_SHEN_TABLE[`${relation}_${sameYY}`];
}

// ==================== 大运计算 ====================

/**
 * 计算大运
 * @param {string} yearGan 年干
 * @param {string} gender 'male' | 'female'
 * @param {object} monthPillar 月柱 {gan, zhi}
 * @param {Date} birthDate 出生日期
 * @param {number} birthYear 出生年份
 * @param {number} birthMonth 出生月份
 * @param {number} birthDay 出生日
 */
function getDaYun(yearGan, gender, monthPillar, birthYear, birthMonth, birthDay) {
  const yearYY = YIN_YANG_MAP[yearGan];
  
  // 阳男阴女顺排，阴男阳女逆排
  const isShun = (yearYY === '阳' && gender === 'male') || (yearYY === '阴' && gender === 'female');
  
  // 计算起运年龄
  const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
  const jieqiDates = getJieQiDates(birthYear);
  const nextYearJieqi = getJieQiDates(birthYear + 1);
  const prevYearJieqi = getJieQiDates(birthYear - 1);
  
  // 收集所有节气日期（前一年+当年+后一年）
  const allJie = [
    ...prevYearJieqi.map(j => j.date),
    ...jieqiDates.map(j => j.date),
    ...nextYearJieqi.map(j => j.date)
  ].sort((a, b) => a - b);
  
  let targetJieDate;
  if (isShun) {
    // 顺排：找出生后最近的节
    targetJieDate = allJie.find(d => d > birthDate);
  } else {
    // 逆排：找出生前最近的节
    const before = allJie.filter(d => d <= birthDate);
    targetJieDate = before[before.length - 1];
  }
  
  const diffDays = Math.abs(Math.round((targetJieDate - birthDate) / (1000 * 60 * 60 * 24)));
  const startAge = Math.round(diffDays / 3);
  
  // 排列大运干支
  const monthGanIdx = TIAN_GAN.indexOf(monthPillar.gan);
  const monthZhiIdx = DI_ZHI.indexOf(monthPillar.zhi);
  const direction = isShun ? 1 : -1;
  
  const dayunList = [];
  for (let i = 1; i <= 8; i++) {
    const ganIdx = ((monthGanIdx + i * direction) % 10 + 10) % 10;
    const zhiIdx = ((monthZhiIdx + i * direction) % 12 + 12) % 12;
    dayunList.push({
      gan: TIAN_GAN[ganIdx],
      zhi: DI_ZHI[zhiIdx],
      startAge: startAge + (i - 1) * 10,
      endAge: startAge + i * 10 - 1,
      startYear: birthYear + startAge + (i - 1) * 10
    });
  }
  
  return {
    startAge,
    direction: isShun ? '顺排' : '逆排',
    list: dayunList
  };
}

// ==================== 五行统计 ====================

function countWuXing(pillars) {
  const count = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  
  // 天干
  for (const p of pillars) {
    count[WU_XING_MAP[p.gan]] += 1;
  }
  
  // 地支藏干（按权重）
  const weights = [0.6, 0.3, 0.1];
  for (const p of pillars) {
    const cg = CANG_GAN[p.zhi];
    cg.forEach((g, i) => {
      count[WU_XING_MAP[g]] += weights[i] || 0.1;
    });
  }
  
  return count;
}

// ==================== 流年 ====================

function getLiuNian(year) {
  const idx = (year - 4) % 60;
  const ganIdx = idx % 10;
  const zhiIdx = idx % 12;
  return {
    gan: TIAN_GAN[ganIdx],
    zhi: DI_ZHI[zhiIdx]
  };
}

// ==================== 主函数：完整排盘 ====================

/**
 * @param {object} params
 * @param {number} params.year - 阳历年
 * @param {number} params.month - 阳历月
 * @param {number} params.day - 阳历日
 * @param {number} params.hour - 出生小时 (0-23)
 * @param {string} params.gender - 'male' | 'female'
 * @param {string} params.name - 姓名
 */
function baziPaipan(params) {
  const { year, month, day, hour, gender, name } = params;
  
  // 四柱
  const yearPillar = getYearPillar(year, month, day);
  const monthPillar = getMonthPillar(year, month, day, yearPillar.gan);
  const dayPillar = getDayPillar(year, month, day);
  
  let hourPillar = null;
  if (hour !== null && hour !== undefined) {
    // 夜子时处理：23:00后用次日日柱
    let dayGanForHour = dayPillar.gan;
    if (hour >= 23) {
      const nextDay = getDayPillar(year, month, day + 1);
      dayGanForHour = nextDay.gan;
    }
    hourPillar = getHourPillar(dayGanForHour, hour);
  }
  
  // 日主
  const dayGan = dayPillar.gan;
  
  // 十神
  const yearShiShen = getShiShen(dayGan, yearPillar.gan);
  const monthShiShen = getShiShen(dayGan, monthPillar.gan);
  const hourShiShen = hourPillar ? getShiShen(dayGan, hourPillar.gan) : null;
  
  // 藏干及其十神
  function getCangGanShiShen(zhi) {
    return CANG_GAN[zhi].map(g => ({
      gan: g,
      wuxing: WU_XING_MAP[g],
      shiShen: getShiShen(dayGan, g)
    }));
  }
  
  // 五行统计
  const pillars = [yearPillar, monthPillar, dayPillar];
  if (hourPillar) pillars.push(hourPillar);
  const wuxingCount = countWuXing(pillars);
  
  // 大运
  const dayun = getDaYun(yearPillar.gan, gender, monthPillar, year, month, day);
  
  // 当前流年
  const currentYear = new Date().getFullYear();
  const liunian = getLiuNian(currentYear);
  
  // 当前年龄
  const age = currentYear - year;
  
  // 当前大运
  let currentDayun = null;
  for (const dy of dayun.list) {
    if (age >= dy.startAge && age <= dy.endAge) {
      currentDayun = dy;
      break;
    }
  }
  
  return {
    name,
    gender: gender === 'male' ? '男' : '女',
    birthInfo: { year, month, day, hour },
    
    // 四柱
    yearPillar: {
      ...yearPillar,
      wuxing: { gan: WU_XING_MAP[yearPillar.gan], zhi: WU_XING_MAP[yearPillar.zhi] },
      shiShen: yearShiShen,
      cangGan: getCangGanShiShen(yearPillar.zhi),
      shengxiao: SHENG_XIAO[DI_ZHI.indexOf(yearPillar.zhi)]
    },
    monthPillar: {
      ...monthPillar,
      wuxing: { gan: WU_XING_MAP[monthPillar.gan], zhi: WU_XING_MAP[monthPillar.zhi] },
      shiShen: monthShiShen,
      cangGan: getCangGanShiShen(monthPillar.zhi)
    },
    dayPillar: {
      ...dayPillar,
      wuxing: { gan: WU_XING_MAP[dayPillar.gan], zhi: WU_XING_MAP[dayPillar.zhi] },
      shiShen: '日主',
      cangGan: getCangGanShiShen(dayPillar.zhi)
    },
    hourPillar: hourPillar ? {
      ...hourPillar,
      wuxing: { gan: WU_XING_MAP[hourPillar.gan], zhi: WU_XING_MAP[hourPillar.zhi] },
      shiShen: hourShiShen,
      cangGan: getCangGanShiShen(hourPillar.zhi)
    } : null,
    
    // 日主信息
    dayMaster: {
      gan: dayGan,
      wuxing: WU_XING_MAP[dayGan],
      yinyang: YIN_YANG_MAP[dayGan]
    },
    
    // 五行统计
    wuxingCount,
    
    // 大运
    dayun,
    currentDayun,
    
    // 流年
    currentYear,
    age,
    liunian: {
      ...liunian,
      wuxing: { gan: WU_XING_MAP[liunian.gan], zhi: WU_XING_MAP[liunian.zhi] },
      shiShen: getShiShen(dayGan, liunian.gan)
    }
  };
}

// 浏览器全局可用
