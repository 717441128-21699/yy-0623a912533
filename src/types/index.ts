export interface PaymentOrder {
  id: string;
  orderNo: string;
  date: string;
  customerId: string;
  customerName: string;
  phone: string;
  totalAmount: number;
  paidAmount: number;
  payMethod: string;
  couponNo?: string;
  projectName: string;
  projectCategory: string;
  consultant: string;
  salesStore: string;
  sourceType: 'normal' | 'gift' | 'staff';
  remark?: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  couponNo: string;
  couponName: string;
  customerId: string;
  customerName: string;
  phone: string;
  projectName: string;
  projectCategory: string;
  totalCount: number;
  usedCount: number;
  unitPrice: number;
  totalAmount: number;
  soldStore: string;
  validFrom: string;
  validTo: string;
  sourceType: 'normal' | 'gift' | 'staff';
  issueDate: string;
  consultant: string;
  status: 'active' | 'used_up' | 'expired';
}

export interface RedemptionRecord {
  id: string;
  redemptionNo: string;
  date: string;
  time: string;
  customerId: string;
  customerName: string;
  couponNo: string;
  couponName: string;
  projectName: string;
  projectCategory: string;
  redemptionCount: number;
  unitPrice: number;
  amount: number;
  serviceStore: string;
  soldStore: string;
  consultant: string;
  doctor: string;
  operator: string;
  phone?: string;
  remark?: string;
}

export interface RefundRecord {
  id: string;
  refundNo: string;
  date: string;
  customerId: string;
  customerName: string;
  phone: string;
  couponNo: string;
  couponName: string;
  projectName: string;
  totalCount: number;
  usedCount: number;
  remainingCount: number;
  refundCount: number;
  refundAmount: number;
  soldStore: string;
  serviceStore: string;
  reason: string;
  approver: string;
  auditStatus: 'pending' | 'approved' | 'rejected';
  auditRemark?: string;
  createdAt: string;
}

export type DiscrepancyType =
  | 'paid_not_redeemed'
  | 'redeemed_not_paid'
  | 'duplicate_redemption'
  | 'amount_mismatch';

export interface DiscrepancyRecord {
  id: string;
  type: DiscrepancyType;
  date: string;
  customerId: string;
  customerName: string;
  couponNo?: string;
  projectName?: string;
  paidAmount?: number;
  redeemedAmount?: number;
  diffAmount: number;
  description: string;
  relatedOrderNo?: string;
  relatedRedemptionNo?: string;
  relatedIds: string[];
  handler?: string;
  handleOpinion?: string;
  handleStatus: 'pending' | 'processing' | 'resolved';
  handleTime?: string;
}

export interface AuditTrail {
  id: string;
  module: string;
  action: string;
  operator: string;
  targetId: string;
  beforeData?: any;
  afterData?: any;
  remark?: string;
  timestamp: string;
}

export interface DailyReport {
  id: string;
  reportDate: string;
  generatedAt: string;
  generatedBy: string;
  summary: {
    totalOrders: number;
    totalPaidAmount: number;
    totalRedemptions: number;
    totalRedeemedAmount: number;
    totalRefunds: number;
    totalRefundAmount: number;
    discrepancyCount: number;
    giftCouponCount: number;
    staffCouponCount: number;
    normalCouponCount: number;
  };
  storeBreakdown: {
    store: string;
    paidAmount: number;
    redeemedAmount: number;
    refundAmount: number;
    orderCount?: number;
    redemptionCount?: number;
    net?: number;
  }[];
  crossStoreSplit: {
    soldStore: string;
    serviceStore: string;
    splitAmount: number;
    times?: number;
    totalAmount?: number;
    serviceShare?: number;
    soldShare?: number;
  }[];
  status: 'draft' | 'submitted' | 'approved';
  approver?: string;
  approvedAt?: string;
}

export interface SedimentCoupon {
  id: string;
  couponNo: string;
  customerName: string;
  phone: string;
  couponName: string;
  totalCount: number;
  usedCount: number;
  remainingCount: number;
  unitPrice: number;
  remainingAmount: number;
  lastUsedDate: string;
  issueDate: string;
  validTo: string;
  daysUnused: number;
  sedimentLevel: 'high' | 'medium' | 'low';
  consultant: string;
  soldStore: string;
}
