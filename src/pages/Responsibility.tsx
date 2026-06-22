import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  App,
  Typography,
  Tabs,
  Tooltip,
  Divider,
  Progress,
  Drawer,
  Descriptions,
  List
} from 'antd';
import {
  FilterOutlined,
  ReloadOutlined,
  ExportOutlined,
  TeamOutlined,
  UserOutlined,
  BarChartOutlined,
  ShopOutlined,
  DollarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { useApp } from '@/App';
import type { RedemptionRecord } from '@/types';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const PIE_COLORS = ['#1f4e79', '#059669', '#d97706', '#dc2626', '#8b5cf6', '#0891b2', '#be185d', '#65a30d'];

const ResponsibilityPage: React.FC = () => {
  const { businessDate, redemptions, coupons, paymentOrders, meta, addAudit, setBusinessDate } = useApp();
  const { message } = App.useApp();
  const [viewMode, setViewMode] = useState<'consultant' | 'doctor' | 'category'>('consultant');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<{ name: string; type: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filterRange = useMemo(() => {
    if (dateRange) {
      return [dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')];
    }
    // 默认展示当月
    const start = dayjs(businessDate).startOf('month').format('YYYY-MM-DD');
    const end = dayjs(businessDate).format('YYYY-MM-DD');
    return [start, end];
  }, [dateRange, businessDate]);

  const filteredRedemptions = useMemo(() => {
    const [start, end] = filterRange;
    return redemptions.filter(r => {
      if (r.date < start || r.date > end) return false;
      if (storeFilter && r.serviceStore !== storeFilter) return false;
      return true;
    });
  }, [redemptions, filterRange, storeFilter]);

  const filteredPayments = useMemo(() => {
    const [start, end] = filterRange;
    return paymentOrders.filter(o => {
      if (o.date < start || o.date > end) return false;
      if (storeFilter && o.salesStore !== storeFilter) return false;
      return true;
    });
  }, [paymentOrders, filterRange, storeFilter]);

  const consultantStats = useMemo(() => {
    const map = new Map<string, any>();
    meta.consultants.forEach(name => {
      map.set(name, {
        key: name,
        name,
        salesCount: 0,
        salesAmount: 0,
        redemptionCount: 0,
        redemptionAmount: 0,
        customers: new Set<string>(),
        couponCount: 0,
        avgOrder: 0,
        projects: new Map<string, number>()
      });
    });
    filteredPayments.forEach(o => {
      if (!map.has(o.consultant)) return;
      const d = map.get(o.consultant)!;
      d.salesCount += 1;
      d.salesAmount += o.paidAmount;
      d.customers.add(o.customerId);
      if (o.couponNo) d.couponCount += 1;
    });
    filteredRedemptions.forEach(r => {
      if (!map.has(r.consultant)) return;
      const d = map.get(r.consultant)!;
      d.redemptionCount += r.redemptionCount;
      d.redemptionAmount += r.amount;
      const old = d.projects.get(r.projectCategory) || 0;
      d.projects.set(r.projectCategory, old + r.amount);
    });
    const list = Array.from(map.values()).map(d => {
      const convRate = d.salesCount > 0 ? (d.redemptionCount / d.salesCount) * 100 : 0;
      return {
        ...d,
        customers: d.customers.size,
        avgOrder: d.salesCount > 0 ? Number((d.salesAmount / d.salesCount).toFixed(2)) : 0,
        convRate: Number(convRate.toFixed(1)),
        projects: Array.from(d.projects.entries()) as [string, number][],
        performance: d.salesAmount * 0.6 + d.redemptionAmount * 0.4
      };
    }).sort((a: any, b: any) => b.performance - a.performance);

    (list as any[]).forEach((d: any, i: number) => d.rank = i + 1);
    return list as any[];
  }, [filteredPayments, filteredRedemptions, meta.consultants]);

  const doctorStats = useMemo(() => {
    const map = new Map<string, any>();
    meta.doctors.forEach(name => {
      map.set(name, {
        key: name,
        name,
        operationCount: 0,
        operationAmount: 0,
        customers: new Set<string>(),
        projects: new Map<string, number>(),
        categories: new Map<string, number>(),
        avgPrice: 0
      });
    });
    filteredRedemptions.forEach(r => {
      if (!map.has(r.doctor)) return;
      const d = map.get(r.doctor)!;
      d.operationCount += r.redemptionCount;
      d.operationAmount += r.amount;
      d.customers.add(r.customerId);
      const oldP = d.projects.get(r.projectName) || 0;
      d.projects.set(r.projectName, oldP + r.amount);
      const oldC = d.categories.get(r.projectCategory) || 0;
      d.categories.set(r.projectCategory, oldC + r.amount);
    });
    const list = (Array.from(map.values()) as any[]).map((d: any) => ({
      ...d,
      customers: d.customers.size,
      avgPrice: d.operationCount > 0 ? Number((d.operationAmount / d.operationCount).toFixed(2)) : 0,
      projects: (Array.from(d.projects.entries()) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 5),
      categories: (Array.from(d.categories.entries()) as [string, number][]).sort((a, b) => b[1] - a[1])
    })).sort((a, b) => b.operationAmount - a.operationAmount);
    (list as any[]).forEach((d: any, i: number) => d.rank = i + 1);
    return list as any[];
  }, [filteredRedemptions, meta.doctors]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, any>();
    meta.categories.forEach(cat => {
      map.set(cat, {
        key: cat,
        category: cat,
        salesCount: 0,
        salesAmount: 0,
        redemptionCount: 0,
        redemptionAmount: 0,
        projects: new Map<string, { count: number; amount: number; customers: Set<string> }>(),
        avgPrice: 0,
        convRate: 0
      });
    });
    filteredPayments.forEach(o => {
      if (!map.has(o.projectCategory)) return;
      const d = map.get(o.projectCategory)!;
      d.salesCount += 1;
      d.salesAmount += o.paidAmount;
    });
    filteredRedemptions.forEach(r => {
      if (!map.has(r.projectCategory)) return;
      const d = map.get(r.projectCategory)!;
      d.redemptionCount += r.redemptionCount;
      d.redemptionAmount += r.amount;
      const pKey = r.projectName;
      if (!d.projects.has(pKey)) {
        d.projects.set(pKey, { count: 0, amount: 0, customers: new Set() });
      }
      const pr = d.projects.get(pKey)!;
      pr.count += r.redemptionCount;
      pr.amount += r.amount;
      pr.customers.add(r.customerId);
    });
    const list = (Array.from(map.values()) as any[]).map((d: any) => {
      const pList = (Array.from(d.projects.entries()) as [string, any][]).map(([name, v]: [string, any]) => ({
        name,
        count: v.count,
        amount: Number(v.amount.toFixed(2)),
        customers: v.customers.size
      })).sort((a: any, b: any) => b.amount - a.amount);
      return {
        category: d.category,
        salesCount: d.salesCount,
        salesAmount: Number(d.salesAmount.toFixed(2)),
        redemptionCount: d.redemptionCount,
        redemptionAmount: Number(d.redemptionAmount.toFixed(2)),
        avgPrice: d.redemptionCount > 0 ? Number((d.redemptionAmount / d.redemptionCount).toFixed(2)) : 0,
        convRate: d.salesCount > 0 ? Number((d.redemptionCount / d.salesCount) * 100).toFixed(1) : 0,
        projects: pList,
        projectCount: pList.length
      };
    }).sort((a: any, b: any) => b.redemptionAmount - a.redemptionAmount);
    return list as any[];
  }, [filteredPayments, filteredRedemptions, meta.categories]);

  const chartData = useMemo(() => {
    const [start, end] = filterRange;
    const arr: { date: string; 实收金额: number; 核销金额: number; 退款金额: number }[] = [];
    const s = dayjs(start);
    const e = dayjs(end);
    let cur = s;
    const maxDays = 31;
    const totalDays = Math.min(maxDays, e.diff(s, 'day') + 1);
    const step = Math.max(1, Math.ceil((e.diff(s, 'day') + 1) / maxDays));
    for (let i = 0; i < totalDays; i++) {
      const d = cur.format('YYYY-MM-DD');
      const pay = paymentOrders.filter(o => o.date === d).reduce((s, o) => s + o.paidAmount, 0);
      const red = redemptions.filter(r => r.date === d).reduce((s, r) => s + r.amount, 0);
      arr.push({
        date: d.slice(5),
        实收金额: Number(pay.toFixed(0)),
        核销金额: Number(red.toFixed(0)),
        退款金额: 0
      });
      cur = cur.add(step, 'day');
    }
    return arr;
  }, [filterRange, paymentOrders, redemptions]);

  const pieData = categoryStats.map(d => ({ name: d.category, value: d.redemptionAmount }));

  const exportData = () => {
    let exportData: any[] = [];
    let filename = '';
    if (viewMode === 'consultant') {
      exportData = consultantStats.map(({ customers, projects, ...rest }) => ({
        排名: rest.rank,
        咨询师: rest.name,
        成单数: rest.salesCount,
        实收金额: rest.salesAmount.toFixed(2),
        核销次数: rest.redemptionCount,
        核销金额: rest.redemptionAmount.toFixed(2),
        服务顾客数: customers,
        卡券数: rest.couponCount,
        客单价: rest.avgOrder.toFixed(2),
        核销率: `${rest.convRate}%`,
        综合绩效分: rest.performance.toFixed(0)
      }));
      filename = `咨询师绩效-${dayjs().format('YYYYMMDD')}.xlsx`;
    } else if (viewMode === 'doctor') {
      exportData = doctorStats.map(({ projects, categories, ...rest }) => ({
        排名: rest.rank,
        医生: rest.name,
        操作次数: rest.operationCount,
        操作金额: rest.operationAmount.toFixed(2),
        服务人数: rest.customers,
        单次均价: rest.avgPrice.toFixed(2),
        擅长项目: (projects as any[]).map((p: any) => p[0]).join('、')
      }));
      filename = `医生操作统计-${dayjs().format('YYYYMMDD')}.xlsx`;
    } else {
      exportData = categoryStats.map(({ projects, ...rest }) => ({
        项目类别: rest.category,
        销售单数: rest.salesCount,
        销售金额: rest.salesAmount.toFixed(2),
        核销次数: rest.redemptionCount,
        核销金额: rest.redemptionAmount.toFixed(2),
        单次均价: rest.avgPrice.toFixed(2),
        核销率: `${rest.convRate}%`,
        项目数: rest.projectCount
      }));
      filename = `项目类别统计-${dayjs().format('YYYYMMDD')}.xlsx`;
    }
    if (exportData.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, viewMode);
    XLSX.writeFile(wb, filename);
    addAudit({
      module: 'responsibility',
      action: 'export',
      operator: '财务员',
      targetId: viewMode,
      remark: `导出 ${filename}`
    });
    message.success(`已导出 ${exportData.length} 条数据`);
  };

  const openPersonDetail = (name: string, type: string) => {
    setSelectedPerson({ name, type });
    setDrawerOpen(true);
  };

  const consultantColumns = [
    { title: '排名', dataIndex: 'rank', width: 60, fixed: 'left' as const, align: 'center' as const,
      render: (v: number) => v <= 3
        ? <Tag color={v === 1 ? 'gold' : v === 2 ? 'silver' : 'bronze'} style={{ fontWeight: 700, width: 28, textAlign: 'center' }}>{v}</Tag>
        : <span style={{ color: '#6b7280' }}>{v}</span>
    },
    { title: '咨询师', dataIndex: 'name', width: 100, fixed: 'left' as const, render: (v: string) => (
      <a onClick={() => openPersonDetail(v, 'consultant')} style={{ fontWeight: 500 }}>
        <TeamOutlined style={{ marginRight: 6, color: '#1f4e79' }} />{v}
      </a>
    )},
    { title: '成单数', dataIndex: 'salesCount', width: 85, align: 'center' as const },
    { title: '实收金额', dataIndex: 'salesAmount', width: 120, align: 'right' as const,
      render: (v: number) => <span className="amount-neutral">¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
    },
    { title: '核销次数', dataIndex: 'redemptionCount', width: 85, align: 'center' as const },
    { title: '核销金额', dataIndex: 'redemptionAmount', width: 120, align: 'right' as const,
      render: (v: number) => <span className="amount-positive">¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
    },
    { title: '服务顾客数', dataIndex: 'customers', width: 95, align: 'center' as const },
    { title: '客单价', dataIndex: 'avgOrder', width: 110, align: 'right' as const, render: (v: number) => `¥${v.toFixed(2)}` },
    {
      title: '核销率', dataIndex: 'convRate', width: 130,
      render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 70 ? '#16a34a' : v >= 40 ? '#1f4e79' : '#d97706'} />
    },
    {
      title: '擅长项目', dataIndex: 'projects', width: 200,
      render: (v: any[]) => v.slice(0, 3).map(([name]: any) => <Tag key={name} style={{ margin: '2px' }}>{name}</Tag>)
    }
  ];

  const doctorColumns = [
    { title: '排名', dataIndex: 'rank', width: 60, fixed: 'left' as const, align: 'center' as const,
      render: (v: number) => v <= 3
        ? <Tag color={v === 1 ? 'gold' : v === 2 ? 'silver' : 'bronze'} style={{ fontWeight: 700, width: 28, textAlign: 'center' }}>{v}</Tag>
        : <span style={{ color: '#6b7280' }}>{v}</span>
    },
    { title: '医生', dataIndex: 'name', width: 100, fixed: 'left' as const, render: (v: string) => (
      <a onClick={() => openPersonDetail(v, 'doctor')} style={{ fontWeight: 500 }}>
        <UserOutlined style={{ marginRight: 6, color: '#8b5cf6' }} />{v}
      </a>
    )},
    { title: '操作次数', dataIndex: 'operationCount', width: 90, align: 'center' as const },
    { title: '操作金额', dataIndex: 'operationAmount', width: 130, align: 'right' as const,
      render: (v: number) => <span className="amount-positive">¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
    },
    { title: '服务人数', dataIndex: 'customers', width: 90, align: 'center' as const },
    { title: '单次均价', dataIndex: 'avgPrice', width: 110, align: 'right' as const, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '操作类别分布', dataIndex: 'categories', width: 220,
      render: (v: any[]) => v.map(([c, a]: any) =>
        <Tag key={c} color="blue" style={{ margin: '2px' }}>{c} ¥{(a as number / 1000).toFixed(1)}k</Tag>
      )
    },
    { title: 'TOP项目', dataIndex: 'projects', width: 260,
      render: (v: any[]) => v.map(([n, a]: any) => (
        <Tag key={n} style={{ margin: '2px' }}>{n} <span style={{ color: '#16a34a' }}>¥{(a as number).toFixed(0)}</span></Tag>
      ))
    }
  ];

  const categoryColumns = [
    { title: '项目类别', dataIndex: 'category', width: 110, fixed: 'left' as const,
      render: (v: string) => <span style={{ fontWeight: 500 }}><BarChartOutlined style={{ color: '#0891b2', marginRight: 6 }} />{v}</span>
    },
    { title: '项目数', dataIndex: 'projectCount', width: 75, align: 'center' as const },
    { title: '销售单数', dataIndex: 'salesCount', width: 90, align: 'center' as const },
    { title: '销售金额', dataIndex: 'salesAmount', width: 120, align: 'right' as const,
      render: (v: number) => <span className="amount-neutral">¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
    },
    { title: '核销次数', dataIndex: 'redemptionCount', width: 90, align: 'center' as const },
    { title: '核销金额', dataIndex: 'redemptionAmount', width: 120, align: 'right' as const,
      render: (v: number) => <span className="amount-positive">¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
    },
    { title: '单次均价', dataIndex: 'avgPrice', width: 100, align: 'right' as const, render: (v: number) => `¥${v.toFixed(2)}` },
    {
      title: '核销率', dataIndex: 'convRate', width: 130,
      render: (v: string) => <Progress percent={Number(v)} size="small" strokeColor="#1f4e79" />
    },
    { title: 'TOP项目', dataIndex: 'projects', width: 380,
      render: (v: any[]) => v.slice(0, 3).map(p => (
        <Tooltip key={p.name} title={`${p.count}次 · 服务${p.customers}人 · ¥${p.amount.toFixed(2)}`}>
          <Tag style={{ margin: '2px' }}>{p.name} <span style={{ color: '#16a34a' }}>¥{p.amount.toFixed(0)}</span></Tag>
        </Tooltip>
      ))
    }
  ];

  const [start, end] = filterRange;
  const totalStats = {
    sales: filteredPayments.reduce((s, o) => s + o.paidAmount, 0),
    salesCnt: filteredPayments.length,
    redeem: filteredRedemptions.reduce((s, r) => s + r.amount, 0),
    redeemCnt: filteredRedemptions.length,
    customers: new Set([
      ...filteredPayments.map(o => o.customerId),
      ...filteredRedemptions.map(r => r.customerId)
    ]).size
  };

  const personDetail = useMemo(() => {
    if (!selectedPerson) return null;
    const { name, type } = selectedPerson;
    if (type === 'consultant') {
      return consultantStats.find(c => c.name === name);
    } else {
      return doctorStats.find(d => d.name === name);
    }
  }, [selectedPerson, consultantStats, doctorStats]);

  const personRedemptions = selectedPerson
    ? filteredRedemptions.filter(r =>
        selectedPerson.type === 'consultant' ? r.consultant === selectedPerson.name : r.doctor === selectedPerson.name
      ).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">责任归属</h1>
          <p className="page-desc">
            按咨询师、医生、项目类别三个维度统计消耗与绩效，辅助提成核算与业绩复盘。
          </p>
        </div>
        <Space size={12}>
          <Button size="large" icon={<ExportOutlined />} onClick={exportData}>导出</Button>
        </Space>
      </div>

      <div className="filter-section">
        <Row gutter={[12, 12]} align="middle">
          <Col span={5}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={v => setDateRange(v as any)}
              placeholder={['统计开始', '统计结束']}
              format="YYYY-MM-DD"
            />
          </Col>
          <Col span={3}>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="筛选门店"
              value={storeFilter || undefined}
              onChange={setStoreFilter}
              options={meta.stores.map(s => ({ value: s, label: s }))}
            />
          </Col>
          <Col span={10}>
            <Tag color="blue" style={{ marginRight: 8 }}>
              统计区间：{start} → {end}（共 {dayjs(end).diff(start, 'day') + 1} 天）
            </Tag>
            <Tag style={{ marginRight: 4 }}>实收 <span className="amount-neutral">¥{totalStats.sales.toLocaleString()}</span></Tag>
            <Tag style={{ marginRight: 4 }}>核销 <span className="amount-positive">¥{totalStats.redeem.toLocaleString()}</span></Tag>
            <Tag>服务 <span style={{ color: '#1f4e79' }}>{totalStats.customers}</span> 人</Tag>
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Button onClick={() => { setDateRange(null); setStoreFilter(''); }} icon={<FilterOutlined />}>
              重置
            </Button>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card bordered style={{ borderRadius: 8 }} size="small" title="实收 vs 核销 趋势" extra={<Text type="secondary">金额 (元)</Text>}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="实收金额" stroke="#1f4e79" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="核销金额" stroke="#059669" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered style={{ borderRadius: 8 }} size="small" title="项目类别核销金额占比" extra={<Text type="secondary">{categoryStats.length} 类</Text>}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData.filter(p => p.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={78}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_e, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => `¥${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered style={{ borderRadius: 8 }} size="small" title="咨询师绩效 TOP 5" extra={<Text type="secondary">综合分 = 销售×60%+核销×40%</Text>}>
            <div style={{ padding: '4px 0' }}>
              {consultantStats.slice(0, 5).map((c, i) => (
                <div key={c.name} style={{ marginBottom: 14, ...(i === 4 ? { marginBottom: 0 } : {}) }}>
                  <Row justify="space-between" style={{ marginBottom: 4 }}>
                    <Space size={8}>
                      <Tag color={i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default'}>{i + 1}</Tag>
                      <Text strong style={{ fontSize: 12 }}>{c.name}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      销售¥{c.salesAmount.toFixed(0)} · 核销¥{c.redemptionAmount.toFixed(0)}
                    </Text>
                  </Row>
                  <Progress
                    percent={consultantStats[0] ? (c.performance / consultantStats[0].performance * 100) : 0}
                    showInfo={false}
                    size="small"
                    strokeColor={PIE_COLORS[i]}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={viewMode}
          onChange={(k) => setViewMode(k as any)}
          size="large"
          style={{ padding: '0 24px' }}
          items={[
            {
              key: 'consultant',
              label: <span><TeamOutlined /> 咨询师维度（{consultantStats.length} 人）</span>,
              children: (
                <Table
                  size="small"
                  columns={consultantColumns}
                  dataSource={consultantStats}
                  scroll={{ x: 1300, y: 520 }}
                  pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 位咨询师` }}
                />
              )
            },
            {
              key: 'doctor',
              label: <span><UserOutlined /> 医生维度（{doctorStats.length} 人）</span>,
              children: (
                <Table
                  size="small"
                  columns={doctorColumns}
                  dataSource={doctorStats}
                  scroll={{ x: 1300, y: 520 }}
                  pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 位医生` }}
                />
              )
            },
            {
              key: 'category',
              label: <span><BarChartOutlined /> 项目类别维度（{categoryStats.length} 类）</span>,
              children: (
                <Table
                  size="small"
                  columns={categoryColumns}
                  dataSource={categoryStats}
                  scroll={{ x: 1400, y: 520 }}
                  pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `共 ${t} 个类别` }}
                  expandable={{
                    expandedRowRender: (r: any) => (
                      <div style={{ padding: '8px 16px', background: '#f9fafb', borderRadius: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#111827' }}>
                          {r.category} - 项目明细（{r.projects.length} 个）
                        </div>
                        <Table
                          size="small"
                          pagination={false}
                          dataSource={r.projects}
                          columns={[
                            { title: '项目名称', dataIndex: 'name', width: 150 },
                            { title: '服务人数', dataIndex: 'customers', width: 90, align: 'center' },
                            { title: '核销次数', dataIndex: 'count', width: 90, align: 'center' },
                            { title: '单次均价', dataIndex: 'avg', width: 110, align: 'right',
                              render: (_: any, row: any) => `¥${(row.count > 0 ? row.amount / row.count : 0).toFixed(2)}` },
                            { title: '核销金额', dataIndex: 'amount', width: 140, align: 'right',
                              render: (v: number) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
                            { title: '金额占比', key: 'pct', width: 200,
                              render: (_: any, row: any) => (
                                <Progress percent={r.redemptionAmount > 0 ? Number((row.amount / r.redemptionAmount * 100).toFixed(1)) : 0} size="small" />
                              )
                            }
                          ]}
                        />
                      </div>
                    )
                  }}
                />
              )
            }
          ]}
        />
      </Card>

      <Drawer
        title={selectedPerson ? `${selectedPerson.type === 'consultant' ? '咨询师' : '医生'}绩效详情 - ${selectedPerson.name}` : ''}
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {personDetail && selectedPerson && (
          <>
            <Card bordered style={{ marginBottom: 16, borderRadius: 8 }}>
              <Descriptions column={3} size="small" bordered>
                {selectedPerson.type === 'consultant' ? (
                  <>
                    <Descriptions.Item label="排名">{personDetail.rank}</Descriptions.Item>
                    <Descriptions.Item label="成单数">{personDetail.salesCount}</Descriptions.Item>
                    <Descriptions.Item label="实收金额"><span className="amount-neutral">¥{personDetail.salesAmount.toLocaleString()}</span></Descriptions.Item>
                    <Descriptions.Item label="核销次数">{personDetail.redemptionCount}</Descriptions.Item>
                    <Descriptions.Item label="核销金额"><span className="amount-positive">¥{personDetail.redemptionAmount.toLocaleString()}</span></Descriptions.Item>
                    <Descriptions.Item label="服务顾客">{personDetail.customers} 人</Descriptions.Item>
                    <Descriptions.Item label="客单价">¥{personDetail.avgOrder.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="核销率">{personDetail.convRate}%</Descriptions.Item>
                    <Descriptions.Item label="综合绩效分"><Text strong style={{ color: '#1f4e79' }}>{personDetail.performance.toFixed(0)}</Text></Descriptions.Item>
                  </>
                ) : (
                  <>
                    <Descriptions.Item label="排名">{personDetail.rank}</Descriptions.Item>
                    <Descriptions.Item label="操作次数">{personDetail.operationCount}</Descriptions.Item>
                    <Descriptions.Item label="操作金额"><span className="amount-positive">¥{personDetail.operationAmount.toLocaleString()}</span></Descriptions.Item>
                    <Descriptions.Item label="服务人数">{personDetail.customers} 人</Descriptions.Item>
                    <Descriptions.Item label="单次均价">¥{personDetail.avgPrice.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="操作项目">{personDetail.projects.length} 种</Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </Card>

            <div className="section-title">近期操作记录（{personRedemptions.length} 条）</div>
            <Table
              size="small"
              dataSource={personRedemptions.slice(0, 50).map(r => ({ ...r, key: r.id }))}
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `最近 ${t} 条` }}
              scroll={{ y: 400 }}
              columns={[
                { title: '日期', dataIndex: 'date', width: 100 },
                { title: '时间', dataIndex: 'time', width: 55 },
                { title: '核销单号', dataIndex: 'redemptionNo', render: (v) => <span className="tag-pro">{v}</span> },
                { title: '顾客', dataIndex: 'customerName', width: 90 },
                { title: '项目', dataIndex: 'projectName', width: 130 },
                { title: '次数', dataIndex: 'redemptionCount', width: 55, align: 'center' },
                { title: '金额', dataIndex: 'amount', align: 'right', render: (v) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
                { title: '服务门店', dataIndex: 'serviceStore', width: 100 }
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ResponsibilityPage;
