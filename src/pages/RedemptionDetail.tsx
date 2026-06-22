import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  Tooltip,
  Drawer,
  Descriptions,
  App,
  Typography,
  Tabs,
  Statistic,
  Progress,
  Divider,
  Alert
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  ExportOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  UserOutlined,
  FileTextOutlined,
  ShopOutlined,
  GiftOutlined,
  TeamOutlined,
  DollarOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useApp } from '@/App';
import type { Coupon, RedemptionRecord, PaymentOrder } from '@/types';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

type ViewMode = 'byCustomer' | 'byCoupon' | 'byProject' | 'byStore' | 'timeline';

const sourceColorMap = {
  normal: { bg: '#eff6ff', text: '#1f4e79', label: '正常购买' },
  gift: { bg: '#dcfce7', text: '#16a34a', label: '赠送券' },
  staff: { bg: '#faf5ff', text: '#9333ea', label: '员工福利券' }
};

const RedemptionDetailPage: React.FC = () => {
  const { businessDate, paymentOrders, coupons, redemptions, meta, addAudit, setBusinessDate } = useApp();
  const { message, modal } = App.useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('byCoupon');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [keyword, setKeyword] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentCoupon, setCurrentCoupon] = useState<Coupon | null>(null);

  const filteredRedemptions = useMemo(() => {
    return redemptions.filter(r => {
      if (dateRange) {
        const d = dayjs(r.date);
        if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
      }
      if (storeFilter && r.serviceStore !== storeFilter) return false;
      if (categoryFilter && r.projectCategory !== categoryFilter) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        if (!`${r.customerName}${r.couponNo}${r.projectName}${r.phone}${r.redemptionNo}`.toLowerCase().includes(k)) return false;
      }
      return true;
    });
  }, [redemptions, dateRange, storeFilter, categoryFilter, keyword]);

  const filteredCoupons = useMemo(() => {
    return coupons.filter(c => {
      if (storeFilter && c.soldStore !== storeFilter) return false;
      if (sourceFilter && c.sourceType !== sourceFilter) return false;
      if (categoryFilter && c.projectCategory !== categoryFilter) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        if (!`${c.customerName}${c.couponNo}${c.projectName}${c.phone}`.toLowerCase().includes(k)) return false;
      }
      return true;
    });
  }, [coupons, storeFilter, sourceFilter, categoryFilter, keyword]);

  const todayStats = useMemo(() => {
    const todayR = dateRange
      ? filteredRedemptions
      : redemptions.filter(r => r.date === businessDate);
    const todayPO = dateRange
      ? paymentOrders.filter(o => {
        const d = dayjs(o.date);
        return !dateRange || (!d.isBefore(dateRange[0], 'day') && !d.isAfter(dateRange[1], 'day'));
      })
      : paymentOrders.filter(o => o.date === businessDate);
    return {
      redemptionCount: todayR.length,
      redemptionAmount: todayR.reduce((s, r) => s + r.amount, 0),
      orderCount: todayPO.length,
      orderAmount: todayPO.reduce((s, o) => s + o.paidAmount, 0),
      giftCoupons: filteredCoupons.filter(c => c.sourceType === 'gift').length,
      staffCoupons: filteredCoupons.filter(c => c.sourceType === 'staff').length,
      normalCoupons: filteredCoupons.filter(c => c.sourceType === 'normal').length,
      avgUseRate: filteredCoupons.length
        ? filteredCoupons.reduce((s, c) => s + (c.totalCount > 0 ? c.usedCount / c.totalCount : 0), 0) / filteredCoupons.length * 100
        : 0
    };
  }, [filteredRedemptions, redemptions, paymentOrders, filteredCoupons, businessDate, dateRange]);

  const couponViewData = useMemo(() => {
    return filteredCoupons.map(c => {
      const cRedemptions = filteredRedemptions.filter(r => r.couponNo === c.couponNo);
      const remainingCount = Math.max(0, c.totalCount - c.usedCount);
      const remainingAmount = Number((remainingCount * c.unitPrice).toFixed(2));
      const usedAmount = Number((c.usedCount * c.unitPrice).toFixed(2));
      const crossStore = cRedemptions.some(r => r.serviceStore !== c.soldStore);
      const sourceStyle = sourceColorMap[c.sourceType];
      return {
        ...c,
        key: c.id,
        remainingCount,
        remainingAmount,
        usedAmount,
        useRate: c.totalCount > 0 ? (c.usedCount / c.totalCount) * 100 : 0,
        redemptionCount: cRedemptions.length,
        lastRedemptionDate: cRedemptions.length ? cRedemptions[0].date : '—',
        crossStore,
        sourceStyle
      };
    }).sort((a, b) => (b.remainingAmount - a.remainingAmount));
  }, [filteredCoupons, filteredRedemptions]);

  const customerViewData = useMemo(() => {
    const map = new Map<string, any>();
    filteredRedemptions.forEach(r => {
      if (!map.has(r.customerId)) {
        map.set(r.customerId, {
          key: r.customerId,
          customerId: r.customerId,
          customerName: r.customerName,
          phone: r.phone || (coupons.find(c => c.customerId === r.customerId)?.phone) || '',
          totalRedemptions: 0,
          totalAmount: 0,
          couponCount: 0,
          categories: new Set<string>(),
          lastVisit: '',
          coupons: [] as any[]
        });
      }
      const d = map.get(r.customerId)!;
      d.totalRedemptions += r.redemptionCount;
      d.totalAmount = Number((d.totalAmount + r.amount).toFixed(2));
      d.categories.add(r.projectCategory);
      if (!d.lastVisit || r.date > d.lastVisit) d.lastVisit = r.date;
    });
    filteredCoupons.forEach(c => {
      if (!map.has(c.customerId)) {
        map.set(c.customerId, {
          key: c.customerId,
          customerId: c.customerId,
          customerName: c.customerName,
          phone: c.phone,
          totalRedemptions: 0,
          totalAmount: 0,
          couponCount: 0,
          categories: new Set<string>(),
          lastVisit: '',
          coupons: [] as any[]
        });
      }
      const d = map.get(c.customerId)!;
      d.couponCount += 1;
      d.coupons.push(c);
    });
    return Array.from(map.values()).map(d => ({
      ...d,
      categories: Array.from(d.categories),
      totalRemaining: Number((d.coupons.reduce((s: number, c: Coupon) => {
        const rem = c.totalCount - c.usedCount;
        return s + rem * c.unitPrice;
      }, 0)).toFixed(2))
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredRedemptions, filteredCoupons, coupons]);

  const projectViewData = useMemo(() => {
    const map = new Map<string, { key: string; category: string; project: string; count: number; amount: number; customerCount: Set<string>; avgPrice: number; }>();
    filteredRedemptions.forEach(r => {
      const k = `${r.projectCategory}|${r.projectName}`;
      if (!map.has(k)) {
        map.set(k, { key: k, category: r.projectCategory, project: r.projectName, count: 0, amount: 0, customerCount: new Set(), avgPrice: 0 });
      }
      const d = map.get(k)!;
      d.count += r.redemptionCount;
      d.amount = Number((d.amount + r.amount).toFixed(2));
      d.customerCount.add(r.customerId);
    });
    return Array.from(map.values()).map(d => ({
      ...d,
      customerCount: d.customerCount.size,
      avgPrice: d.count > 0 ? Number((d.amount / d.count).toFixed(2)) : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredRedemptions]);

  const storeViewData = useMemo(() => {
    const map = new Map<string, any>();
    const add = (store: string, field: string, value: number) => {
      if (!map.has(store)) {
        map.set(store, { key: store, store, soldAmount: 0, serviceAmount: 0, refundAmount: 0, soldCount: 0, serviceCount: 0, crossIn: 0, crossOut: 0 });
      }
      const d = map.get(store)!;
      d[field] = Number((d[field] + value).toFixed(2));
    };
    filteredCoupons.forEach(c => {
      add(c.soldStore, 'soldAmount', c.totalAmount);
      add(c.soldStore, 'soldCount', 1);
    });
    filteredRedemptions.forEach(r => {
      add(r.serviceStore, 'serviceAmount', r.amount);
      add(r.serviceStore, 'serviceCount', 1);
      if (r.serviceStore !== r.soldStore) {
        add(r.soldStore, 'crossOut', r.amount);
        add(r.serviceStore, 'crossIn', r.amount);
      }
    });
    return Array.from(map.values());
  }, [filteredCoupons, filteredRedemptions]);

  const openCouponDetail = (coupon: Coupon) => {
    setCurrentCoupon(coupon);
    setDrawerOpen(true);
    addAudit({
      module: 'redemption',
      action: 'view_coupon',
      operator: '财务员',
      targetId: coupon.couponNo,
      remark: `查看卡券 ${coupon.customerName} 的核销明细`
    });
  };

  const exportCurrentView = () => {
    let exportData: any[] = [];
    let filename = '';
    switch (viewMode) {
      case 'byCoupon':
        exportData = couponViewData.map(({ id, sourceStyle, ...rest }) => ({
          ...rest,
          sourceTypeLabel: sourceColorMap[rest.sourceType as keyof typeof sourceColorMap]?.label
        }));
        filename = `卡券明细-${dayjs().format('YYYYMMDD')}.xlsx`;
        break;
      case 'byCustomer':
        exportData = customerViewData.map(({ coupons, ...rest }) => ({
          ...rest,
          categories: rest.categories.join('、')
        }));
        filename = `顾客核销明细-${dayjs().format('YYYYMMDD')}.xlsx`;
        break;
      case 'byProject':
        exportData = projectViewData;
        filename = `项目消耗统计-${dayjs().format('YYYYMMDD')}.xlsx`;
        break;
      case 'byStore':
        exportData = storeViewData;
        filename = `门店维度统计-${dayjs().format('YYYYMMDD')}.xlsx`;
        break;
      case 'timeline':
        exportData = filteredRedemptions;
        filename = `核销流水-${dayjs().format('YYYYMMDD')}.xlsx`;
        break;
    }
    if (exportData.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '明细');
    XLSX.writeFile(wb, filename);
    addAudit({
      module: 'redemption',
      action: 'export',
      operator: '财务员',
      targetId: viewMode,
      remark: `导出 ${exportData.length} 条记录`
    });
    message.success(`已导出 ${exportData.length} 条记录到 ${filename}`);
  };

  const couponColumns = [
    { title: '券号', dataIndex: 'couponNo', width: 140, fixed: 'left' as const, render: (v: string) => <span className="tag-pro">{v}</span> },
    { title: '顾客', dataIndex: 'customerName', width: 100 },
    { title: '手机', dataIndex: 'phone', width: 120, render: (v: string) => v?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') },
    { title: '卡券名称', dataIndex: 'couponName', width: 180, ellipsis: true },
    { title: '项目类别', dataIndex: 'projectCategory', width: 100 },
    { title: '来源', dataIndex: 'sourceType', width: 90, render: (_: any, r: any) => (
      <Tag color={r.sourceType === 'gift' ? 'green' : r.sourceType === 'staff' ? 'purple' : 'blue'}>
        {r.sourceStyle.label}
      </Tag>
    )},
    { title: '总次数', dataIndex: 'totalCount', width: 70, align: 'center' as const },
    { title: '已用次数', dataIndex: 'usedCount', width: 75, align: 'center' as const },
    { title: '剩余次数', dataIndex: 'remainingCount', width: 75, align: 'center' as const },
    {
      title: '使用率', dataIndex: 'useRate', width: 130, render: (v: number) => (
        <Progress percent={Number(v.toFixed(0))} size="small"
          strokeColor={v >= 80 ? '#16a34a' : v >= 50 ? '#1f4e79' : '#d97706'} />
      )
    },
    { title: '单次价', dataIndex: 'unitPrice', width: 90, align: 'right' as const, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '已用金额', dataIndex: 'usedAmount', width: 100, align: 'right' as const, render: (v: number) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
    { title: '剩余金额', dataIndex: 'remainingAmount', width: 100, align: 'right' as const, render: (v: number) => <span className="amount-neutral">¥{v.toFixed(2)}</span> },
    { title: '售卖门店', dataIndex: 'soldStore', width: 110 },
    { title: '最近核销', dataIndex: 'lastRedemptionDate', width: 105 },
    { title: '跨店', dataIndex: 'crossStore', width: 60, align: 'center' as const, render: (v: boolean) => v ? <Tag color="orange">是</Tag> : <Tag>否</Tag> },
    {
      title: '操作', key: 'op', width: 80, fixed: 'right' as const,
      render: (_: any, r: Coupon) => (
        <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => openCouponDetail(r)}>
          详情
        </Button>
      )
    }
  ];

  const customerColumns = [
    { title: '顾客ID', dataIndex: 'customerId', width: 100, fixed: 'left' as const, render: (v: string) => <span className="tag-pro">{v}</span> },
    { title: '顾客姓名', dataIndex: 'customerName', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 120, render: (v: string) => v?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') },
    { title: '持卡数', dataIndex: 'couponCount', width: 80, align: 'center' as const },
    { title: '累计核销次数', dataIndex: 'totalRedemptions', width: 110, align: 'center' as const },
    { title: '累计核销金额', dataIndex: 'totalAmount', width: 120, align: 'right' as const, render: (v: number) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
    { title: '卡内剩余', dataIndex: 'totalRemaining', width: 120, align: 'right' as const, render: (v: number) => <span className="amount-neutral">¥{v.toFixed(2)}</span> },
    { title: '消费项目', dataIndex: 'categories', width: 200, render: (v: string[]) => v.map(c => <Tag key={c}>{c}</Tag>) },
    { title: '最近到店', dataIndex: 'lastVisit', width: 105 }
  ];

  const projectColumns = [
    { title: '项目类别', dataIndex: 'category', width: 110, fixed: 'left' as const },
    { title: '项目名称', dataIndex: 'project', width: 160, fixed: 'left' as const },
    { title: '核销次数', dataIndex: 'count', width: 100, align: 'center' as const },
    { title: '服务人数', dataIndex: 'customerCount', width: 100, align: 'center' as const },
    { title: '单次均价', dataIndex: 'avgPrice', width: 100, align: 'right' as const, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '总消耗金额', dataIndex: 'amount', width: 130, align: 'right' as const, render: (v: number) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
    { title: '金额占比', key: 'pct', width: 140, render: (_: any, r: any) => {
      const total = projectViewData.reduce((s, d) => s + d.amount, 0);
      const pct = total > 0 ? (r.amount / total) * 100 : 0;
      return <Progress percent={Number(pct.toFixed(1))} size="small" />;
    }}
  ];

  const storeColumns = [
    { title: '门店', dataIndex: 'store', width: 140, fixed: 'left' as const, render: (v: string) => <span><ShopOutlined style={{ color: '#1f4e79', marginRight: 6 }} />{v}</span> },
    { title: '售卖发卡数', dataIndex: 'soldCount', width: 100, align: 'center' as const },
    { title: '售卖金额', dataIndex: 'soldAmount', width: 120, align: 'right' as const, render: (v: number) => <span className="amount-neutral">¥{v.toFixed(2)}</span> },
    { title: '核销次数', dataIndex: 'serviceCount', width: 100, align: 'center' as const },
    { title: '核销金额', dataIndex: 'serviceAmount', width: 120, align: 'right' as const, render: (v: number) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
    { title: '跨店流入(他店在此服务)', dataIndex: 'crossIn', width: 170, align: 'right' as const, render: (v: number) => v > 0 ? <span className="amount-positive">¥{v.toFixed(2)}</span> : '—' },
    { title: '跨店流出(此店在他服务)', dataIndex: 'crossOut', width: 170, align: 'right' as const, render: (v: number) => v > 0 ? <span className="amount-negative">¥{v.toFixed(2)}</span> : '—' },
    { title: '净额', key: 'net', width: 120, align: 'right' as const, render: (_: any, r: any) => {
      const net = Number((r.serviceAmount - r.crossOut + r.crossIn).toFixed(2));
      return <span className={net >= 0 ? 'amount-positive' : 'amount-negative'}>¥{net.toFixed(2)}</span>;
    }}
  ];

  const timelineColumns = [
    { title: '核销时间', dataIndex: 'date', width: 170, fixed: 'left' as const, render: (_: any, r: RedemptionRecord) => `${r.date} ${r.time}` },
    { title: '核销单号', dataIndex: 'redemptionNo', width: 150, render: (v: string) => <span className="tag-pro">{v}</span> },
    { title: '券号', dataIndex: 'couponNo', width: 130, render: (v: string) => v ? <span className="tag-pro">{v}</span> : '—' },
    { title: '顾客', dataIndex: 'customerName', width: 100 },
    { title: '项目', dataIndex: 'projectName', width: 140 },
    { title: '类别', dataIndex: 'projectCategory', width: 90 },
    { title: '核销次数', dataIndex: 'redemptionCount', width: 75, align: 'center' as const },
    { title: '单次价', dataIndex: 'unitPrice', width: 90, align: 'right' as const, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '核销金额', dataIndex: 'amount', width: 100, align: 'right' as const, render: (v: number) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
    { title: '服务门店', dataIndex: 'serviceStore', width: 110 },
    { title: '售卖门店', dataIndex: 'soldStore', width: 110 },
    { title: '咨询师', dataIndex: 'consultant', width: 90 },
    { title: '操作医生', dataIndex: 'doctor', width: 90 },
    { title: '备注', dataIndex: 'remark', width: 150, ellipsis: true }
  ];

  const currentCouponRedemptions = currentCoupon
    ? filteredRedemptions.filter(r => r.couponNo === currentCoupon.couponNo).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const currentCouponOrder = currentCoupon
    ? paymentOrders.find(o => o.couponNo === currentCoupon.couponNo)
    : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">核销明细</h1>
          <p className="page-desc">按顾客、卡券、项目、门店等多维度归并查看核销流水；赠送券与员工福利券分开统计。</p>
        </div>
        <Space size={12}>
          <Button icon={<ReloadOutlined />} size="large">刷新</Button>
          <Button icon={<ExportOutlined />} size="large" onClick={exportCurrentView}>导出当前视图</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label"><DollarOutlined style={{ marginRight: 4 }} />累计核销金额</div>
            <div className="stat-card-value">¥{todayStats.redemptionAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label"><FileTextOutlined style={{ marginRight: 4 }} />核销总次数</div>
            <div className="stat-card-value">{todayStats.redemptionCount}<span className="stat-card-unit">次</span></div>
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label"><ShopOutlined style={{ marginRight: 4 }} />发卡总数</div>
            <div className="stat-card-value">{filteredCoupons.length}<span className="stat-card-unit">张</span></div>
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16, borderLeft: '3px solid #16a34a' }}>
            <div className="stat-card-label"><GiftOutlined style={{ marginRight: 4 }} />赠送券 {todayStats.giftCoupons} 张 / 员工券 {todayStats.staffCoupons} 张</div>
            <div className="stat-card-value" style={{ fontSize: 18 }}>
              <Tag color="green">{todayStats.giftCoupons}</Tag>
              <Tag color="purple" style={{ marginLeft: 4 }}>{todayStats.staffCoupons}</Tag>
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label"><TeamOutlined style={{ marginRight: 4 }} />正常购买卡</div>
            <div className="stat-card-value">{todayStats.normalCoupons}<span className="stat-card-unit">张</span></div>
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">卡券平均使用率</div>
            <Progress percent={Number(todayStats.avgUseRate.toFixed(0))} size="small" style={{ marginTop: 8 }} />
          </Card>
        </Col>
      </Row>

      <div className="filter-section">
        <Row gutter={[12, 12]} align="middle">
          <Col span={4}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={v => setDateRange(v as any)}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col span={3}>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="选择门店"
              value={storeFilter || undefined}
              onChange={setStoreFilter}
              options={meta.stores.map(s => ({ value: s, label: s }))}
            />
          </Col>
          <Col span={3}>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="项目类别"
              value={categoryFilter || undefined}
              onChange={setCategoryFilter}
              options={meta.categories.map(c => ({ value: c, label: c }))}
            />
          </Col>
          <Col span={3}>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="卡券来源"
              value={sourceFilter || undefined}
              onChange={setSourceFilter}
              options={[
                { value: 'normal', label: '正常购买' },
                { value: 'gift', label: '赠送券' },
                { value: 'staff', label: '员工福利券' }
              ]}
            />
          </Col>
          <Col span={6}>
            <Input
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              placeholder="搜索 顾客姓名 / 手机号 / 券号 / 项目 / 核销单号"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={5} style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setKeyword(''); setStoreFilter(''); setSourceFilter(''); setCategoryFilter(''); setDateRange(null); }} icon={<FilterOutlined />}>
                清空筛选
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={viewMode}
          onChange={(k) => setViewMode(k as ViewMode)}
          size="large"
          style={{ padding: '0 24px' }}
          tabBarExtraContent={
            <Text type="secondary" style={{ fontSize: 12 }}>
              共 {couponViewData.length} 张卡券 / {filteredRedemptions.length} 条核销
            </Text>
          }
          items={[
            {
              key: 'byCoupon',
              label: <span><FileTextOutlined /> 按卡券归并</span>,
              children: (
                <Table
                  size="small"
                  columns={couponColumns}
                  dataSource={couponViewData}
                  scroll={{ x: 1600, y: 560 }}
                  pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 张卡券` }}
                  rowClassName={(r: any) => r.remainingCount > 0 ? '' : 'table-row-usedup'}
                  onRow={(r: Coupon) => ({ onDoubleClick: () => openCouponDetail(r) })}
                />
              )
            },
            {
              key: 'byCustomer',
              label: <span><UserOutlined /> 按顾客归并</span>,
              children: (
                <Table
                  size="small"
                  columns={customerColumns}
                  dataSource={customerViewData}
                  scroll={{ x: 1200, y: 560 }}
                  pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 位顾客` }}
                />
              )
            },
            {
              key: 'byProject',
              label: <span><DollarOutlined /> 按项目统计</span>,
              children: (
                <Table
                  size="small"
                  columns={projectColumns}
                  dataSource={projectViewData}
                  scroll={{ y: 560 }}
                  pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 个项目` }}
                  summary={(cur) => {
                    const total = cur.reduce((s, d) => s + d.amount, 0);
                    const totalCnt = cur.reduce((s, d) => s + d.count, 0);
                    return (
                      <Table.Summary fixed>
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={2}><Text strong>合计</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="center"><Text strong>{totalCnt}</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={3} />
                          <Table.Summary.Cell index={4} />
                          <Table.Summary.Cell index={5} align="right"><Text strong type="success">¥{total.toFixed(2)}</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={6} />
                        </Table.Summary.Row>
                      </Table.Summary>
                    );
                  }}
                />
              )
            },
            {
              key: 'byStore',
              label: <span><ShopOutlined /> 按门店维度</span>,
              children: (
                <Table
                  size="small"
                  columns={storeColumns}
                  dataSource={storeViewData}
                  scroll={{ x: 1100, y: 560 }}
                  pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 家门店` }}
                />
              )
            },
            {
              key: 'timeline',
              label: <span>📋 核销流水明细</span>,
              children: (
                <Table
                  size="small"
                  columns={timelineColumns}
                  dataSource={filteredRedemptions.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).map(r => ({ ...r, key: r.id }))}
                  scroll={{ x: 1700, y: 560 }}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条流水` }}
                />
              )
            }
          ]}
        />
      </Card>

      <Drawer
        title={currentCoupon ? `卡券核销全流程 - ${currentCoupon.couponNo}` : '卡券详情'}
        width={860}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Button onClick={() => setDrawerOpen(false)}>关闭</Button>}
      >
        {currentCoupon && (
          <>
            <Card style={{ marginBottom: 16, borderRadius: 8 }} size="small">
              <Descriptions column={3} size="small" bordered>
                <Descriptions.Item label="券号"><span className="tag-pro">{currentCoupon.couponNo}</span></Descriptions.Item>
                <Descriptions.Item label="卡券名称">{currentCoupon.couponName}</Descriptions.Item>
                <Descriptions.Item label="来源">
                  <Tag color={currentCoupon.sourceType === 'gift' ? 'green' : currentCoupon.sourceType === 'staff' ? 'purple' : 'blue'}>
                    {sourceColorMap[currentCoupon.sourceType].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="顾客">{currentCoupon.customerName}（{currentCoupon.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}）</Descriptions.Item>
                <Descriptions.Item label="项目">{currentCoupon.projectCategory} / {currentCoupon.projectName}</Descriptions.Item>
                <Descriptions.Item label="售卖门店">{currentCoupon.soldStore}</Descriptions.Item>
                <Descriptions.Item label="总次数">{currentCoupon.totalCount} 次</Descriptions.Item>
                <Descriptions.Item label="已用 / 剩余">{currentCoupon.usedCount} / {currentCoupon.totalCount - currentCoupon.usedCount} 次</Descriptions.Item>
                <Descriptions.Item label="咨询师">{currentCoupon.consultant}</Descriptions.Item>
                <Descriptions.Item label="单次价格">¥{currentCoupon.unitPrice.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="已用 / 剩余金额">
                  <span className="amount-positive">¥{(currentCoupon.usedCount * currentCoupon.unitPrice).toFixed(2)}</span> / <span className="amount-neutral">¥{((currentCoupon.totalCount - currentCoupon.usedCount) * currentCoupon.unitPrice).toFixed(2)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="总金额">¥{currentCoupon.totalAmount.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="有效期">{currentCoupon.validFrom} 至 {currentCoupon.validTo}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {currentCoupon.status === 'used_up' ? <Tag color="default">已用完</Tag> : currentCoupon.status === 'expired' ? <Tag color="red">已过期</Tag> : <Tag color="green">正常</Tag>}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <div className="section-title" style={{ marginBottom: 12 }}>关联收款单</div>
            {currentCouponOrder ? (
              <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="订单号">{currentCouponOrder.orderNo}</Descriptions.Item>
                  <Descriptions.Item label="日期">{currentCouponOrder.date}</Descriptions.Item>
                  <Descriptions.Item label="支付方式">{currentCouponOrder.payMethod}</Descriptions.Item>
                  <Descriptions.Item label="应收">¥{currentCouponOrder.totalAmount.toFixed(2)}</Descriptions.Item>
                  <Descriptions.Item label="实收"><span className="amount-positive">¥{currentCouponOrder.paidAmount.toFixed(2)}</span></Descriptions.Item>
                  <Descriptions.Item label="售卖门店">{currentCouponOrder.salesStore}</Descriptions.Item>
                </Descriptions>
              </Card>
            ) : (
              <Alert type="warning" showIcon message="未找到匹配的收款记录，可能为赠送券或漏单" style={{ marginBottom: 16 }} />
            )}

            <div className="section-title" style={{ marginBottom: 12 }}>核销流水 ({currentCouponRedemptions.length} 条)</div>
            {currentCouponRedemptions.length > 0 ? (
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{
                  position: 'absolute', left: 6, top: 8, bottom: 8,
                  width: 2, background: '#e5e7eb'
                }} />
                {currentCouponRedemptions.map((r, idx) => (
                  <div key={r.id} style={{ position: 'relative', marginBottom: 14 }}>
                    <div style={{
                      position: 'absolute', left: -20, top: 10, width: 12, height: 12,
                      borderRadius: 6, background: r.serviceStore === currentCoupon.soldStore ? '#1f4e79' : '#d97706',
                      border: '2px solid #fff', boxShadow: '0 0 0 1px #e5e7eb', zIndex: 1
                    }} />
                    <Card size="small" style={{ borderRadius: 6 }} bodyStyle={{ padding: '10px 14px' }}>
                      <Row justify="space-between" style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 13 }}>
                          {r.date} {r.time} · {r.serviceStore !== currentCoupon.soldStore ? <Tag color="orange">跨店核销</Tag> : null}
                        </Text>
                        <span className="amount-positive">¥{r.amount.toFixed(2)}</span>
                      </Row>
                      <Row gutter={[12, 4]} style={{ fontSize: 12, color: '#6b7280' }}>
                        <Col span={8}>核销单号：<span className="tag-pro">{r.redemptionNo}</span></Col>
                        <Col span={8}>服务门店：{r.serviceStore}</Col>
                        <Col span={8}>售卖门店：{r.soldStore}</Col>
                        <Col span={8}>咨询师：{r.consultant}</Col>
                        <Col span={8}>医生：{r.doctor}</Col>
                        <Col span={8}>操作员：{r.operator}</Col>
                        {r.remark && <Col span={24}>备注：{r.remark}</Col>}
                      </Row>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-center">暂无核销记录</div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default RedemptionDetailPage;
