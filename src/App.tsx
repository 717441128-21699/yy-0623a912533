import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Tooltip, Badge, App as AntdApp } from 'antd';
import {
  ImportOutlined,
  UnorderedListOutlined,
  AlertOutlined,
  RollbackOutlined,
  TeamOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';

import ImportPage from './pages/Import';
import RedemptionDetailPage from './pages/RedemptionDetail';
import DiscrepancyPage from './pages/Discrepancy';
import RefundPage from './pages/Refund';
import ResponsibilityPage from './pages/Responsibility';
import ReportPage from './pages/Report';

import type { PaymentOrder, Coupon, RedemptionRecord, RefundRecord, DiscrepancyRecord, AuditTrail, DailyReport } from './types';
import { store, genId } from './store';
import { generateMockData, generateDiscrepancies, metaData } from './utils/mockData';

const { Header, Sider, Content } = Layout;

interface AppContextType {
  businessDate: string;
  setBusinessDate: (d: string) => void;
  paymentOrders: PaymentOrder[];
  setPaymentOrders: React.Dispatch<React.SetStateAction<PaymentOrder[]>>;
  coupons: Coupon[];
  setCoupons: React.Dispatch<React.SetStateAction<Coupon[]>>;
  redemptions: RedemptionRecord[];
  setRedemptions: React.Dispatch<React.SetStateAction<RedemptionRecord[]>>;
  refunds: RefundRecord[];
  setRefunds: React.Dispatch<React.SetStateAction<RefundRecord[]>>;
  discrepancies: DiscrepancyRecord[];
  setDiscrepancies: React.Dispatch<React.SetStateAction<DiscrepancyRecord[]>>;
  auditTrails: AuditTrail[];
  dailyReports: DailyReport[];
  setDailyReports: React.Dispatch<React.SetStateAction<DailyReport[]>>;
  addAudit: (trail: Omit<AuditTrail, 'id' | 'timestamp'>) => void;
  persistAll: () => Promise<void>;
  loadMockData: () => Promise<void>;
  meta: typeof metaData;
}

export const AppContext = createContext<AppContextType | null>(null);
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};

const MENU_ITEMS = [
  { key: '/import', label: '数据导入', icon: <ImportOutlined /> },
  { key: '/redemption', label: '核销明细', icon: <UnorderedListOutlined /> },
  { key: '/discrepancy', label: '差异核对', icon: <AlertOutlined /> },
  { key: '/refund', label: '退款关联', icon: <RollbackOutlined /> },
  { key: '/responsibility', label: '责任归属', icon: <TeamOutlined /> },
  { key: '/report', label: '结账报告', icon: <FileTextOutlined /> }
];

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntdApp.useApp();
  const [collapsed, setCollapsed] = useState(false);

  const [businessDate, setBusinessDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRecord[]>([]);
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [ready, setReady] = useState(false);

  const addAudit = useCallback((trail: Omit<AuditTrail, 'id' | 'timestamp'>) => {
    const newTrail: AuditTrail = {
      ...trail,
      id: genId('AT'),
      timestamp: new Date().toISOString()
    };
    setAuditTrails(prev => [newTrail, ...prev].slice(0, 500));
  }, []);

  const persistAll = useCallback(async () => {
    await Promise.all([
      store.writePaymentOrders(paymentOrders),
      store.writeCoupons(coupons),
      store.writeRedemptions(redemptions),
      store.writeRefunds(refunds),
      store.writeDiscrepancies(discrepancies),
      store.writeAuditTrails(auditTrails),
      store.writeDailyReports(dailyReports)
    ]);
  }, [paymentOrders, coupons, redemptions, refunds, discrepancies, auditTrails, dailyReports]);

  const loadMockData = useCallback(async () => {
    const mock = generateMockData(businessDate);
    setPaymentOrders(mock.paymentOrders);
    setCoupons(mock.coupons);
    setRedemptions(mock.redemptions);
    setRefunds(mock.refunds);
    const disc = generateDiscrepancies(mock.paymentOrders, mock.redemptions, businessDate);
    setDiscrepancies(disc);
    addAudit({
      module: 'system',
      action: 'load_mock',
      operator: '财务员',
      targetId: businessDate,
      remark: '加载模拟演示数据'
    });
    message.success(`已加载 ${businessDate} 的演示数据`);
  }, [businessDate, addAudit, message]);

  useEffect(() => {
    (async () => {
      const [po, cp, rd, rf, ds, at, dr] = await Promise.all([
        store.readPaymentOrders(),
        store.readCoupons(),
        store.readRedemptions(),
        store.readRefunds(),
        store.readDiscrepancies(),
        store.readAuditTrails(),
        store.readDailyReports()
      ]);
      setPaymentOrders(po);
      setCoupons(cp);
      setRedemptions(rd);
      setRefunds(rf);
      setDiscrepancies(ds);
      setAuditTrails(at);
      setDailyReports(dr);
      setReady(true);
      if (po.length === 0 && cp.length === 0 && rd.length === 0) {
        const mock = generateMockData(businessDate);
        setPaymentOrders(mock.paymentOrders);
        setCoupons(mock.coupons);
        setRedemptions(mock.redemptions);
        setRefunds(mock.refunds);
        const disc = generateDiscrepancies(mock.paymentOrders, mock.redemptions, businessDate);
        setDiscrepancies(disc);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(() => persistAll(), 15000);
    const onBeforeUnload = () => persistAll();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(t);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [persistAll]);

  useEffect(() => {
    if (!location.pathname || location.pathname === '/') {
      navigate('/import');
    }
  }, [location, navigate]);

  const pendingCount = discrepancies.filter(d => d.handleStatus === 'pending').length;
  const refundPendingCount = refunds.filter(r => r.auditStatus === 'pending').length;

  if (!ready) return null;

  return (
    <AppContext.Provider
      value={{
        businessDate,
        setBusinessDate,
        paymentOrders,
        setPaymentOrders,
        coupons,
        setCoupons,
        redemptions,
        setRedemptions,
        refunds,
        setRefunds,
        discrepancies,
        setDiscrepancies,
        auditTrails,
        dailyReports,
        setDailyReports,
        addAudit,
        persistAll,
        loadMockData,
        meta: metaData
      }}
    >
      <Layout style={{ height: '100vh', width: '100vw' }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={220}
          style={{ background: '#111827' }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: collapsed ? 18 : 15,
              fontWeight: 600,
              letterSpacing: 0.5
            }}
          >
            {collapsed ? '医美' : '医美卡券对账系统'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={MENU_ITEMS.map(item => {
              if (item.key === '/discrepancy' && pendingCount > 0) {
                return {
                  ...item,
                  label: (
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>{item.label}</span>
                      <Badge count={pendingCount} size="small" style={{ marginRight: collapsed ? 0 : -6 }} />
                    </span>
                  )
                };
              }
              if (item.key === '/refund' && refundPendingCount > 0) {
                return {
                  ...item,
                  label: (
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>{item.label}</span>
                      <Badge count={refundPendingCount} size="small" style={{ marginRight: collapsed ? 0 : -6 }} />
                    </span>
                  )
                };
              }
              return item;
            })}
            onClick={({ key }) => navigate(key as string)}
            style={{ borderRight: 0, padding: '12px 6px' }}
          />
        </Sider>

        <Layout>
          <Header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              background: '#fff',
              borderBottom: '1px solid #e5e7eb',
              height: 56,
              lineHeight: '56px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
                style: { cursor: 'pointer', fontSize: 16, color: '#374151' },
                onClick: () => setCollapsed(!collapsed)
              })}
              <div>
                <span className="app-header-title">
                  {MENU_ITEMS.find(m => m.key === location.pathname)?.label || '系统'}
                </span>
                <span className="app-header-sub">
                  营业日期：<span style={{ color: '#1f4e79', fontWeight: 500 }}>{businessDate}</span>
                </span>
              </div>
            </div>

            <Space size={20} align="center">
              <Tooltip title="重新加载演示数据">
                <span
                  onClick={loadMockData}
                  style={{
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: 12,
                    padding: '4px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 4,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#1f4e79')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                >
                  加载演示数据
                </span>
              </Tooltip>
              <Tooltip title="帮助">
                <QuestionCircleOutlined style={{ fontSize: 16, color: '#6b7280', cursor: 'pointer' }} />
              </Tooltip>
              <Tooltip title="设置">
                <SettingOutlined style={{ fontSize: 16, color: '#6b7280', cursor: 'pointer' }} />
              </Tooltip>
              <Badge count={pendingCount + refundPendingCount} size="small" offset={[-4, 4]}>
                <BellOutlined style={{ fontSize: 16, color: '#6b7280', cursor: 'pointer' }} />
              </Badge>
              <Dropdown
                menu={{
                  items: [
                    { key: 'profile', icon: <UserOutlined />, label: '个人资料' },
                    { type: 'divider' },
                    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' }
                  ]
                }}
                placement="bottomRight"
              >
                <Space style={{ cursor: 'pointer' }} size={8}>
                  <Avatar
                    size={30}
                    style={{ backgroundColor: '#1f4e79', fontSize: 13 }}
                    icon={<UserOutlined />}
                  />
                  <span style={{ fontSize: 13, color: '#374151' }}>财务员 · 李主管</span>
                </Space>
              </Dropdown>
            </Space>
          </Header>

          <Content
            style={{
              margin: 0,
              padding: 20,
              overflow: 'auto',
              height: 'calc(100vh - 56px)'
            }}
          >
            <Routes>
              <Route path="/import" element={<ImportPage />} />
              <Route path="/redemption" element={<RedemptionDetailPage />} />
              <Route path="/discrepancy" element={<DiscrepancyPage />} />
              <Route path="/refund" element={<RefundPage />} />
              <Route path="/responsibility" element={<ResponsibilityPage />} />
              <Route path="/report" element={<ReportPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </AppContext.Provider>
  );
};

export default App;
