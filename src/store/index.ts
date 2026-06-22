import type {
  PaymentOrder,
  Coupon,
  RedemptionRecord,
  RefundRecord,
  DiscrepancyRecord,
  AuditTrail,
  DailyReport
} from '@/types';

const hasElectron =
  typeof window !== 'undefined' &&
  !!window.electronAPI;

const STORAGE_KEYS = {
  PAYMENT_ORDERS: 'paymentOrders',
  COUPONS: 'coupons',
  REDEMPTIONS: 'redemptionRecords',
  REFUNDS: 'refundRecords',
  DISCREPANCIES: 'discrepancies',
  AUDIT_TRAILS: 'auditTrails',
  DAILY_REPORTS: 'dailyReports'
};

class Store {
  async readJSON<T>(key: string, defaultValue: T): Promise<T> {
    if (hasElectron) {
      return await window.electronAPI.readData(key, defaultValue);
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  }

  async writeJSON<T>(key: string, data: T): Promise<boolean> {
    if (hasElectron) {
      return await window.electronAPI.writeData(key, data);
    }
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  }

  async readPaymentOrders(): Promise<PaymentOrder[]> {
    return this.readJSON<PaymentOrder[]>(STORAGE_KEYS.PAYMENT_ORDERS, []);
  }

  async writePaymentOrders(data: PaymentOrder[]): Promise<boolean> {
    return this.writeJSON(STORAGE_KEYS.PAYMENT_ORDERS, data);
  }

  async readCoupons(): Promise<Coupon[]> {
    return this.readJSON<Coupon[]>(STORAGE_KEYS.COUPONS, []);
  }

  async writeCoupons(data: Coupon[]): Promise<boolean> {
    return this.writeJSON(STORAGE_KEYS.COUPONS, data);
  }

  async readRedemptions(): Promise<RedemptionRecord[]> {
    return this.readJSON<RedemptionRecord[]>(STORAGE_KEYS.REDEMPTIONS, []);
  }

  async writeRedemptions(data: RedemptionRecord[]): Promise<boolean> {
    return this.writeJSON(STORAGE_KEYS.REDEMPTIONS, data);
  }

  async readRefunds(): Promise<RefundRecord[]> {
    return this.readJSON<RefundRecord[]>(STORAGE_KEYS.REFUNDS, []);
  }

  async writeRefunds(data: RefundRecord[]): Promise<boolean> {
    return this.writeJSON(STORAGE_KEYS.REFUNDS, data);
  }

  async readDiscrepancies(): Promise<DiscrepancyRecord[]> {
    return this.readJSON<DiscrepancyRecord[]>(STORAGE_KEYS.DISCREPANCIES, []);
  }

  async writeDiscrepancies(data: DiscrepancyRecord[]): Promise<boolean> {
    return this.writeJSON(STORAGE_KEYS.DISCREPANCIES, data);
  }

  async readAuditTrails(): Promise<AuditTrail[]> {
    return this.readJSON<AuditTrail[]>(STORAGE_KEYS.AUDIT_TRAILS, []);
  }

  async writeAuditTrails(data: AuditTrail[]): Promise<boolean> {
    return this.writeJSON(STORAGE_KEYS.AUDIT_TRAILS, data);
  }

  async readDailyReports(): Promise<DailyReport[]> {
    return this.readJSON<DailyReport[]>(STORAGE_KEYS.DAILY_REPORTS, []);
  }

  async writeDailyReports(data: DailyReport[]): Promise<boolean> {
    return this.writeJSON(STORAGE_KEYS.DAILY_REPORTS, data);
  }

  async addAuditTrail(trail: Omit<AuditTrail, 'id' | 'timestamp'>): Promise<void> {
    const trails = await this.readAuditTrails();
    const randomStr = Math.floor(Math.random() * 1000).toString();
    trails.unshift(Object.assign({}, trail, {
      id: 'AT' + Date.now().toString() + randomStr,
      timestamp: new Date().toISOString()
    }));
    await this.writeAuditTrails(trails);
  }

  async openFileDialog(filters?: any[]): Promise<string[]> {
    if (hasElectron) {
      return await window.electronAPI.openFile(filters);
    }
    return [];
  }

  async saveFileDialog(defaultPath?: string, filters?: any[]): Promise<string> {
    if (hasElectron) {
      return await window.electronAPI.saveFile(defaultPath, filters);
    }
    return '';
  }
}

export const store = new Store();

export function genId(prefix: string): string {
  return prefix + Date.now().toString() + Math.floor(Math.random() * 10000).toString();
}
