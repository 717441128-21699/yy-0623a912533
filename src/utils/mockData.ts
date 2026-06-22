import dayjs from 'dayjs';
import type {
  PaymentOrder,
  Coupon,
  RedemptionRecord,
  RefundRecord,
  DiscrepancyRecord,
  DailyReport,
  SedimentCoupon
} from '@/types';
import { genId } from '@/store';

const CUSTOMERS = [
  { id: 'C001', name: '张晓红', phone: '13800000001' },
  { id: 'C002', name: '李美丽', phone: '13800000002' },
  { id: 'C003', name: '王芳华', phone: '13800000003' },
  { id: 'C004', name: '赵敏珍', phone: '13800000004' },
  { id: 'C005', name: '陈素云', phone: '13800000005' },
  { id: 'C006', name: '刘雅琴', phone: '13800000006' },
  { id: 'C007', name: '孙秀兰', phone: '13800000007' },
  { id: 'C008', name: '周翠英', phone: '13800000008' },
  { id: 'C009', name: '吴桂芳', phone: '13800000009' },
  { id: 'C010', name: '郑丽萍', phone: '13800000010' }
];

const CONSULTANTS = ['陈思雨', '林婉清', '黄雅婷', '徐梦琪', '何晓琳'];
const DOCTORS = ['程建华', '王志远', '李明辉', '张博源', '钱子轩'];
const STORES = ['总院（朝阳）', '分院（海淀）', '分院（西城）'];
const CATEGORIES = ['皮肤管理', '注射美容', '整形手术', '激光美容', '口腔美容', '纹绣半永久'];

const PROJECTS_BY_CATEGORY: Record<string, string[]> = {
  '皮肤管理': ['超光子嫩肤', '水光针补水', '小气泡清洁', '黄金微针', '果酸焕肤'],
  '注射美容': ['玻尿酸填充', '肉毒素除皱', '瘦脸针', '溶脂针', '童颜针'],
  '整形手术': ['双眼皮手术', '隆鼻术', '面部线雕', '眼袋去除', '自体脂肪填充'],
  '激光美容': ['皮秒激光祛斑', '激光脱毛', '热玛吉', '超声刀', '点阵激光'],
  '口腔美容': ['牙齿冷光美白', '牙齿矫正', '隐形牙套', '贴面修复', '种植牙'],
  '纹绣半永久': ['韩式半永久眉', '美瞳线', '水晶唇', '发际线补发', '孕睫术']
};

const PAY_METHODS = ['微信支付', '支付宝', '银行卡', '现金', '会员卡', '美团团购', '大众点评'];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randBetween = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const randFloat = (a: number, b: number, digits = 2) =>
  Number((a + Math.random() * (b - a)).toFixed(digits));

export function generateMockData(dateStr: string = dayjs().format('YYYY-MM-DD')) {
  const paymentOrders: PaymentOrder[] = [];
  const coupons: Coupon[] = [];
  const redemptions: RedemptionRecord[] = [];
  const refunds: RefundRecord[] = [];

  const issueDate = dayjs(dateStr).subtract(randBetween(0, 60), 'day').format('YYYY-MM-DD');

  CUSTOMERS.forEach((customer, idx) => {
    const category = pick(CATEGORIES);
    const project = pick(PROJECTS_BY_CATEGORY[category]);
    const unitPrice = randFloat(500, 9800);
    const count = randBetween(1, 6);
    const consultant = pick(CONSULTANTS);
    const soldStore = pick(STORES);
    const couponNo = `KQ${Date.now().toString().slice(-6)}${idx.toString().padStart(2, '0')}`;
    const sourceType: 'normal' | 'gift' | 'staff' =
      idx % 7 === 0 ? 'gift' : idx % 11 === 0 ? 'staff' : 'normal';

    const usedCount = randBetween(0, count);
    const remainingCount = count - usedCount;

    coupons.push({
      id: genId('CP'),
      couponNo,
      couponName: `${project} ×${count}次卡`,
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      projectName: project,
      projectCategory: category,
      totalCount: count,
      usedCount,
      unitPrice,
      totalAmount: Number((unitPrice * count).toFixed(2)),
      soldStore,
      validFrom: issueDate,
      validTo: dayjs(issueDate).add(365, 'day').format('YYYY-MM-DD'),
      sourceType,
      issueDate: dayjs(dateStr).subtract(randBetween(0, 30), 'day').format('YYYY-MM-DD'),
      consultant,
      status: usedCount >= count ? 'used_up' : 'active'
    });

    if (idx % 2 === 0) {
      paymentOrders.push({
        id: genId('PO'),
        orderNo: `SK${dateStr.replace(/-/g, '')}${(idx + 1).toString().padStart(4, '0')}`,
        date: dateStr,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        totalAmount: Number((unitPrice * count).toFixed(2)),
        paidAmount:
          sourceType === 'gift' || sourceType === 'staff'
            ? 0
            : Number((unitPrice * count).toFixed(2)),
        payMethod: pick(PAY_METHODS),
        couponNo,
        projectName: project,
        projectCategory: category,
        consultant,
        salesStore: soldStore,
        sourceType,
        createdAt: `${dateStr} ${randBetween(9, 20)}:${randBetween(0, 59)
          .toString()
          .padStart(2, '0')}:00`
      });
    }

    for (let r = 0; r < usedCount; r++) {
      const redDate =
        r === 0
          ? dateStr
          : dayjs(dateStr).subtract(randBetween(1, 20), 'day').format('YYYY-MM-DD');
      const serviceStore = Math.random() < 0.75 ? soldStore : pick(STORES.filter(s => s !== soldStore));
      redemptions.push({
        id: genId('RD'),
        redemptionNo: `HX${redDate.replace(/-/g, '')}${(r + 1).toString().padStart(4, '0')}${idx}`,
        date: redDate,
        time: `${randBetween(9, 20).toString().padStart(2, '0')}:${randBetween(0, 59)
          .toString()
          .padStart(2, '0')}`,
        customerId: customer.id,
        customerName: customer.name,
        couponNo,
        couponName: `${project} ×${count}次卡`,
        projectName: project,
        projectCategory: category,
        redemptionCount: 1,
        unitPrice,
        amount: unitPrice,
        serviceStore,
        soldStore,
        consultant,
        doctor: pick(DOCTORS),
        operator: pick(CONSULTANTS),
        remark: r === 2 ? '顾客要求加做一次导入' : undefined
      });
    }

    if (idx % 8 === 3 && remainingCount > 0) {
      refunds.push({
        id: genId('RF'),
        refundNo: `TK${dateStr.replace(/-/g, '')}${(idx + 1).toString().padStart(3, '0')}`,
        date: dateStr,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        couponNo,
        couponName: `${project} ×${count}次卡`,
        projectName: project,
        totalCount: count,
        usedCount,
        remainingCount,
        refundCount: Math.min(remainingCount, randBetween(1, 2)),
        refundAmount: Number((unitPrice * Math.min(remainingCount, randBetween(1, 2))).toFixed(2)),
        soldStore,
        serviceStore: soldStore,
        reason: pick(['顾客出国不再需要', '皮肤敏感医生建议暂停', '搬家距离较远', '与其他机构套餐重复', '效果不满意']),
        approver: '',
        auditStatus: pick(['pending', 'approved', 'pending']),
        createdAt: new Date().toISOString()
      });
    }
  });

  paymentOrders.push({
    id: genId('PO'),
    orderNo: `SK${dateStr.replace(/-/g, '')}9991`,
    date: dateStr,
    customerId: 'C011',
    customerName: '差异测试-已收费未核销',
    phone: '13900000011',
    totalAmount: 6800,
    paidAmount: 6800,
    payMethod: '微信支付',
    couponNo: 'KQDIFF001',
    projectName: '热玛吉面部',
    projectCategory: '激光美容',
    consultant: pick(CONSULTANTS),
    salesStore: STORES[0],
    sourceType: 'normal',
    createdAt: `${dateStr} 10:30:00`
  });

  redemptions.push({
    id: genId('RD'),
    redemptionNo: `HX${dateStr.replace(/-/g, '')}9991`,
    date: dateStr,
    time: '14:20',
    customerId: 'C012',
    customerName: '差异测试-已核销未收费',
    couponNo: 'KQDIFF002',
    couponName: '皮秒激光 ×3次卡',
    projectName: '皮秒激光祛斑',
    projectCategory: '激光美容',
    redemptionCount: 1,
    unitPrice: 2600,
    amount: 2600,
    serviceStore: STORES[1],
    soldStore: STORES[1],
    consultant: pick(CONSULTANTS),
    doctor: pick(DOCTORS),
    operator: pick(CONSULTANTS)
  });

  redemptions.push({
    id: genId('RD'),
    redemptionNo: `HX${dateStr.replace(/-/g, '')}9992`,
    date: dateStr,
    time: '14:35',
    customerId: 'C012',
    customerName: '差异测试-已核销未收费',
    couponNo: 'KQDIFF002',
    couponName: '皮秒激光 ×3次卡',
    projectName: '皮秒激光祛斑',
    projectCategory: '激光美容',
    redemptionCount: 1,
    unitPrice: 2600,
    amount: 2600,
    serviceStore: STORES[1],
    soldStore: STORES[1],
    consultant: pick(CONSULTANTS),
    doctor: pick(DOCTORS),
    operator: pick(CONSULTANTS),
    remark: '⚠ 疑似重复核销：同一券号当日重复使用'
  });

  paymentOrders.push({
    id: genId('PO'),
    orderNo: `SK${dateStr.replace(/-/g, '')}9992`,
    date: dateStr,
    customerId: 'C013',
    customerName: '差异测试-金额不一致',
    phone: '13900000013',
    totalAmount: 5200,
    paidAmount: 5200,
    payMethod: '银行卡',
    couponNo: 'KQDIFF003',
    projectName: '水光针补水',
    projectCategory: '皮肤管理',
    consultant: pick(CONSULTANTS),
    salesStore: STORES[2],
    sourceType: 'normal',
    createdAt: `${dateStr} 11:00:00`
  });
  redemptions.push({
    id: genId('RD'),
    redemptionNo: `HX${dateStr.replace(/-/g, '')}9993`,
    date: dateStr,
    time: '15:10',
    customerId: 'C013',
    customerName: '差异测试-金额不一致',
    couponNo: 'KQDIFF003',
    couponName: '水光针 ×5次卡',
    projectName: '水光针补水',
    projectCategory: '皮肤管理',
    redemptionCount: 1,
    unitPrice: 1100,
    amount: 1100,
    serviceStore: STORES[2],
    soldStore: STORES[2],
    consultant: pick(CONSULTANTS),
    doctor: pick(DOCTORS),
    operator: pick(CONSULTANTS)
  });

  return { paymentOrders, coupons, redemptions, refunds };
}

export function generateDiscrepancies(
  orders: PaymentOrder[],
  redemptions: RedemptionRecord[],
  dateStr: string
): DiscrepancyRecord[] {
  const discrepancies: DiscrepancyRecord[] = [];

  const orderByCoupon = new Map<string, PaymentOrder[]>();
  const redeemByCoupon = new Map<string, RedemptionRecord[]>();

  orders.forEach(o => {
    if (!o.couponNo) return;
    const arr = orderByCoupon.get(o.couponNo) || [];
    arr.push(o);
    orderByCoupon.set(o.couponNo, arr);
  });

  redemptions.forEach(r => {
    if (r.date !== dateStr) return;
    const arr = redeemByCoupon.get(r.couponNo) || [];
    arr.push(r);
    redeemByCoupon.set(r.couponNo, arr);
  });

  for (const [couponNo, ordList] of orderByCoupon.entries()) {
    const redList = redeemByCoupon.get(couponNo) || [];
    const firstOrd = ordList[0];
    if (redList.length === 0 && firstOrd.date === dateStr) {
      discrepancies.push({
        id: genId('DS'),
        type: 'paid_not_redeemed',
        date: dateStr,
        customerId: firstOrd.customerId,
        customerName: firstOrd.customerName,
        couponNo,
        projectName: firstOrd.projectName,
        paidAmount: firstOrd.paidAmount,
        redeemedAmount: 0,
        diffAmount: firstOrd.paidAmount,
        description: '顾客已完成付款，卡券已激活，但当日未见核销记录。可能为未到店核销或收银系统延迟。',
        relatedOrderNo: firstOrd.orderNo,
        relatedIds: ordList.map(o => o.id),
        handleStatus: 'pending'
      });
    }
    if (redList.length >= 2) {
      const totalRedeemed = redList.reduce((s, r) => s + r.amount, 0);
      discrepancies.push({
        id: genId('DS'),
        type: 'duplicate_redemption',
        date: dateStr,
        customerId: firstOrd.customerId,
        customerName: firstOrd.customerName,
        couponNo,
        projectName: firstOrd.projectName,
        paidAmount: firstOrd.paidAmount,
        redeemedAmount: totalRedeemed,
        diffAmount: totalRedeemed - (firstOrd.paidAmount / Math.max(1, firstOrd.paidAmount)) * redList[0].amount,
        description: `同一券号 ${couponNo} 在当日出现 ${redList.length} 条核销记录，疑似重复核销，请核实操作记录。`,
        relatedRedemptionNo: redList.map(r => r.redemptionNo).join('、'),
        relatedIds: redList.map(r => r.id),
        handleStatus: 'pending'
      });
    }
  }

  for (const [couponNo, redList] of redeemByCoupon.entries()) {
    const ordList = orderByCoupon.get(couponNo) || [];
    if (ordList.length === 0) {
      const firstR = redList[0];
      discrepancies.push({
        id: genId('DS'),
        type: 'redeemed_not_paid',
        date: dateStr,
        customerId: firstR.customerId,
        customerName: firstR.customerName,
        couponNo,
        projectName: firstR.projectName,
        paidAmount: 0,
        redeemedAmount: redList.reduce((s, r) => s + r.amount, 0),
        diffAmount: -redList.reduce((s, r) => s + r.amount, 0),
        description: `券号 ${couponNo} 已核销 ${redList.length} 次，但收款系统中查无对应收费记录。请核实是否漏单或卡券来源异常。`,
        relatedRedemptionNo: redList.map(r => r.redemptionNo).join('、'),
        relatedIds: redList.map(r => r.id),
        handleStatus: 'pending'
      });
    }
  }

  const diffCoupon = 'KQDIFF003';
  const orderDiff = orders.find(o => o.couponNo === diffCoupon);
  const redeemDiff = redemptions.find(r => r.couponNo === diffCoupon);
  if (orderDiff && redeemDiff) {
    const expectedUnit = Number((orderDiff.totalAmount / 5).toFixed(2));
    if (Math.abs(expectedUnit - redeemDiff.unitPrice) > 0.01) {
      discrepancies.push({
        id: genId('DS'),
        type: 'amount_mismatch',
        date: dateStr,
        customerId: orderDiff.customerId,
        customerName: orderDiff.customerName,
        couponNo: diffCoupon,
        projectName: orderDiff.projectName,
        paidAmount: expectedUnit,
        redeemedAmount: redeemDiff.unitPrice,
        diffAmount: expectedUnit - redeemDiff.unitPrice,
        description: `核销单价 ¥${redeemDiff.unitPrice.toFixed(2)} 与收费折算单价 ¥${expectedUnit.toFixed(2)} 不一致，请核查活动折扣或手工改价记录。`,
        relatedOrderNo: orderDiff.orderNo,
        relatedRedemptionNo: redeemDiff.redemptionNo,
        relatedIds: [orderDiff.id, redeemDiff.id],
        handleStatus: 'pending'
      });
    }
  }

  return discrepancies;
}

export function generateSedimentCoupons(coupons: Coupon[], today: string): SedimentCoupon[] {
  const sediment: SedimentCoupon[] = [];
  coupons.forEach(c => {
    const lastUsedDate = c.issueDate;
    const daysUnused = dayjs(today).diff(dayjs(lastUsedDate), 'day');
    const remainingCount = c.totalCount - c.usedCount;
    const remainingAmount = Number((remainingCount * c.unitPrice).toFixed(2));
    if (
      remainingCount > 0 &&
      daysUnused >= 30 &&
      remainingAmount >= 1000 &&
      c.status === 'active'
    ) {
      const sedimentLevel =
        remainingAmount >= 10000 ? 'high' : remainingAmount >= 5000 ? 'medium' : 'low';
      sediment.push({
        id: genId('SC'),
        couponNo: c.couponNo,
        customerName: c.customerName,
        phone: c.phone,
        couponName: c.couponName,
        totalCount: c.totalCount,
        usedCount: c.usedCount,
        remainingCount,
        unitPrice: c.unitPrice,
        remainingAmount,
        lastUsedDate,
        issueDate: c.issueDate,
        validTo: c.validTo,
        daysUnused,
        sedimentLevel,
        consultant: c.consultant,
        soldStore: c.soldStore
      });
    }
  });
  return sediment.sort((a, b) => b.remainingAmount - a.remainingAmount);
}

export const metaData = {
  consultants: CONSULTANTS,
  doctors: DOCTORS,
  stores: STORES,
  categories: CATEGORIES,
  projectsByCategory: PROJECTS_BY_CATEGORY,
  payMethods: PAY_METHODS
};
