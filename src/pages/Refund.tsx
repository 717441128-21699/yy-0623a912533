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
  Modal,
  App,
  Typography,
  Drawer,
  Descriptions,
  Form,
  InputNumber,
  Alert,
  Tooltip,
  Divider,
  Progress,
  Radio
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  RollbackOutlined,
  ExportOutlined,
  ShopOutlined,
  WalletOutlined,
  UserOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useApp } from '@/App';
import type { RefundRecord, Coupon, RedemptionRecord } from '@/types';
import { genId } from '@/store';

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const auditStatusColor = {
  pending: { color: 'orange', label: '待审核', icon: <ReloadOutlined /> },
  approved: { color: 'green', label: '已通过', icon: <CheckOutlined /> },
  rejected: { color: 'red', label: '已驳回', icon: <CloseOutlined /> }
};

const reasonOptions = [
  '顾客出国/搬迁不再需要',
  '皮肤敏感/医生建议暂停',
  '与其他机构套餐重复',
  '效果不满意/服务体验差',
  '经济原因/预算调整',
  '怀孕/哺乳等身体原因',
  '医疗禁忌/禁忌症',
  '其他原因'
];

const RefundPage: React.FC = () => {
  const {
    businessDate, refunds, setRefunds,
    coupons, redemptions, paymentOrders,
    addAudit, persistAll, meta
  } = useApp();
  const { message, modal } = App.useApp();

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [auditForm] = Form.useForm();
  const [auditOpen, setAuditOpen] = useState(false);
  const [selectedCouponForRefund, setSelectedCouponForRefund] = useState<Coupon | null>(null);

  const filtered = useMemo(() => {
    return refunds.filter(r => {
      if (statusFilter !== 'all' && r.auditStatus !== statusFilter) return false;
      if (storeFilter && r.soldStore !== storeFilter && r.serviceStore !== storeFilter) return false;
      if (dateRange) {
        const d = dayjs(r.date);
        if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
      }
      if (keyword) {
        const k = keyword.toLowerCase();
        const hay = `${r.customerName}${r.phone}${r.couponNo}${r.refundNo}${r.projectName}${r.reason}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [refunds, statusFilter, storeFilter, dateRange, keyword]);

  const stats = useMemo(() => {
    const pending = refunds.filter(r => r.auditStatus === 'pending');
    const approved = refunds.filter(r => r.auditStatus === 'approved');
    const rejected = refunds.filter(r => r.auditStatus === 'rejected');
    return {
      total: refunds.length,
      pending: pending.length,
      pendingAmount: pending.reduce((s, r) => s + r.refundAmount, 0),
      approved: approved.length,
      approvedAmount: approved.reduce((s, r) => s + r.refundAmount, 0),
      rejected: rejected.length,
      rejectedAmount: rejected.reduce((s, r) => s + r.refundAmount, 0),
      todayCount: refunds.filter(r => r.date === businessDate).length,
      todayAmount: refunds.filter(r => r.date === businessDate).reduce((s, r) => s + r.refundAmount, 0)
    };
  }, [refunds, businessDate]);

  const getCouponForRefund = (couponNo: string) => coupons.find(c => c.couponNo === couponNo);
  const getRedemptionsForCoupon = (couponNo: string) =>
    redemptions.filter(r => r.couponNo === couponNo).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const getCrossStoreSplit = (couponNo: string) => {
    const c = getCouponForRefund(couponNo);
    if (!c) return { crossStore: false, details: [] as any[] };
    const rs = getRedemptionsForCoupon(couponNo);
    const crossRedemptions = rs.filter(r => r.serviceStore !== c.soldStore);
    const details = crossRedemptions.map(r => ({
      ...r,
      splitToService: Number((r.amount * 0.6).toFixed(2)),
      splitToSold: Number((r.amount * 0.4).toFixed(2))
    }));
    return {
      crossStore: crossRedemptions.length > 0,
      details,
      totalToService: details.reduce((s, d) => s + d.splitToService, 0),
      totalToSold: details.reduce((s, d) => s + d.splitToSold, 0)
    };
  };

  const openDetail = (r: RefundRecord) => {
    setSelectedRefund(r);
    setDrawerOpen(true);
    addAudit({
      module: 'refund',
      action: 'view',
      operator: '财务员',
      targetId: r.refundNo,
      remark: '查看退款详情'
    });
  };

  const startCreate = () => {
    if (coupons.filter(c => c.totalCount - c.usedCount > 0).length === 0) {
      message.warning('没有可退款的有效卡券');
      return;
    }
    createForm.resetFields();
    setSelectedCouponForRefund(null);
    setCreateOpen(true);
  };

  const handleCouponSelect = (couponId: string) => {
    const c = coupons.find(x => x.id === couponId);
    if (c) {
      setSelectedCouponForRefund(c);
      const usedCount = c.usedCount;
      const remainingCount = Math.max(0, c.totalCount - usedCount);
      createForm.setFieldsValue({
        couponId: c.id,
        customerName: c.customerName,
        phone: c.phone,
        projectName: c.projectName,
        couponName: c.couponName,
        couponNo: c.couponNo,
        totalCount: c.totalCount,
        usedCount,
        remainingCount,
        unitPrice: c.unitPrice,
        refundCount: remainingCount,
        refundAmount: Number((remainingCount * c.unitPrice).toFixed(2)),
        soldStore: c.soldStore,
        maxRefundCount: remainingCount
      });
    }
  };

  const onRefundCountChange = (count: number | null) => {
    if (!selectedCouponForRefund || count == null) return;
    const amount = Number((count * selectedCouponForRefund.unitPrice).toFixed(2));
    createForm.setFieldsValue({ refundAmount: amount });
  };

  const submitCreate = async (values: any) => {
    if (!selectedCouponForRefund) return;
    const newRecord: RefundRecord = {
      id: genId('RF'),
      refundNo: `TK${businessDate.replace(/-/g, '')}${(refunds.length + 1).toString().padStart(4, '0')}`,
      date: businessDate,
      customerId: selectedCouponForRefund.customerId,
      customerName: values.customerName,
      phone: values.phone,
      couponNo: selectedCouponForRefund.couponNo,
      couponName: values.couponName,
      projectName: values.projectName,
      totalCount: values.totalCount,
      usedCount: values.usedCount,
      remainingCount: values.remainingCount,
      refundCount: values.refundCount,
      refundAmount: Number(values.refundAmount.toFixed(2)),
      soldStore: values.soldStore,
      serviceStore: values.serviceStore || values.soldStore,
      reason: values.reason,
      approver: '',
      auditStatus: 'pending',
      auditRemark: undefined,
      createdAt: new Date().toISOString()
    };
    setRefunds([newRecord, ...refunds]);
    addAudit({
      module: 'refund',
      action: 'create',
      operator: '财务员',
      targetId: newRecord.refundNo,
      afterData: newRecord,
      remark: `创建退款申请 ${newRecord.customerName} ¥${newRecord.refundAmount}`
    });
    await persistAll();
    setCreateOpen(false);
    message.success(`退款申请已创建：${newRecord.refundNo}`);
  };

  const openAudit = (r: RefundRecord) => {
    setSelectedRefund(r);
    auditForm.setFieldsValue({
      decision: r.auditStatus,
      auditRemark: r.auditRemark || '',
      approver: '财务主管'
    });
    setAuditOpen(true);
  };

  const submitAudit = async (values: any) => {
    if (!selectedRefund) return;
    const before = { ...selectedRefund };
    const updated = {
      ...selectedRefund,
      auditStatus: values.decision,
      auditRemark: values.auditRemark,
      approver: values.approver
    };
    const list = refunds.map(r => r.id === updated.id ? updated : r);
    setRefunds(list);

    if (values.decision === 'approved') {
      const newCoupons = coupons.map(c => {
        if (c.couponNo === updated.couponNo) {
          const newTotal = Math.max(0, c.totalCount - updated.refundCount);
          return {
            ...c,
            totalCount: newTotal,
            status: newTotal <= 0 || c.usedCount >= newTotal ? 'used_up' : c.status
          };
        }
        return c;
      });
      await Promise.all([
        persistAll(),
        useApp().setCoupons(newCoupons)
      ]);
    } else {
      await persistAll();
    }

    addAudit({
      module: 'refund',
      action: `audit_${values.decision}`,
      operator: values.approver,
      targetId: updated.refundNo,
      beforeData: before,
      afterData: updated,
      remark: `审核退款：${values.decision === 'approved' ? '通过' : '驳回'} - ${values.auditRemark || '无'}`
    });

    setAuditOpen(false);
    message.success(`已${values.decision === 'approved' ? '通过' : '驳回'}退款申请`);
  };

  const exportData = () => {
    if (filtered.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }
    const exportData = filtered.map(r => ({
      退款单号: r.refundNo,
      日期: r.date,
      顾客姓名: r.customerName,
      手机号: r.phone,
      券号: r.couponNo,
      卡券名称: r.couponName,
      项目: r.projectName,
      总次数: r.totalCount,
      已用次数: r.usedCount,
      剩余次数: r.remainingCount,
      退款次数: r.refundCount,
      退款金额: r.refundAmount,
      售卖门店: r.soldStore,
      服务门店: r.serviceStore,
      退款原因: r.reason,
      审核状态: auditStatusColor[r.auditStatus].label,
      审批人: r.approver || '',
      审批备注: r.auditRemark || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '退款明细');
    XLSX.writeFile(wb, `退款明细-${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success(`已导出 ${filtered.length} 条退款记录`);
  };

  const columns = [
    {
      title: '审核状态', dataIndex: 'auditStatus', width: 95, fixed: 'left' as const,
      render: (v: any) => {
        const s = auditStatusColor[v as keyof typeof auditStatusColor];
        return <Tag color={s.color} icon={s.icon}>{s.label}</Tag>;
      }
    },
    { title: '退款单号', dataIndex: 'refundNo', width: 150, render: (v: string) => <span className="tag-pro">{v}</span> },
    { title: '申请日期', dataIndex: 'date', width: 105 },
    { title: '顾客', dataIndex: 'customerName', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 120, render: (v: string) => v?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') },
    { title: '券号', dataIndex: 'couponNo', width: 130, render: (v: string) => v ? <span className="tag-pro">{v}</span> : '—' },
    { title: '项目名称', dataIndex: 'projectName', width: 130, ellipsis: true },
    { title: '退/余次数', key: 'counts', width: 100, align: 'center' as const, render: (_: any, r: RefundRecord) => `${r.refundCount} / ${r.remainingCount}` },
    {
      title: '退款金额', dataIndex: 'refundAmount', width: 110, align: 'right' as const,
      render: (v: number) => <span className="amount-negative">-¥{v.toFixed(2)}</span>
    },
    { title: '售卖门店', dataIndex: 'soldStore', width: 105 },
    { title: '退款原因', dataIndex: 'reason', width: 150, ellipsis: true },
    { title: '审批人', dataIndex: 'approver', width: 80, render: (v: string) => v || '—' },
    {
      title: '操作', key: 'op', width: 160, fixed: 'right' as const,
      render: (_: any, r: RefundRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => openDetail(r)}>详情</Button>
          {r.auditStatus === 'pending' && (
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => openAudit(r)}>审核</Button>
          )}
        </Space>
      )
    }
  ];

  const availableCoupons = coupons.filter(c => c.totalCount - c.usedCount > 0 && c.status === 'active');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">退款关联</h1>
          <p className="page-desc">
            自动关联已核销次数计算可退余额；跨店核销记录按 60% / 40% 拆分到服务门店和售卖门店；支持完整审批流程。
          </p>
        </div>
        <Space size={12}>
          <Button size="large" icon={<ExportOutlined />} onClick={exportData}>导出</Button>
          <Button size="large" type="primary" icon={<PlusOutlined />} onClick={startCreate}>
            创建退款申请
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label"><RollbackOutlined /> 今日退款申请</div>
            <div className="stat-card-value">{stats.todayCount}<span className="stat-card-unit">笔</span></div>
            <div className="stat-card-trend amount-negative">-¥{stats.todayAmount.toFixed(2)}</div>
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered style={{ borderRadius: 8, borderLeft: '4px solid #faad14' }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">待审核</div>
            <div className="stat-card-value" style={{ color: '#d46b08' }}>
              {stats.pending}<span className="stat-card-unit">笔</span>
            </div>
            <div className="stat-card-trend amount-negative">涉及 ¥{stats.pendingAmount.toFixed(2)}</div>
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered style={{ borderRadius: 8, borderLeft: '4px solid #52c41a' }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">已通过</div>
            <div className="stat-card-value" style={{ color: '#389e0d' }}>
              {stats.approved}<span className="stat-card-unit">笔</span>
            </div>
            <div className="stat-card-trend amount-negative">累计 -¥{stats.approvedAmount.toFixed(2)}</div>
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered style={{ borderRadius: 8, borderLeft: '4px solid #ff4d4f' }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">已驳回</div>
            <div className="stat-card-value" style={{ color: '#cf1322' }}>
              {stats.rejected}<span className="stat-card-unit">笔</span>
            </div>
            <div className="stat-card-trend" style={{ color: '#6b7280' }}>涉及 ¥{stats.rejectedAmount.toFixed(2)}</div>
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">总退款率</div>
            {useMemo(() => {
              const totalRedeemed = redemptions.reduce((s, r) => s + r.amount, 0);
              const pct = totalRedeemed > 0 ? (stats.approvedAmount / totalRedeemed) * 100 : 0;
              return <Progress percent={Number(pct.toFixed(1))} size="small" style={{ marginTop: 12 }} strokeColor="#dc2626"
                format={(p) => <span style={{ fontSize: 12, color: '#dc2626' }}>{p}%（¥{stats.approvedAmount.toFixed(0)}）</span>}
              />;
            }, [stats, redemptions])}
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
              placeholder={['申请开始', '申请结束']}
            />
          </Col>
          <Col span={3}>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="门店"
              value={storeFilter || undefined}
              onChange={setStoreFilter}
              options={meta.stores.map(s => ({ value: s, label: s }))}
            />
          </Col>
          <Col span={3}>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="审核状态"
              value={statusFilter === 'all' ? undefined : statusFilter}
              onChange={(v) => setStatusFilter(v || 'all')}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已驳回' }
              ]}
            />
          </Col>
          <Col span={8}>
            <Input
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              placeholder="搜索 顾客 / 手机号 / 券号 / 退款单号 / 项目"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Button
              onClick={() => { setKeyword(''); setStatusFilter('all'); setStoreFilter(''); setDateRange(null); }}
              icon={<FilterOutlined />}
            >
              清空筛选
            </Button>
          </Col>
        </Row>
      </div>

      <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table
          size="small"
          columns={columns}
          dataSource={filtered.map(r => ({ ...r, key: r.id }))}
          scroll={{ x: 1500, y: 560 }}
          pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `共 ${t} 条退款申请` }}
          onRow={(r: RefundRecord) => ({ onDoubleClick: () => openDetail(r) })}
          summary={(cur) => {
            const totalRefund = cur.reduce((s, r) => s + r.refundAmount, 0);
            const totalRefundCnt = cur.reduce((s, r) => s + r.refundCount, 0);
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={7} align="right">
                    <Text strong>当前筛选合计：</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="center"><Text strong>{totalRefundCnt} 次</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right"><Text strong type="danger">-¥{totalRefund.toFixed(2)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={9} colSpan={4} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      <Drawer
        title="退款详情"
        width={820}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            {selectedRefund?.auditStatus === 'pending' && (
              <Button type="primary" icon={<CheckOutlined />} onClick={() => openAudit(selectedRefund)}>审核</Button>
            )}
            <Button onClick={() => setDrawerOpen(false)}>关闭</Button>
          </Space>
        }
      >
        {selectedRefund && (
          <>
            <div className={`discrepancy-card discrepancy-${selectedRefund.auditStatus === 'approved' ? 'amount_mismatch' : selectedRefund.auditStatus === 'rejected' ? 'duplicate_redemption' : 'paid_not_redeemed'}`}
              style={{ borderLeftColor: auditStatusColor[selectedRefund.auditStatus].color.replace('#', '') }}
            >
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <Space size={10}>
                  <Tag color={auditStatusColor[selectedRefund.auditStatus].color} icon={auditStatusColor[selectedRefund.auditStatus].icon} style={{ fontSize: 13, padding: '3px 10px' }}>
                    {auditStatusColor[selectedRefund.auditStatus].label}
                  </Tag>
                  <span className="tag-pro">{selectedRefund.refundNo}</span>
                </Space>
                <Text type="secondary">{selectedRefund.date}</Text>
              </Row>
              <Descriptions column={3} size="small" bordered style={{ marginBottom: 0 }}>
                <Descriptions.Item label="顾客"><Text strong>{selectedRefund.customerName}</Text>（{selectedRefund.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}）</Descriptions.Item>
                <Descriptions.Item label="券号"><span className="tag-pro">{selectedRefund.couponNo}</span></Descriptions.Item>
                <Descriptions.Item label="卡券名称">{selectedRefund.couponName}</Descriptions.Item>
                <Descriptions.Item label="项目">{selectedRefund.projectName}</Descriptions.Item>
                <Descriptions.Item label="售卖门店">{selectedRefund.soldStore}</Descriptions.Item>
                <Descriptions.Item label="服务门店">{selectedRefund.serviceStore}</Descriptions.Item>
                <Descriptions.Item label="总 / 已用 / 剩余次数">
                  {selectedRefund.totalCount} / {selectedRefund.usedCount} / <span className="amount-positive">{selectedRefund.remainingCount}</span>
                </Descriptions.Item>
                <Descriptions.Item label="申请退款次数">
                  <span className="amount-negative">{selectedRefund.refundCount}</span> 次
                </Descriptions.Item>
                <Descriptions.Item label="申请退款金额">
                  <span className="amount-negative" style={{ fontSize: 15, fontWeight: 600 }}>-¥{selectedRefund.refundAmount.toFixed(2)}</span>
                </Descriptions.Item>
              </Descriptions>
              <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
                退款原因：<Text style={{ color: '#374151' }}>{selectedRefund.reason}</Text>
              </div>
            </div>

            {(() => {
              const split = getCrossStoreSplit(selectedRefund.couponNo);
              return (
                <>
                  <div className="section-title" style={{ marginTop: 20 }}>
                    <Space>
                      <span>可退余额计算依据</span>
                      {split.crossStore && <Tag color="orange">涉及跨店拆账</Tag>}
                    </Space>
                  </div>
                  {(() => {
                    const c = getCouponForRefund(selectedRefund.couponNo);
                    const rs = getRedemptionsForCoupon(selectedRefund.couponNo);
                    const remainingCount = c ? c.totalCount - c.usedCount : 0;
                    const refundableAmount = c ? remainingCount * c.unitPrice : 0;
                    return (
                      <Card size="small" style={{ borderRadius: 8, background: '#f0f9ff', border: '1px solid #bfdbfe' }}>
                        <Row gutter={[16, 10]} align="middle">
                          <Col span={8}>
                            <div style={{ fontSize: 12, color: '#1f4e79' }}>单次价格</div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: '#1f4e79' }}>¥{c?.unitPrice.toFixed(2) || '0.00'}</div>
                          </Col>
                          <Col span={8}>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>可退次数</div>
                            <div style={{ fontSize: 20, fontWeight: 600 }}>
                              <span className="amount-positive">{remainingCount}</span> 次
                              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>
                                （总{c?.totalCount || 0}次 - 已用{c?.usedCount || 0}次）
                              </div>
                            </div>
                          </Col>
                          <Col span={8}>
                            <div style={{ fontSize: 12, color: '#16a34a' }}>最大可退金额</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>¥{refundableAmount.toFixed(2)}</div>
                            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>
                              本次申请：<span className="amount-negative">-¥{selectedRefund.refundAmount.toFixed(2)}</span>
                              <Progress percent={refundableAmount > 0 ? (selectedRefund.refundAmount / refundableAmount) * 100 : 0}
                                size="small" style={{ marginTop: 4 }} strokeColor="#dc2626" />
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    );
                  })()}

                  {split.crossStore && (
                    <>
                      <div className="section-title" style={{ marginTop: 20 }}>跨店核销拆分明细（服务门店 60% / 售卖门店 40%）</div>
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={split.details.map((d: any, i: number) => ({ ...d, key: i }))}
                        columns={[
                          { title: '核销日期', dataIndex: 'date', width: 100 },
                          { title: '核销单号', dataIndex: 'redemptionNo', render: (v) => <span className="tag-pro">{v}</span> },
                          { title: '服务门店', dataIndex: 'serviceStore', width: 110, render: (v: string) => <Tag color="blue">{v}</Tag> },
                          { title: '售卖门店', dataIndex: 'soldStore', width: 110 },
                          { title: '核销金额', dataIndex: 'amount', align: 'right', render: (v) => `¥${v.toFixed(2)}` },
                          { title: '服务门店 60%', key: 's1', align: 'right', render: (d: any) => <span className="amount-positive">¥{d.splitToService.toFixed(2)}</span> },
                          { title: '售卖门店 40%', key: 's2', align: 'right', render: (d: any) => <span className="amount-neutral">¥{d.splitToSold.toFixed(2)}</span> }
                        ]}
                      />
                      <Row style={{ marginTop: 12 }}>
                        <Col flex="1">
                          <Alert
                            type="info"
                            showIcon
                            message={
                              <Space>
                                <span>本次退款涉及跨店核销拆分：</span>
                                <span>服务门店承担 <span className="amount-negative">¥{(split.totalToService || 0).toFixed(2)}</span></span>
                                <span>售卖门店承担 <span className="amount-negative">¥{(split.totalToSold || 0).toFixed(2)}</span></span>
                              </Space>
                            }
                          />
                        </Col>
                      </Row>
                    </>
                  )}
                </>
              );
            })()}

            <div className="section-title" style={{ marginTop: 20 }}>关联核销记录</div>
            <Table
              size="small"
              pagination={false}
              dataSource={getRedemptionsForCoupon(selectedRefund.couponNo).map(r => ({ ...r, key: r.id }))}
              columns={[
                { title: '日期', dataIndex: 'date', width: 100 },
                { title: '时间', dataIndex: 'time', width: 60 },
                { title: '核销单号', dataIndex: 'redemptionNo', render: (v) => <span className="tag-pro">{v}</span> },
                { title: '项目', dataIndex: 'projectName', width: 130 },
                { title: '次数', dataIndex: 'redemptionCount', width: 60, align: 'center' },
                { title: '金额', dataIndex: 'amount', align: 'right', render: (v) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
                { title: '服务门店', dataIndex: 'serviceStore', width: 110 },
                { title: '医生', dataIndex: 'doctor', width: 90 }
              ]}
            />

            {selectedRefund.approver && (
              <>
                <div className="section-title" style={{ marginTop: 20 }}>审核记录</div>
                <Card size="small" style={{ borderRadius: 8 }}>
                  <Descriptions column={3} size="small">
                    <Descriptions.Item label="审批人"><Text strong>{selectedRefund.approver}</Text></Descriptions.Item>
                    <Descriptions.Item label="审批结果">
                      <Tag color={auditStatusColor[selectedRefund.auditStatus].color}>{auditStatusColor[selectedRefund.auditStatus].label}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="审批时间">{dayjs(selectedRefund.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
                    {selectedRefund.auditRemark && (
                      <Descriptions.Item label="审批意见" span={3}>{selectedRefund.auditRemark}</Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </>
            )}
          </>
        )}
      </Drawer>

      <Modal
        title="创建退款申请"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="提交退款申请"
        width={720}
      >
        <Alert
          type="info"
          showIcon
          message="请选择顾客的有效卡券，系统将自动计算可退余额与跨店拆分"
          style={{ marginBottom: 16 }}
        />
        <Form
          form={createForm}
          layout="vertical"
          onFinish={submitCreate}
          size="large"
        >
          <Form.Item label="选择可退款卡券" name="couponId" rules={[{ required: true, message: '请选择要退款的卡券' }]}>
            <Select
              showSearch
              placeholder="搜索 顾客姓名 / 手机号 / 券号 / 项目"
              optionFilterProp="label"
              onChange={handleCouponSelect}
              options={availableCoupons.map(c => ({
                value: c.id,
                label: `${c.customerName} | ${c.phone} | ${c.couponNo} | ${c.couponName} | 剩余${c.totalCount - c.usedCount}次`,
                customerName: c.customerName,
                phone: c.phone
              }))}
              listHeight={300}
            />
          </Form.Item>

          {selectedCouponForRefund && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="顾客姓名" name="customerName"><Input disabled /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="手机号" name="phone"><Input disabled /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="项目名称" name="projectName"><Input disabled /></Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="卡券名称" name="couponName"><Input disabled /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="券号" name="couponNo"><Input disabled /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="售卖门店" name="soldStore"><Input disabled /></Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="总次数" name="totalCount"><Input disabled /></Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="已用次数" name="usedCount"><Input disabled /></Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="剩余次数（可退上限）" name="remainingCount">
                    <Input disabled prefix={<span className="amount-positive">可退</span>} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="单次价格" name="unitPrice">
                    <Input disabled prefix="¥" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '8px 0 16px' }} />

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="申请退款次数" name="refundCount" rules={[{ required: true, message: '请填写退款次数' }]}>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      max={createForm.getFieldValue('remainingCount') || 1}
                      onChange={onRefundCountChange}
                      addonAfter={`/ 最多 ${createForm.getFieldValue('remainingCount') || 0} 次`}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="申请退款金额" name="refundAmount" rules={[{ required: true }]}>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      step={0.01}
                      prefix="¥"
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="退款原因" name="reason" rules={[{ required: true, message: '请选择退款原因' }]}>
                <Select
                  options={reasonOptions.map(r => ({ value: r, label: r }))}
                  placeholder="请选择退款原因"
                />
              </Form.Item>

              {getCrossStoreSplit(selectedCouponForRefund.couponNo).crossStore && (
                <Alert
                  type="warning"
                  showIcon
                  message="该卡券存在跨店核销记录，系统将按规则（服务门店 60% / 售卖门店 40%）自动拆分退款金额"
                />
              )}
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="退款审核"
        open={auditOpen}
        onCancel={() => setAuditOpen(false)}
        onOk={() => auditForm.submit()}
        okText="确认审核结果"
        width={560}
      >
        {selectedRefund && (
          <Alert
            showIcon
            type="warning"
            style={{ marginBottom: 16 }}
            message={`退款单号 ${selectedRefund.refundNo}`}
            description={
              <div style={{ fontSize: 12 }}>
                <div>顾客：{selectedRefund.customerName} · 券号：{selectedRefund.couponNo}</div>
                <div>申请退款：<span className="amount-negative" style={{ fontSize: 14 }}>-¥{selectedRefund.refundAmount.toFixed(2)}</span>（{selectedRefund.refundCount} 次）</div>
              </div>
            }
          />
        )}
        <Form form={auditForm} layout="vertical" onFinish={submitAudit}>
          <Form.Item label="审核结论" name="decision" rules={[{ required: true }]}>
            <Radio.Group size="large">
              <Radio.Button value="approved" style={{ color: '#16a34a', borderColor: '#16a34a' }}>
                <CheckOutlined /> 通过
              </Radio.Button>
              <Radio.Button value="rejected" style={{ color: '#dc2626', borderColor: '#dc2626', marginLeft: -1 }}>
                <CloseOutlined /> 驳回
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="审批人" name="approver" rules={[{ required: true }]}>
            <Input placeholder="请填写审批人姓名" />
          </Form.Item>
          <Form.Item label="审核备注" name="auditRemark" rules={[{ required: true, message: '请填写审核意见' }]}>
            <TextArea
              rows={4}
              placeholder="请详细说明通过或驳回的原因，以及后续处理方式，作为财务审计凭据"
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RefundPage;
