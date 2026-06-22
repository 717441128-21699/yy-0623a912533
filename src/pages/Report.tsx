import React, { useState, useMemo, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  DatePicker,
  Button,
  Space,
  Tag,
  Modal,
  App,
  Typography,
  Tabs,
  Tooltip,
  Divider,
  Progress,
  Drawer,
  Descriptions,
  Timeline,
  List,
  Alert,
  Statistic,
  Empty,
  InputNumber,
  Form,
  Select,
  Radio,
  Input,
  Steps
} from 'antd';
import {
  FileTextOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckOutlined,
  PrinterOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  SafetyOutlined,
  WalletOutlined,
  AlertOutlined,
  RiseOutlined,
  FilterOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  ShopOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useApp } from '@/App';
import type { DailyReport, SedimentCoupon, AuditTrail } from '@/types';
import { genId } from '@/store';
import { generateSedimentCoupons, generateDiscrepancies } from '@/utils/mockData';

const { Text, Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const reportStatusColor = {
  draft: { color: 'default', label: '草稿' },
  submitted: { color: 'processing', label: '已提交' },
  approved: { color: 'success', label: '已审核' }
};

const sedimentLevelColor = {
  high: { color: 'red', label: '高风险沉淀', desc: '≥10000元 / ≥60天未使用', min: 10000 },
  medium: { color: 'orange', label: '中风险沉淀', desc: '5000~10000元 / 30~60天未使用', min: 5000 },
  low: { color: 'blue', label: '低风险沉淀', desc: '1000~5000元 / 30天未使用', min: 1000 }
};

const ReportPage: React.FC = () => {
  const {
    businessDate,
    paymentOrders, coupons, redemptions, refunds, discrepancies, auditTrails,
    dailyReports, setDailyReports,
    addAudit, persistAll, meta, setBusinessDate
  } = useApp();
  const { message, modal } = App.useApp();
  const printRef = useRef<HTMLDivElement>(null);
  const [previewReport, setPreviewReport] = useState<DailyReport | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sedimentRange, setSedimentRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [sedimentLevelFilter, setSedimentLevelFilter] = useState<string>('all');
  const [sedimentStoreFilter, setSedimentStoreFilter] = useState<string>('');
  const [sedimentKeyword, setSedimentKeyword] = useState('');
  const [reportDate, setReportDate] = useState<string>(businessDate);
  const [submitForm] = Form.useForm();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [auditKeyword, setAuditKeyword] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs(businessDate).format('YYYY-MM'));

  const todayOrders = useMemo(() => paymentOrders.filter(o => o.date === reportDate), [paymentOrders, reportDate]);
  const todayRedemptions = useMemo(() => redemptions.filter(r => r.date === reportDate), [redemptions, reportDate]);
  const todayRefunds = useMemo(() => refunds.filter(r => r.date === reportDate), [refunds, reportDate]);
  const todayCoupons = useMemo(() => coupons.filter(c => c.issueDate === reportDate || c.validTo >= reportDate), [coupons, reportDate]);

  const sedimentList = useMemo(() => {
    const base = generateSedimentCoupons(coupons, reportDate);
    return base.filter(s => {
      if (sedimentLevelFilter !== 'all' && s.sedimentLevel !== sedimentLevelFilter) return false;
      if (sedimentStoreFilter && s.soldStore !== sedimentStoreFilter) return false;
      if (sedimentKeyword) {
        const k = sedimentKeyword.toLowerCase();
        const hay = `${s.customerName}${s.phone}${s.couponNo}${s.couponName}${s.consultant}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [coupons, reportDate, sedimentLevelFilter, sedimentStoreFilter, sedimentKeyword]);

  const sedimentStats = useMemo(() => {
    const all = generateSedimentCoupons(coupons, reportDate);
    return {
      totalAmount: all.reduce((s, c) => s + c.remainingAmount, 0),
      totalCount: all.length,
      high: {
        count: all.filter(c => c.sedimentLevel === 'high').length,
        amount: all.filter(c => c.sedimentLevel === 'high').reduce((s, c) => s + c.remainingAmount, 0)
      },
      medium: {
        count: all.filter(c => c.sedimentLevel === 'medium').length,
        amount: all.filter(c => c.sedimentLevel === 'medium').reduce((s, c) => s + c.remainingAmount, 0)
      },
      low: {
        count: all.filter(c => c.sedimentLevel === 'low').length,
        amount: all.filter(c => c.sedimentLevel === 'low').reduce((s, c) => s + c.remainingAmount, 0)
      }
    };
  }, [coupons, reportDate]);

  const storeBreakdown = useMemo(() => {
    const map = new Map<string, any>();
    meta.stores.forEach(s => map.set(s, { store: s, paidAmount: 0, redeemedAmount: 0, refundAmount: 0, orderCount: 0, redemptionCount: 0 }));
    todayOrders.forEach(o => {
      if (!map.has(o.salesStore)) return;
      const d = map.get(o.salesStore)!;
      d.paidAmount += o.paidAmount;
      d.orderCount += 1;
    });
    todayRedemptions.forEach(r => {
      if (!map.has(r.serviceStore)) return;
      const d = map.get(r.serviceStore)!;
      d.redeemedAmount += r.amount;
      d.redemptionCount += 1;
    });
    todayRefunds.filter(r => r.auditStatus === 'approved').forEach(r => {
      if (!map.has(r.soldStore)) return;
      const d = map.get(r.soldStore)!;
      d.refundAmount += r.refundAmount;
    });
    return Array.from(map.values()).map(d => ({
      ...d,
      net: Number((d.paidAmount - d.refundAmount).toFixed(2)),
      paidAmount: Number(d.paidAmount.toFixed(2)),
      redeemedAmount: Number(d.redeemedAmount.toFixed(2)),
      refundAmount: Number(d.refundAmount.toFixed(2))
    }));
  }, [todayOrders, todayRedemptions, todayRefunds, meta.stores]);

  const crossStoreSplit = useMemo(() => {
    const map = new Map<string, any>();
    todayRedemptions
      .filter(r => r.soldStore !== r.serviceStore)
      .forEach(r => {
        const k = `${r.soldStore}|${r.serviceStore}`;
        if (!map.has(k)) {
          map.set(k, {
            key: k,
            soldStore: r.soldStore,
            serviceStore: r.serviceStore,
            times: 0,
            totalAmount: 0,
            serviceShare: 0,
            soldShare: 0
          });
        }
        const d = map.get(k)!;
        d.times += r.redemptionCount;
        d.totalAmount += r.amount;
        d.serviceShare += Number((r.amount * 0.6).toFixed(2));
        d.soldShare += Number((r.amount * 0.4).toFixed(2));
      });
    return Array.from(map.values()).map(d => ({
      ...d,
      totalAmount: Number(d.totalAmount.toFixed(2)),
      serviceShare: Number(d.serviceShare.toFixed(2)),
      soldShare: Number(d.soldShare.toFixed(2))
    }));
  }, [todayRedemptions]);

  const generateDailyReport = (): DailyReport => {
    const giftCouponCount = todayCoupons.filter(c => c.sourceType === 'gift').length;
    const staffCouponCount = todayCoupons.filter(c => c.sourceType === 'staff').length;
    const normalCouponCount = todayCoupons.filter(c => c.sourceType === 'normal').length;
    return {
      id: genId('DR'),
      reportDate,
      generatedAt: new Date().toISOString(),
      generatedBy: '财务员',
      summary: {
        totalOrders: todayOrders.length,
        totalPaidAmount: Number(todayOrders.reduce((s, o) => s + o.paidAmount, 0).toFixed(2)),
        totalRedemptions: todayRedemptions.length,
        totalRedeemedAmount: Number(todayRedemptions.reduce((s, r) => s + r.amount, 0).toFixed(2)),
        totalRefunds: todayRefunds.filter(r => r.auditStatus === 'approved').length,
        totalRefundAmount: Number(todayRefunds.filter(r => r.auditStatus === 'approved').reduce((s, r) => s + r.refundAmount, 0).toFixed(2)),
        discrepancyCount: discrepancies.filter(d => d.date === reportDate).length,
        giftCouponCount,
        staffCouponCount,
        normalCouponCount
      },
      storeBreakdown,
      crossStoreSplit,
      status: 'draft',
    };
  };

  const handleGenerate = () => {
    if (todayOrders.length === 0 && todayRedemptions.length === 0) {
      modal.confirm({
        title: '当日数据为空',
        content: `营业日期 ${reportDate} 没有发现收款单或核销流水，是否仍要生成日结单？`,
        okText: '仍要生成',
        onOk: doGenerate
      });
      return;
    }
    doGenerate();
  };

  const doGenerate = async () => {
    const report = generateDailyReport();
    const existing = dailyReports.find(r => r.reportDate === reportDate);
    let finalReport = report;
    if (existing) {
      finalReport = {
        ...report,
        id: existing.id,
        status: existing.status,
        approver: existing.approver,
        approvedAt: existing.approvedAt
      };
      const list = dailyReports.map(r => r.id === existing.id ? finalReport : r);
      setDailyReports(list);
    } else {
      setDailyReports([finalReport, ...dailyReports]);
    }
    addAudit({
      module: 'report',
      action: existing ? 'regenerate' : 'generate',
      operator: '财务员',
      targetId: finalReport.id,
      beforeData: existing || null,
      afterData: finalReport,
      remark: `生成日结单 ${reportDate}`
    });
    await persistAll();
    message.success(`日结单生成成功：${reportDate}`);
    setPreviewReport(finalReport);
    setPreviewOpen(true);
  };

  const openReportPreview = (report: DailyReport) => {
    setPreviewReport(report);
    setPreviewOpen(true);
  };

  const exportReport = (format: 'xlsx' | 'pdf', report: DailyReport) => {
    if (format === 'xlsx') {
      const sheets: Record<string, any[][]> = {};
      sheets['日结汇总'] = [
        ['医美机构每日结算报告'],
        ['营业日期', report.reportDate, '生成时间', dayjs(report.generatedAt).format('YYYY-MM-DD HH:mm:ss'), '制表人', report.generatedBy],
        ['状态', reportStatusColor[report.status].label, '审核人', report.approver || '—', '审核时间', report.approvedAt ? dayjs(report.approvedAt).format('YYYY-MM-DD HH:mm') : '—'],
        [],
        ['核心指标', '', '', '', '', ''],
        ['指标', '数量', '金额(元)', '', '', ''],
        ['当日收款单数', report.summary.totalOrders, report.summary.totalPaidAmount.toFixed(2)],
        ['当日核销次数', report.summary.totalRedemptions, report.summary.totalRedeemedAmount.toFixed(2)],
        ['当日已通过退款', report.summary.totalRefunds, report.summary.totalRefundAmount.toFixed(2)],
        ['净收入', '', (report.summary.totalPaidAmount - report.summary.totalRefundAmount).toFixed(2)],
        [],
        ['卡券统计', '', '', '', '', ''],
        ['', '正常购买', '赠送券', '员工福利券', '合计', ''],
        ['发卡数', report.summary.normalCouponCount, report.summary.giftCouponCount, report.summary.staffCouponCount, report.summary.normalCouponCount + report.summary.giftCouponCount + report.summary.staffCouponCount],
        [],
        ['当日差异待处理：', report.summary.discrepancyCount, '条'],
        [],
        ['门店明细（金额单位：元）'],
        ['门店', '收款金额', '核销金额', '退款金额', '净收款'],
        ...report.storeBreakdown.map(s => [s.store, s.paidAmount.toFixed(2), s.redeemedAmount.toFixed(2), s.refundAmount.toFixed(2), (s.paidAmount - s.refundAmount).toFixed(2)])
      ];
      if (report.crossStoreSplit.length > 0) {
        sheets['跨店拆账'] = [
          ['跨店核销拆账明细（服务门店 60% / 售卖门店 40%）'],
          ['售卖门店', '服务门店', '跨店次数', '总金额', '服务门店分成', '售卖门店分成'],
          ...report.crossStoreSplit.map(r => [r.soldStore, r.serviceStore, r.times || 0, (r.totalAmount || 0).toFixed(2), (r.serviceShare || 0).toFixed(2), (r.soldShare || 0).toFixed(2)])
        ];
      }
      sheets['沉淀金额清单'] = [
        ['卡券沉淀金额清单（月底汇报参考）'],
        ['券号', '顾客姓名', '手机', '卡券名称', '剩余次数', '剩余金额(元)', '未使用天数', '风险等级', '咨询师', '售卖门店'],
        ...sedimentList.slice(0, 100).map(s => [
          s.couponNo, s.customerName, s.phone, s.couponName, s.remainingCount, s.remainingAmount.toFixed(2),
          s.daysUnused, sedimentLevelColor[s.sedimentLevel].label, s.consultant, s.soldStore
        ])
      ];
      const wb = XLSX.utils.book_new();
      Object.keys(sheets).forEach(name => {
        const ws = XLSX.utils.aoa_to_sheet(sheets[name]);
        XLSX.utils.book_append_sheet(wb, ws, name);
      });
      XLSX.writeFile(wb, `日结单-${report.reportDate}.xlsx`);
      message.success(`已导出日结单：${report.reportDate}`);
    } else {
      window.print();
    }
  };

  const submitReport = async (values: any) => {
    if (!previewReport) return;
    const before = { ...previewReport };
    const updated = {
      ...previewReport,
      status: 'submitted' as const
    };
    const list = dailyReports.map(r => r.id === updated.id ? updated : r);
    setDailyReports(list);
    addAudit({
      module: 'report',
      action: 'submit',
      operator: values.submitter,
      targetId: updated.id,
      beforeData: before,
      afterData: updated,
      remark: `提交日结单审核：${values.remark || '无'}`
    });
    await persistAll();
    setPreviewReport(updated);
    setSubmitOpen(false);
    message.success('已提交审核');
  };

  const approveReport = () => {
    if (!previewReport) return;
    modal.confirm({
      title: '确认审核通过该日结单？',
      content: `审核通过后数据将被锁定，不可再修改。`,
      okText: '确认通过',
      okButtonProps: { type: 'primary', danger: false },
      onOk: async () => {
        const before = { ...previewReport };
        const updated: DailyReport = {
          ...previewReport,
          status: 'approved',
          approver: '财务主管',
          approvedAt: new Date().toISOString()
        };
        const list = dailyReports.map(r => r.id === updated.id ? updated : r);
        setDailyReports(list);
        addAudit({
          module: 'report',
          action: 'approve',
          operator: '财务主管',
          targetId: updated.id,
          beforeData: before,
          afterData: updated,
          remark: '日结单审核通过，数据已锁定'
        });
        await persistAll();
        setPreviewReport(updated);
        message.success('日结单已审核通过');
      }
    });
  };

  const sedimentColumns = [
    {
      title: '风险等级', dataIndex: 'sedimentLevel', width: 110,
      render: (v: 'high' | 'medium' | 'low') => {
        const s = sedimentLevelColor[v];
        return <Tag color={s.color} icon={<AlertOutlined />}>{s.label}</Tag>;
      }
    },
    { title: '券号', dataIndex: 'couponNo', width: 130, render: (v: string) => <span className="tag-pro">{v}</span> },
    { title: '顾客姓名', dataIndex: 'customerName', width: 95 },
    { title: '手机号', dataIndex: 'phone', width: 115, render: (v: string) => v.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') },
    { title: '卡券名称', dataIndex: 'couponName', width: 150, ellipsis: true },
    { title: '总次数', dataIndex: 'totalCount', width: 70, align: 'center' as const },
    { title: '已用', dataIndex: 'usedCount', width: 55, align: 'center' as const },
    { title: '剩余次数', dataIndex: 'remainingCount', width: 75, align: 'center' as const },
    {
      title: '剩余金额', dataIndex: 'remainingAmount', width: 115, align: 'right' as const,
      sorter: (a: SedimentCoupon, b: SedimentCoupon) => a.remainingAmount - b.remainingAmount,
      render: (v: number) => <span className="amount-neutral" style={{ fontWeight: 600 }}>¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
    },
    {
      title: '未使用天数', dataIndex: 'daysUnused', width: 95, align: 'center' as const,
      sorter: (a: SedimentCoupon, b: SedimentCoupon) => a.daysUnused - b.daysUnused,
      render: (v: number) => <Tag color={v >= 60 ? 'red' : v >= 30 ? 'orange' : 'blue'}>{v} 天</Tag>
    },
    { title: '发放日期', dataIndex: 'issueDate', width: 100 },
    { title: '到期日期', dataIndex: 'validTo', width: 100,
      render: (v: string, r: SedimentCoupon) => {
        const diff = dayjs(v).diff(reportDate, 'day');
        return <span className={diff < 30 ? 'amount-negative' : ''}>{v}（{diff > 0 ? `还剩${diff}天` : `已过期${-diff}天`}）</span>;
      }
    },
    { title: '咨询师', dataIndex: 'consultant', width: 85 },
    { title: '售卖门店', dataIndex: 'soldStore', width: 105 }
  ];

  const reportColumns = [
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: keyof typeof reportStatusColor) => {
        const s = reportStatusColor[v];
        return <Tag color={s.color}>{s.label}</Tag>;
      }
    },
    { title: '营业日期', dataIndex: 'reportDate', width: 110,
      render: (v: string, r: DailyReport) => (
        <a onClick={() => openReportPreview(r)} style={{ fontWeight: 500, color: '#1f4e79' }}>{v}</a>
      )
    },
    { title: '收款单数', dataIndex: 'summary.totalOrders', width: 95, align: 'right' as const },
    { title: '收款金额', dataIndex: 'summary.totalPaidAmount', width: 120, align: 'right' as const,
      render: (v: number) => <span className="amount-neutral">¥{v.toLocaleString()}</span>
    },
    { title: '核销次数', dataIndex: 'summary.totalRedemptions', width: 95, align: 'right' as const },
    { title: '核销金额', dataIndex: 'summary.totalRedeemedAmount', width: 120, align: 'right' as const,
      render: (v: number) => <span className="amount-positive">¥{v.toLocaleString()}</span>
    },
    { title: '退款金额', dataIndex: 'summary.totalRefundAmount', width: 110, align: 'right' as const,
      render: (v: number) => v > 0 ? <span className="amount-negative">-¥{v.toLocaleString()}</span> : '¥0.00'
    },
    { title: '赠送/员工券', key: 'coupons', width: 110,
      render: (_: any, r: DailyReport) => (
        <Space size={4}>
          <Tag color="green">{r.summary.giftCouponCount}</Tag>
          <Tag color="purple">{r.summary.staffCouponCount}</Tag>
        </Space>
      )
    },
    { title: '待处理差异', dataIndex: 'summary.discrepancyCount', width: 95, align: 'center' as const,
      render: (v: number) => v > 0 ? <BadgeDanger count={v} /> : <Tag color="green">0</Tag>
    },
    { title: '生成时间', dataIndex: 'generatedAt', width: 150,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm')
    },
    { title: '制表人', dataIndex: 'generatedBy', width: 85 },
    { title: '审核人', dataIndex: 'approver', width: 85, render: (v: string) => v || '—' },
    {
      title: '操作', key: 'op', width: 160, fixed: 'right' as const,
      render: (_: any, r: DailyReport) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openReportPreview(r)}>预览</Button>
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => exportReport('xlsx', r)}>导出</Button>
        </Space>
      )
    }
  ];

  const auditModules = useMemo(() => {
    const set = new Set(auditTrails.map(a => a.module));
    return Array.from(set).sort();
  }, [auditTrails]);

  const auditActions = useMemo(() => {
    const set = new Set(auditTrails.map(a => a.action));
    return Array.from(set).sort();
  }, [auditTrails]);

  const filteredAudits = useMemo(() => {
    return auditTrails.filter(a => {
      if (auditModuleFilter && a.module !== auditModuleFilter) return false;
      if (auditActionFilter && a.action !== auditActionFilter) return false;
      if (auditKeyword) {
        const kw = auditKeyword.toLowerCase();
        const hay = a.targetId + ' ' + (a.remark || '') + ' ' + a.operator;
        if (!hay.toLowerCase().includes(kw)) return false;
      }
      return true;
    });
  }, [auditTrails, auditModuleFilter, auditActionFilter, auditKeyword]);

  const recentAudits = filteredAudits.slice(0, 30);

  const monthDailyStats = useMemo(() => {
    const startStr = selectedMonth + '-01';
    const endDay = dayjs(selectedMonth).daysInMonth();
    const endStr = selectedMonth + '-' + String(endDay).padStart(2, '0');
    const daysInMonth = endDay;

    const dayMap = new Map<string, any>();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = selectedMonth + '-' + String(i).padStart(2, '0');
      dayMap.set(d, {
        date: d,
        orderCount: 0,
        paidAmount: 0,
        redemptionCount: 0,
        redeemedAmount: 0,
        approvedRefundCount: 0,
        approvedRefundAmount: 0,
        pendingRefundCount: 0,
        pendingRefundAmount: 0,
        discrepancyCount: 0,
        netIncome: 0
      });
    }

    paymentOrders.forEach(o => {
      if (o.date >= startStr && o.date <= endStr && dayMap.has(o.date)) {
        const d = dayMap.get(o.date)!;
        d.orderCount += 1;
        d.paidAmount += o.paidAmount;
      }
    });

    redemptions.forEach(r => {
      if (r.date >= startStr && r.date <= endStr && dayMap.has(r.date)) {
        const d = dayMap.get(r.date)!;
        d.redemptionCount += r.redemptionCount || 1;
        d.redeemedAmount += r.amount;
      }
    });

    refunds.forEach(r => {
      if (r.date >= startStr && r.date <= endStr && dayMap.has(r.date)) {
        const d = dayMap.get(r.date)!;
        if (r.auditStatus === 'approved') {
          d.approvedRefundCount += 1;
          d.approvedRefundAmount += r.refundAmount;
        } else if (r.auditStatus === 'pending') {
          d.pendingRefundCount += 1;
          d.pendingRefundAmount += r.refundAmount;
        }
      }
    });

    discrepancies.forEach(disc => {
      if (disc.date >= startStr && disc.date <= endStr && dayMap.has(disc.date)) {
        const d = dayMap.get(disc.date)!;
        d.discrepancyCount += 1;
      }
    });

    const result = Array.from(dayMap.values()).map(d => ({
      ...d,
      paidAmount: Number(d.paidAmount.toFixed(2)),
      redeemedAmount: Number(d.redeemedAmount.toFixed(2)),
      approvedRefundAmount: Number(d.approvedRefundAmount.toFixed(2)),
      pendingRefundAmount: Number(d.pendingRefundAmount.toFixed(2)),
      netIncome: Number((d.paidAmount - d.approvedRefundAmount).toFixed(2))
    }));

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedMonth, paymentOrders, redemptions, refunds, discrepancies]);

  const monthStoreStats = useMemo(() => {
    const startStr = selectedMonth + '-01';
    const endDay = dayjs(selectedMonth).daysInMonth();
    const endStr = selectedMonth + '-' + String(endDay).padStart(2, '0');

    const map = new Map<string, any>();
    meta.stores.forEach(s => map.set(s, {
      store: s,
      orderCount: 0,
      paidAmount: 0,
      redemptionCount: 0,
      redeemedAmount: 0,
      approvedRefundCount: 0,
      approvedRefundAmount: 0,
      pendingRefundCount: 0,
      pendingRefundAmount: 0,
      netIncome: 0
    }));

    paymentOrders.forEach(o => {
      if (o.date >= startStr && o.date <= endStr && map.has(o.salesStore)) {
        const s = map.get(o.salesStore)!;
        s.orderCount += 1;
        s.paidAmount += o.paidAmount;
      }
    });

    redemptions.forEach(r => {
      if (r.date >= startStr && r.date <= endStr && map.has(r.serviceStore)) {
        const s = map.get(r.serviceStore)!;
        s.redemptionCount += r.redemptionCount || 1;
        s.redeemedAmount += r.amount;
      }
    });

    refunds.forEach(r => {
      if (r.date >= startStr && r.date <= endStr && map.has(r.soldStore)) {
        const s = map.get(r.soldStore)!;
        if (r.auditStatus === 'approved') {
          s.approvedRefundCount += 1;
          s.approvedRefundAmount += r.refundAmount;
        } else if (r.auditStatus === 'pending') {
          s.pendingRefundCount += 1;
          s.pendingRefundAmount += r.refundAmount;
        }
      }
    });

    return Array.from(map.values()).map(s => ({
      ...s,
      paidAmount: Number(s.paidAmount.toFixed(2)),
      redeemedAmount: Number(s.redeemedAmount.toFixed(2)),
      approvedRefundAmount: Number(s.approvedRefundAmount.toFixed(2)),
      pendingRefundAmount: Number(s.pendingRefundAmount.toFixed(2)),
      netIncome: Number((s.paidAmount - s.approvedRefundAmount).toFixed(2))
    }));
  }, [selectedMonth, paymentOrders, redemptions, refunds, meta.stores]);

  const monthCategoryStats = useMemo(() => {
    const startStr = selectedMonth + '-01';
    const endDay = dayjs(selectedMonth).daysInMonth();
    const endStr = selectedMonth + '-' + String(endDay).padStart(2, '0');

    const map = new Map<string, any>();

    coupons.forEach(c => {
      if (!map.has(c.projectCategory)) {
        map.set(c.projectCategory, {
          category: c.projectCategory || '未分类',
          couponCount: 0,
          totalCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          redeemedAmount: 0,
          refundedAmount: 0
        });
      }
    });

    paymentOrders.forEach(o => {
      if (o.date >= startStr && o.date <= endStr) {
        const cat = o.projectCategory || '未分类';
        if (!map.has(cat)) {
          map.set(cat, { category: cat, couponCount: 0, totalCount: 0, totalAmount: 0, paidAmount: 0, redeemedAmount: 0, refundedAmount: 0 });
        }
        const s = map.get(cat)!;
        s.couponCount += 1;
        s.paidAmount += o.paidAmount;
      }
    });

    redemptions.forEach(r => {
      if (r.date >= startStr && r.date <= endStr) {
        const cat = r.projectCategory || '未分类';
        if (!map.has(cat)) {
          map.set(cat, { category: cat, couponCount: 0, totalCount: 0, totalAmount: 0, paidAmount: 0, redeemedAmount: 0, refundedAmount: 0 });
        }
        const s = map.get(cat)!;
        s.redeemedAmount += r.amount;
      }
    });

    refunds.filter(r => r.auditStatus === 'approved').forEach(r => {
      if (r.date >= startStr && r.date <= endStr) {
        const coupon = coupons.find(c => c.couponNo === r.couponNo);
        const cat = coupon?.projectCategory || '未分类';
        if (!map.has(cat)) {
          map.set(cat, { category: cat, couponCount: 0, totalCount: 0, totalAmount: 0, paidAmount: 0, redeemedAmount: 0, refundedAmount: 0 });
        }
        const s = map.get(cat)!;
        s.refundedAmount += r.refundAmount;
      }
    });

    return Array.from(map.values()).map(s => ({
      ...s,
      paidAmount: Number(s.paidAmount.toFixed(2)),
      redeemedAmount: Number(s.redeemedAmount.toFixed(2)),
      refundedAmount: Number(s.refundedAmount.toFixed(2)),
      netIncome: Number((s.paidAmount - s.refundedAmount).toFixed(2))
    }));
  }, [selectedMonth, paymentOrders, redemptions, refunds, coupons]);

  const monthSummary = useMemo(() => {
    const days = monthDailyStats;
    return {
      totalDays: days.filter(d => d.orderCount > 0 || d.redemptionCount > 0).length,
      totalOrders: days.reduce((s, d) => s + d.orderCount, 0),
      totalPaid: Number(days.reduce((s, d) => s + d.paidAmount, 0).toFixed(2)),
      totalRedemptions: days.reduce((s, d) => s + d.redemptionCount, 0),
      totalRedeemed: Number(days.reduce((s, d) => s + d.redeemedAmount, 0).toFixed(2)),
      totalApprovedRefunds: days.reduce((s, d) => s + d.approvedRefundCount, 0),
      totalApprovedRefundAmount: Number(days.reduce((s, d) => s + d.approvedRefundAmount, 0).toFixed(2)),
      totalPendingRefunds: days.reduce((s, d) => s + d.pendingRefundCount, 0),
      totalPendingRefundAmount: Number(days.reduce((s, d) => s + d.pendingRefundAmount, 0).toFixed(2)),
      totalDiscrepancies: days.reduce((s, d) => s + d.discrepancyCount, 0),
      totalNetIncome: Number(days.reduce((s, d) => s + d.netIncome, 0).toFixed(2))
    };
  }, [monthDailyStats]);

  const exportMonthlyReport = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [{
      '统计月份': selectedMonth,
      '营业天数': monthSummary.totalDays,
      '收款单数': monthSummary.totalOrders,
      '收款总额(元)': monthSummary.totalPaid,
      '核销次数': monthSummary.totalRedemptions,
      '核销总额(元)': monthSummary.totalRedeemed,
      '已通过退款笔数': monthSummary.totalApprovedRefunds,
      '已通过退款金额(元)': monthSummary.totalApprovedRefundAmount,
      '待审核退款笔数': monthSummary.totalPendingRefunds,
      '待审核退款金额(元)': monthSummary.totalPendingRefundAmount,
      '差异笔数': monthSummary.totalDiscrepancies,
      '净收入(元)': monthSummary.totalNetIncome
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), '月度汇总');

    const dailyData = monthDailyStats.map(d => ({
      '日期': d.date,
      '收款单数': d.orderCount,
      '收款金额(元)': d.paidAmount,
      '核销次数': d.redemptionCount,
      '核销金额(元)': d.redeemedAmount,
      '已通过退款笔数': d.approvedRefundCount,
      '已通过退款金额(元)': d.approvedRefundAmount,
      '待审核退款笔数': d.pendingRefundCount,
      '待审核退款金额(元)': d.pendingRefundAmount,
      '差异笔数': d.discrepancyCount,
      '净收入(元)': d.netIncome
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyData), '每日明细');

    const storeData = monthStoreStats.map(s => ({
      '门店': s.store,
      '收款单数': s.orderCount,
      '收款金额(元)': s.paidAmount,
      '核销次数': s.redemptionCount,
      '核销金额(元)': s.redeemedAmount,
      '已通过退款笔数': s.approvedRefundCount,
      '已通过退款金额(元)': s.approvedRefundAmount,
      '待审核退款笔数': s.pendingRefundCount,
      '待审核退款金额(元)': s.pendingRefundAmount,
      '净收入(元)': s.netIncome
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(storeData), '门店维度');

    const categoryData = monthCategoryStats.map(c => ({
      '项目类别': c.category,
      '卡券数量': c.couponCount,
      '收款金额(元)': c.paidAmount,
      '核销金额(元)': c.redeemedAmount,
      '已退金额(元)': c.refundedAmount,
      '净收入(元)': c.netIncome
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categoryData), '项目类别维度');

    XLSX.writeFile(wb, `月度汇总报告-${selectedMonth}.xlsx`);
    message.success(`已导出 ${selectedMonth} 月度汇总报告`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">结账报告</h1>
          <p className="page-desc">
            一键生成每日结算单、完整审核流程与痕迹保留；自动生成长期未使用高余额卡券沉淀金额清单。
          </p>
        </div>
        <Space size={12}>
          <DatePicker
            value={dayjs(reportDate)}
            onChange={(d) => d && setReportDate(d.format('YYYY-MM-DD'))}
            size="large"
            style={{ width: 160 }}
          />
          <Button size="large" type="primary" icon={<PlusOutlined />} onClick={handleGenerate}>
            生成日结单
          </Button>
        </Space>
      </div>

      <Tabs
        size="large"
        defaultActiveKey="reports"
        style={{ marginBottom: 0 }}
        items={[
          {
            key: 'reports',
            label: <span><FileTextOutlined /> 日结单管理（{dailyReports.length}）</span>,
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={4}>
                    <Card bordered style={{ borderRadius: 8 }} size="small">
                      <Statistic
                        title={
                          <span style={{ fontSize: 12, color: '#6b7280' }}>
                            <FileTextOutlined style={{ marginRight: 4 }} />累计日结单
                          </span>
                        }
                        value={dailyReports.length}
                        suffix={<span style={{ fontSize: 12, color: '#6b7280' }}>份</span>}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card bordered style={{ borderRadius: 8, borderLeft: '4px solid #16a34a' }} size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}><CheckOutlined style={{ marginRight: 4 }} />已审核通过</span>}
                        value={dailyReports.filter(r => r.status === 'approved').length}
                        valueStyle={{ color: '#16a34a' }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card bordered style={{ borderRadius: 8, borderLeft: '4px solid #1f4e79' }} size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}><ClockCircleOutlined style={{ marginRight: 4 }} />待审核</span>}
                        value={dailyReports.filter(r => r.status === 'submitted').length}
                        valueStyle={{ color: '#1f4e79' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bordered style={{ borderRadius: 8 }} size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}><RiseOutlined style={{ marginRight: 4 }} />累计收款 / 核销</span>}
                        prefix="¥"
                        value={dailyReports.reduce((s, r) => s + r.summary.totalPaidAmount, 0) / 10000}
                        precision={1}
                        suffix={<span style={{ fontSize: 12 }}>万 / {((dailyReports.reduce((s, r) => s + r.summary.totalRedeemedAmount, 0)) / 10000).toFixed(1)}万</span>}
                        valueStyle={{ fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bordered style={{ borderRadius: 8 }} size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}><WalletOutlined style={{ marginRight: 4 }} />累计净收入</span>}
                        prefix="¥"
                        value={dailyReports.reduce((s, r) => s + r.summary.totalPaidAmount - r.summary.totalRefundAmount, 0) / 10000}
                        precision={2}
                        suffix={<span style={{ fontSize: 12, color: '#16a34a' }}>万元</span>}
                        valueStyle={{ fontSize: 20, color: '#16a34a' }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
                  <Table
                    size="small"
                    columns={reportColumns}
                    dataSource={dailyReports.slice().sort((a, b) => b.reportDate.localeCompare(a.reportDate)).map(r => ({ ...r, key: r.id }))}
                    scroll={{ x: 1500, y: 400 }}
                    pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 份日结单` }}
                    locale={{ emptyText: <Empty description="暂无日结单，点击右上角【生成日结单】开始" /> }}
                  />
                </Card>
              </>
            )
          },
          {
            key: 'monthly',
            label: <span><RiseOutlined /> 月度汇总</span>,
            children: (
              <div>
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
                  <Col span={18}>
                    <Space size={12}>
                      <DatePicker
                        picker="month"
                        value={dayjs(selectedMonth)}
                        onChange={d => d && setSelectedMonth(d.format('YYYY-MM'))}
                        size="large"
                        style={{ width: 160 }}
                        format="YYYY年MM月"
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        共 {monthSummary.totalDays} 天有营业数据
                      </Text>
                    </Space>
                  </Col>
                  <Col span={6} style={{ textAlign: 'right' }}>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={exportMonthlyReport}>
                      导出月度报告
                    </Button>
                  </Col>
                </Row>

                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  <Col span={4}>
                    <Card bordered size="small" style={{ borderRadius: 8, borderLeft: '4px solid #2563eb' }}>
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}>本月收款总额</span>}
                        prefix="¥"
                        value={monthSummary.totalPaid / 10000}
                        precision={2}
                        suffix="万"
                        valueStyle={{ color: '#2563eb', fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card bordered size="small" style={{ borderRadius: 8, borderLeft: '4px solid #f59e0b' }}>
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}>本月核销总额</span>}
                        prefix="¥"
                        value={monthSummary.totalRedeemed / 10000}
                        precision={2}
                        suffix="万"
                        valueStyle={{ color: '#f59e0b', fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card bordered size="small" style={{ borderRadius: 8, borderLeft: '4px solid #16a34a' }}>
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}>已通过退款</span>}
                        prefix="¥"
                        value={monthSummary.totalApprovedRefundAmount / 10000}
                        precision={2}
                        suffix={`万 / ${monthSummary.totalApprovedRefunds}笔`}
                        valueStyle={{ color: '#16a34a', fontSize: 18 }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card bordered size="small" style={{ borderRadius: 8, borderLeft: '4px solid #dc2626' }}>
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}>待审退款（风险）</span>}
                        prefix="¥"
                        value={monthSummary.totalPendingRefundAmount / 10000}
                        precision={2}
                        suffix={`万 / ${monthSummary.totalPendingRefunds}笔`}
                        valueStyle={{ color: '#dc2626', fontSize: 18 }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card bordered size="small" style={{ borderRadius: 8, borderLeft: '4px solid #0d9488' }}>
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}>本月净收入</span>}
                        prefix="¥"
                        value={monthSummary.totalNetIncome / 10000}
                        precision={2}
                        suffix="万"
                        valueStyle={{ color: '#0d9488', fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card bordered size="small" style={{ borderRadius: 8, borderLeft: '4px solid #8b5cf6' }}>
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#6b7280' }}>待处理差异</span>}
                        value={monthSummary.totalDiscrepancies}
                        suffix="笔"
                        valueStyle={{ color: '#8b5cf6', fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card
                  title={<span><FileTextOutlined /> 每日明细</span>}
                  size="small"
                  style={{ borderRadius: 8, marginBottom: 16 }}
                  bodyStyle={{ padding: 0 }}
                >
                  <Table
                    size="small"
                    dataSource={monthDailyStats.map(d => ({ ...d, key: d.date }))}
                    pagination={{ pageSize: 15, showSizeChanger: false, showTotal: t => `共 ${t} 天` }}
                    scroll={{ y: 360 }}
                    columns={[
                      { title: '日期', dataIndex: 'date', width: 110, fixed: 'left' as const,
                        render: (v: string) => <Text strong>{v}</Text>
                      },
                      { title: '收款单数', dataIndex: 'orderCount', width: 85, align: 'center' as const },
                      { title: '收款金额', dataIndex: 'paidAmount', width: 110, align: 'right' as const,
                        render: (v: number) => <span style={{ color: '#2563eb', fontWeight: 500 }}>¥{v.toFixed(2)}</span>
                      },
                      { title: '核销次数', dataIndex: 'redemptionCount', width: 85, align: 'center' as const },
                      { title: '核销金额', dataIndex: 'redeemedAmount', width: 110, align: 'right' as const,
                        render: (v: number) => `¥${v.toFixed(2)}`
                      },
                      { title: '已通过退款', dataIndex: 'approvedRefundAmount', width: 115, align: 'right' as const,
                        render: (v: number, r: any) => (
                          <span style={{ color: '#16a34a' }}>
                            {r.approvedRefundCount > 0 ? `${r.approvedRefundCount}笔 / -¥${v.toFixed(2)}` : '—'}
                          </span>
                        )
                      },
                      { title: '待审退款', dataIndex: 'pendingRefundAmount', width: 115, align: 'right' as const,
                        render: (v: number, r: any) => (
                          <span style={{ color: '#dc2626' }}>
                            {r.pendingRefundCount > 0 ? `${r.pendingRefundCount}笔 / ¥${v.toFixed(2)}` : '—'}
                          </span>
                        )
                      },
                      { title: '差异数', dataIndex: 'discrepancyCount', width: 75, align: 'center' as const,
                        render: (v: number) => v > 0 ? <Tag color="purple">{v}</Tag> : '—'
                      },
                      { title: '净收入', dataIndex: 'netIncome', width: 110, align: 'right' as const, fixed: 'right' as const,
                        render: (v: number) => <Text strong style={{ color: '#0d9488' }}>¥{v.toFixed(2)}</Text>
                      }
                    ]}
                  />
                </Card>

                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card
                      title={<span><ShopOutlined /> 门店维度合计</span>}
                      size="small"
                      style={{ borderRadius: 8 }}
                      bodyStyle={{ padding: 0 }}
                    >
                      <Table
                        size="small"
                        dataSource={monthStoreStats.map((s, i) => ({ ...s, key: i }))}
                        pagination={false}
                        scroll={{ y: 320 }}
                        columns={[
                          { title: '门店', dataIndex: 'store', width: 100 },
                          { title: '收款', dataIndex: 'paidAmount', width: 100, align: 'right' as const,
                            render: (v: number) => `¥${v.toFixed(2)}`
                          },
                          { title: '核销', dataIndex: 'redeemedAmount', width: 100, align: 'right' as const,
                            render: (v: number) => `¥${v.toFixed(2)}`
                          },
                          { title: '已退', dataIndex: 'approvedRefundAmount', width: 90, align: 'right' as const,
                            render: (v: number) => <span style={{ color: '#16a34a' }}>-¥{v.toFixed(2)}</span>
                          },
                          { title: '待审', dataIndex: 'pendingRefundAmount', width: 90, align: 'right' as const,
                            render: (v: number) => <span style={{ color: '#dc2626' }}>¥{v.toFixed(2)}</span>
                          },
                          { title: '净收入', dataIndex: 'netIncome', width: 100, align: 'right' as const,
                            render: (v: number) => <Text strong style={{ color: '#0d9488' }}>¥{v.toFixed(2)}</Text>
                          }
                        ]}
                        summary={() => (
                          <Table.Summary.Row style={{ background: '#eff6ff', fontWeight: 600 }}>
                            <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right">
                              ¥{monthStoreStats.reduce((s, d) => s + d.paidAmount, 0).toFixed(2)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2} align="right">
                              ¥{monthStoreStats.reduce((s, d) => s + d.redeemedAmount, 0).toFixed(2)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3} align="right">
                              <span style={{ color: '#16a34a' }}>
                                -¥{monthStoreStats.reduce((s, d) => s + d.approvedRefundAmount, 0).toFixed(2)}
                              </span>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={4} align="right">
                              <span style={{ color: '#dc2626' }}>
                                ¥{monthStoreStats.reduce((s, d) => s + d.pendingRefundAmount, 0).toFixed(2)}
                              </span>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5} align="right">
                              <span style={{ color: '#0d9488' }}>
                                ¥{monthStoreStats.reduce((s, d) => s + d.netIncome, 0).toFixed(2)}
                              </span>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        )}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card
                      title={<span><WalletOutlined /> 项目类别维度合计</span>}
                      size="small"
                      style={{ borderRadius: 8 }}
                      bodyStyle={{ padding: 0 }}
                    >
                      <Table
                        size="small"
                        dataSource={monthCategoryStats.map((c, i) => ({ ...c, key: i }))}
                        pagination={false}
                        scroll={{ y: 320 }}
                        columns={[
                          { title: '项目类别', dataIndex: 'category', width: 130 },
                          { title: '卡券数', dataIndex: 'couponCount', width: 70, align: 'center' as const },
                          { title: '收款金额', dataIndex: 'paidAmount', width: 110, align: 'right' as const,
                            render: (v: number) => <span style={{ color: '#2563eb' }}>¥{v.toFixed(2)}</span>
                          },
                          { title: '核销金额', dataIndex: 'redeemedAmount', width: 110, align: 'right' as const,
                            render: (v: number) => `¥${v.toFixed(2)}`
                          },
                          { title: '已退金额', dataIndex: 'refundedAmount', width: 100, align: 'right' as const,
                            render: (v: number) => <span style={{ color: '#16a34a' }}>-¥{v.toFixed(2)}</span>
                          },
                          { title: '净收入', dataIndex: 'netIncome', width: 110, align: 'right' as const,
                            render: (v: number) => <Text strong style={{ color: '#0d9488' }}>¥{v.toFixed(2)}</Text>
                          }
                        ]}
                        summary={() => (
                          <Table.Summary.Row style={{ background: '#eff6ff', fontWeight: 600 }}>
                            <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="center">
                              {monthCategoryStats.reduce((s, d) => s + d.couponCount, 0)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2} align="right">
                              ¥{monthCategoryStats.reduce((s, d) => s + d.paidAmount, 0).toFixed(2)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3} align="right">
                              ¥{monthCategoryStats.reduce((s, d) => s + d.redeemedAmount, 0).toFixed(2)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={4} align="right">
                              <span style={{ color: '#16a34a' }}>
                                -¥{monthCategoryStats.reduce((s, d) => s + d.refundedAmount, 0).toFixed(2)}
                              </span>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5} align="right">
                              <span style={{ color: '#0d9488' }}>
                                ¥{monthCategoryStats.reduce((s, d) => s + d.netIncome, 0).toFixed(2)}
                              </span>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
            )
          },
          {
            key: 'sediment',
            label: (
              <span>
                <AlertOutlined style={{ color: '#dc2626' }} /> 卡券沉淀金额清单
                {sedimentStats.totalCount > 0 && <BadgeDanger count={sedimentStats.totalCount} />}
              </span>
            ),
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
                      <div className="stat-card-label"><AlertOutlined /> 沉淀总金额（月底汇报）</div>
                      <div className="stat-card-value" style={{ color: '#dc2626' }}>
                        ¥{sedimentStats.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="stat-card-trend">共 {sedimentStats.totalCount} 张卡券 · 建议月底催收或作废</div>
                    </Card>
                  </Col>
                  <Col span={5}>
                    <Card bordered style={{ borderRadius: 8, borderLeft: '4px solid #dc2626' }} bodyStyle={{ padding: 16 }}>
                      <div className="stat-card-label" style={{ color: '#dc2626' }}>高风险（≥1万 / ≥60天）</div>
                      <div className="stat-card-value" style={{ color: '#dc2626', fontSize: 20 }}>
                        {sedimentStats.high.count} 张
                      </div>
                      <div className="stat-card-trend amount-negative">¥{sedimentStats.high.amount.toLocaleString()}</div>
                    </Card>
                  </Col>
                  <Col span={5}>
                    <Card bordered style={{ borderRadius: 8, borderLeft: '4px solid #f59e0b' }} bodyStyle={{ padding: 16 }}>
                      <div className="stat-card-label" style={{ color: '#b45309' }}>中风险（5k~1万）</div>
                      <div className="stat-card-value" style={{ color: '#b45309', fontSize: 20 }}>
                        {sedimentStats.medium.count} 张
                      </div>
                      <div className="stat-card-trend" style={{ color: '#b45309' }}>¥{sedimentStats.medium.amount.toLocaleString()}</div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bordered style={{ borderRadius: 8, borderLeft: '4px solid #1f4e79' }} bodyStyle={{ padding: 16 }}>
                      <div className="stat-card-label" style={{ color: '#1f4e79' }}>低风险（1k~5k）</div>
                      <div className="stat-card-value" style={{ color: '#1f4e79', fontSize: 20 }}>
                        {sedimentStats.low.count} 张
                      </div>
                      <div className="stat-card-trend" style={{ color: '#1f4e79' }}>¥{sedimentStats.low.amount.toLocaleString()}</div>
                    </Card>
                  </Col>
                </Row>

                <div className="filter-section">
                  <Row gutter={[12, 12]} align="middle">
                    <Col span={3}>
                      <Select
                        style={{ width: '100%' }}
                        allowClear
                        placeholder="风险等级"
                        value={sedimentLevelFilter === 'all' ? undefined : sedimentLevelFilter}
                        onChange={(v) => setSedimentLevelFilter(v || 'all')}
                        options={[
                          { value: 'high', label: '高风险' },
                          { value: 'medium', label: '中风险' },
                          { value: 'low', label: '低风险' }
                        ]}
                      />
                    </Col>
                    <Col span={3}>
                      <Select
                        style={{ width: '100%' }}
                        allowClear
                        placeholder="售卖门店"
                        value={sedimentStoreFilter || undefined}
                        onChange={setSedimentStoreFilter}
                        options={meta.stores.map(s => ({ value: s, label: s }))}
                      />
                    </Col>
                    <Col span={9}>
                      <Input
                        prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                        placeholder="搜索 顾客 / 券号 / 卡券名称 / 咨询师"
                        value={sedimentKeyword}
                        onChange={e => setSedimentKeyword(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col span={9} style={{ textAlign: 'right' }}>
                      <Space>
                        <Button onClick={() => exportReport('xlsx', {
                          id: '', reportDate, generatedAt: '', generatedBy: '',
                          summary: {} as any, storeBreakdown: [], crossStoreSplit: [], status: 'draft'
                        })} icon={<DownloadOutlined />}>
                          导出沉淀清单（Excel）
                        </Button>
                        <Button onClick={() => {
                          setSedimentLevelFilter('all');
                          setSedimentStoreFilter('');
                          setSedimentKeyword('');
                        }} icon={<FilterOutlined />}>
                          重置
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </div>

                <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
                  <Table
                    size="small"
                    columns={sedimentColumns}
                    dataSource={sedimentList.map(s => ({ ...s, key: s.id }))}
                    scroll={{ x: 1600, y: 520 }}
                    pagination={{
                      pageSize: 15,
                      showSizeChanger: true,
                      showTotal: (t) => `共 ${t} 张沉淀卡券，沉淀总金额 ¥${sedimentList.reduce((s, r) => s + r.remainingAmount, 0).toLocaleString()}`
                    }}
                    rowClassName={(r) => r.sedimentLevel === 'high' ? 'sediment-row-high' : ''}
                  />
                </Card>
              </>
            )
          },
          {
            key: 'audit',
            label: <span><HistoryOutlined /> 审核痕迹（{auditTrails.length}）</span>,
            children: (
              <div style={{ display: 'flex', gap: 16, minHeight: 600 }}>
                <div style={{ flex: 3, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                  <div className="section-title" style={{ marginBottom: 12 }}>操作审计日志（最近 500 条）</div>
                  <Row gutter={[8, 8]} style={{ marginBottom: 12 }} align="middle">
                    <Col span={5}>
                      <Select
                        size="small"
                        style={{ width: '100%' }}
                        allowClear
                        placeholder="按模块筛选"
                        value={auditModuleFilter || undefined}
                        onChange={v => setAuditModuleFilter(v || '')}
                        options={auditModules.map(m => ({ value: m, label: m }))}
                      />
                    </Col>
                    <Col span={5}>
                      <Select
                        size="small"
                        style={{ width: '100%' }}
                        allowClear
                        placeholder="按动作筛选"
                        value={auditActionFilter || undefined}
                        onChange={v => setAuditActionFilter(v || '')}
                        options={auditActions.map(a => ({ value: a, label: a }))}
                      />
                    </Col>
                    <Col span={10}>
                      <Input
                        size="small"
                        prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                        placeholder="搜索 券号/退款单号/操作人/说明"
                        value={auditKeyword}
                        onChange={e => setAuditKeyword(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col span={4} style={{ textAlign: 'right', color: '#6b7280', fontSize: 12 }}>
                      筛选结果：{filteredAudits.length} 条
                    </Col>
                  </Row>
                  <Table
                    size="small"
                    dataSource={filteredAudits.map(a => ({ ...a, key: a.id }))}
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条记录` }}
                    scroll={{ y: 460 }}
                    columns={[
                      { title: '时间', dataIndex: 'timestamp', width: 160,
                        render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss')
                      },
                      { title: '模块', dataIndex: 'module', width: 100,
                        render: (v: string) => <Tag color="blue">{v}</Tag>
                      },
                      { title: '动作', dataIndex: 'action', width: 130, render: (v: string) => v },
                      { title: '操作人', dataIndex: 'operator', width: 90 },
                      { title: '目标ID', dataIndex: 'targetId', width: 150, render: (v: string) => <span className="tag-pro">{v}</span> },
                      { title: '说明', dataIndex: 'remark', ellipsis: true, render: (v: string) => v || '—' }
                    ]}
                  />
                </div>
                <div style={{ flex: 2, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                  <div className="section-title" style={{ marginBottom: 16 }}>操作时间线</div>
                  <Timeline
                    style={{ padding: 0 }}
                    items={recentAudits.slice(0, 20).map(a => ({
                      color: a.action.includes('approve') ? 'green'
                        : a.action.includes('reject') ? 'red'
                        : a.action.includes('import') ? 'blue'
                        : a.action.includes('discrepancy') ? 'orange' : 'blue',
                      children: (
                        <div style={{ padding: '2px 0 6px' }}>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {dayjs(a.timestamp).format('MM-DD HH:mm')} · {a.operator}
                          </div>
                          <div style={{ fontSize: 12.5, color: '#111827', margin: '2px 0' }}>
                            <Tag color="blue" style={{ marginRight: 6 }}>{a.module}</Tag>
                            {a.action}
                          </div>
                          {a.remark && <div style={{ fontSize: 12, color: '#6b7280' }}>{a.remark}</div>}
                        </div>
                      )
                    }))}
                  />
                </div>
              </div>
            )
          }
        ]}
      />

      <Modal
        title={previewReport ? `日结单预览 · ${previewReport.reportDate}` : ''}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={1100}
        footer={previewReport ? (
          <Space>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
            <Button icon={<DownloadOutlined />} onClick={() => exportReport('xlsx', previewReport!)}>导出Excel</Button>
            {previewReport.status === 'draft' && (
              <Button type="primary" onClick={() => setSubmitOpen(true)}>提交审核</Button>
            )}
            {previewReport.status === 'submitted' && (
              <Button type="primary" onClick={approveReport}>审核通过</Button>
            )}
            <Button onClick={() => setPreviewOpen(false)}>关闭</Button>
          </Space>
        ) : null}
      >
        {previewReport && (
          <div ref={printRef}>
            <div className="print-area" style={{ padding: 20, background: '#fff' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: 16, marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>医美机构每日结算报告</h1>
                <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
                  <Space size={24}>
                    <span>营业日期：<strong>{previewReport.reportDate}</strong></span>
                    <span>制表时间：{dayjs(previewReport.generatedAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                    <span>制表人：{previewReport.generatedBy}</span>
                    <span>状态：
                      <Tag color={reportStatusColor[previewReport.status].color} style={{ marginLeft: 4 }}>
                        {reportStatusColor[previewReport.status].label}
                      </Tag>
                    </span>
                  </Space>
                </div>
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 600, paddingBottom: 6, borderBottom: '2px solid #111827' }}>一、核心经营指标</h2>
              {(() => {
                const pendingRefunds = refunds.filter(r => r.date === previewReport.reportDate && r.auditStatus === 'pending');
                const pendingRefundCount = pendingRefunds.length;
                const pendingRefundAmount = pendingRefunds.reduce((s, r) => s + r.refundAmount, 0);
                return (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'left' }}>类别</th>
                          <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>数量</th>
                          <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>金额（元）</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db' }}>当日收款（含各种支付方式）</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>{previewReport.summary.totalOrders} 单</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 600 }}>¥{previewReport.summary.totalPaidAmount.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db' }}>当日服务核销</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>{previewReport.summary.totalRedemptions} 次</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>¥{previewReport.summary.totalRedeemedAmount.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', color: '#dc2626' }}>当日已通过退款（扣减收入）</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>{previewReport.summary.totalRefunds} 笔</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#dc2626' }}>-¥{previewReport.summary.totalRefundAmount.toFixed(2)}</td>
                        </tr>
                        <tr style={{ background: '#fff7ed' }}>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', color: '#c2410c' }}>
                            <AlertOutlined style={{ marginRight: 4 }} />
                            当日待审核退款（风险占用）
                          </td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center', color: '#c2410c' }}>{pendingRefundCount} 笔</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#c2410c' }}>
                            ¥{pendingRefundAmount.toFixed(2)}
                            <span style={{ fontSize: 11, marginLeft: 4 }}>（未扣减收入）</span>
                          </td>
                        </tr>
                        <tr style={{ background: '#f0fdf4', fontWeight: 700 }}>
                          <td style={{ padding: '10px 12px', border: '1px solid #d1d5db' }}>当日净收入</td>
                          <td style={{ padding: '10px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>—</td>
                          <td style={{ padding: '10px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#16a34a', fontSize: 15 }}>
                            ¥{(previewReport.summary.totalPaidAmount - previewReport.summary.totalRefundAmount).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {pendingRefundCount > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#92400e', background: '#fffbeb', padding: '6px 10px', borderRadius: 4, border: '1px solid #fcd34d' }}>
                        <AlertOutlined style={{ marginRight: 4 }} />
                        风险提示：当日有 {pendingRefundCount} 笔待审核退款，金额 ¥{pendingRefundAmount.toFixed(2)}，请及时处理避免实际收入与预期不符
                      </div>
                    )}
                  </>
                );
              })()}

              <h2 style={{ fontSize: 16, fontWeight: 600, paddingBottom: 6, borderBottom: '2px solid #111827', marginTop: 28 }}>二、卡券发放统计</h2>
              <div className="info-row" style={{ marginTop: 10 }}>
                <span>正常购买卡券：<strong>{previewReport.summary.normalCouponCount}</strong> 张</span>
                <span>赠送券：<strong style={{ color: '#16a34a' }}>{previewReport.summary.giftCouponCount}</strong> 张</span>
                <span>员工福利券：<strong style={{ color: '#9333ea' }}>{previewReport.summary.staffCouponCount}</strong> 张</span>
                <span>合计：<strong>{previewReport.summary.normalCouponCount + previewReport.summary.giftCouponCount + previewReport.summary.staffCouponCount}</strong> 张</span>
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 600, paddingBottom: 6, borderBottom: '2px solid #111827', marginTop: 28 }}>三、门店维度明细</h2>
              {(() => {
                const pendingByStore = new Map<string, number>();
                refunds.filter(r => r.date === previewReport.reportDate && r.auditStatus === 'pending')
                  .forEach(r => {
                    pendingByStore.set(r.soldStore, (pendingByStore.get(r.soldStore) || 0) + r.refundAmount);
                  });
                const totalPending = Array.from(pendingByStore.values()).reduce((s, v) => s + v, 0);
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db' }}>门店</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>收款单数</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>收款金额</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>核销次数</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>核销金额</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>已通过退款</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#c2410c' }}>待审退款（风险）</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>净收款</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewReport.storeBreakdown.map((s: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', fontWeight: 500 }}>{s.store}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>{s.orderCount || 0}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>¥{s.paidAmount.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>{s.redemptionCount || 0}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>¥{s.redeemedAmount.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#dc2626' }}>-¥{s.refundAmount.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#c2410c', background: '#fff7ed' }}>
                            ¥{(pendingByStore.get(s.store) || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 600 }}>¥{s.net.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#eff6ff', fontWeight: 700 }}>
                        <td style={{ padding: '8px 12px', border: '1px solid #d1d5db' }}>合计</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>{previewReport.storeBreakdown.reduce((s, d: any) => s + (d.orderCount || 0), 0)}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>¥{previewReport.storeBreakdown.reduce((s, d: any) => s + d.paidAmount, 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>{previewReport.storeBreakdown.reduce((s, d: any) => s + (d.redemptionCount || 0), 0)}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>¥{previewReport.storeBreakdown.reduce((s, d: any) => s + d.redeemedAmount, 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#dc2626' }}>-¥{previewReport.storeBreakdown.reduce((s, d: any) => s + d.refundAmount, 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#c2410c', background: '#fff7ed' }}>
                          ¥{totalPending.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right', color: '#1f4e79' }}>¥{previewReport.storeBreakdown.reduce((s, d: any) => s + d.net, 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}

              {previewReport.crossStoreSplit.length > 0 && (
                <>
                  <h2 style={{ fontSize: 16, fontWeight: 600, paddingBottom: 6, borderBottom: '2px solid #111827', marginTop: 28 }}>四、跨店核销拆账（服务门店 60% / 售卖门店 40%）</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db' }}>售卖门店</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db' }}>服务门店</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>跨店次数</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>总金额</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>服务门店分成 60%</th>
                        <th style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'right' }}>售卖门店分成 40%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewReport.crossStoreSplit.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db' }}>{r.soldStore}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', color: '#1f4e79' }}>{r.serviceStore}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d1d5db', textAlign: 'center' }}>{r.times}</td>
                          <td style={{ padding: '812px', border: '1px solid #d1d5db', textAlign: 'right' }}>¥{r.totalAmount.toFixed(2)}</td>
                          <td style={{ padding: '812px', border: '1px solid #d1d5db', textAlign: 'right', color: '#16a34a' }}>¥{r.serviceShare.toFixed(2)}</td>
                          <td style={{ padding: '812px', border: '1px solid #d1d5db', textAlign: 'right', color: '#0891b2' }}>¥{r.soldShare.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <h2 style={{ fontSize: 16, fontWeight: 600, paddingBottom: 6, borderBottom: '2px solid #111827', marginTop: 28 }}>五、差异核对与风险提示</h2>
              <div style={{ marginTop: 10 }}>
                <Alert
                  type={previewReport.summary.discrepancyCount > 0 ? 'warning' : 'success'}
                  showIcon
                  message={previewReport.summary.discrepancyCount > 0
                    ? `当日存在 ${previewReport.summary.discrepancyCount} 条待处理差异，请前往【差异核对】模块处理完成后再提交审核。`
                    : '当日差异已全部处理完毕，数据一致性良好。'
                  }
                />
              </div>

              <div style={{ marginTop: 32, borderTop: '2px dashed #d1d5db', paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                <div>制表人签字：_______________</div>
                <div>财务主管审核：_______________</div>
                <div>日期：{previewReport.status === 'approved' && previewReport.approvedAt ? dayjs(previewReport.approvedAt).format('YYYY-MM-DD') : '_______________'}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="提交日结单审核"
        open={submitOpen}
        onCancel={() => setSubmitOpen(false)}
        onOk={() => submitForm.submit()}
        okText="确认提交"
        width={520}
      >
        <Alert
          type="info"
          showIcon
          message="提交后日结单状态将变更为【已提交】，财务主管将进行审核。"
          style={{ marginBottom: 16 }}
        />
        <Form form={submitForm} layout="vertical" onFinish={submitReport}>
          <Form.Item label="提交人" name="submitter" rules={[{ required: true, message: '请填写提交人姓名' }]} initialValue="财务员">
            <Input placeholder="请输入提交人姓名" />
          </Form.Item>
          <Form.Item label="备注说明" name="remark">
            <TextArea rows={4} placeholder="填写本日结账特殊说明、异常情况等，可留空" showCount maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const BadgeDanger: React.FC<{ count: number }> = ({ count }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 20, height: 18, padding: '0 6px',
    background: '#fee2e2', color: '#dc2626',
    fontSize: 11, fontWeight: 600, borderRadius: 9,
    fontVariantNumeric: 'tabular-nums'
  }}>
    {count}
  </span>
);

export default ReportPage;
