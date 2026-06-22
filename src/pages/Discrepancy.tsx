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
  Radio,
  Tooltip,
  Divider,
  Drawer,
  Descriptions,
  Badge,
  Form,
  Alert,
  Progress
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  EditOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  DoubleRightOutlined,
  DeleteRowOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '@/App';
import type { DiscrepancyRecord, DiscrepancyType } from '@/types';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const typeMeta: Record<DiscrepancyType, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
  desc: string;
}> = {
  paid_not_redeemed: {
    label: '已收费未核销',
    color: '#92400e',
    bg: '#fffbeb',
    border: '#f59e0b',
    icon: <ExclamationCircleOutlined />,
    desc: '收款系统有记录，但核销流水缺失。可能为未到店、预约未执行、或核销系统漏登。'
  },
  redeemed_not_paid: {
    label: '已核销未收费',
    color: '#991b1b',
    bg: '#fef2f2',
    border: '#ef4444',
    icon: <WarningOutlined />,
    desc: '服务已核销但未见对应收款。需要核实是否漏单、走赠送流程、或数据遗漏。'
  },
  duplicate_redemption: {
    label: '疑似重复核销',
    color: '#6b21a8',
    bg: '#faf5ff',
    border: '#a855f7',
    icon: <DoubleRightOutlined />,
    desc: '同一券号当日出现多次核销，需结合当日实际服务记录确认操作真实性。'
  },
  amount_mismatch: {
    label: '金额不一致',
    color: '#9a3412',
    bg: '#fff7ed',
    border: '#f97316',
    icon: <InfoCircleOutlined />,
    desc: '核销单价与收费折算单价不符，需核查活动折扣、手工改价或操作失误。'
  }
};

const statusColorMap = {
  pending: { color: 'warning', label: '待处理', icon: <ClockCircleOutlined /> },
  processing: { color: 'processing', label: '处理中', icon: <InfoCircleOutlined /> },
  resolved: { color: 'success', label: '已解决', icon: <CheckOutlined /> }
};

const DiscrepancyPage: React.FC = () => {
  const {
    businessDate, discrepancies, setDiscrepancies,
    paymentOrders, redemptions, coupons, addAudit,
    persistAll, setBusinessDate
  } = useApp();
  const { message, modal } = App.useApp();
  const [typeFilter, setTypeFilter] = useState<DiscrepancyType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [recordDate, setRecordDate] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DiscrepancyRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();

  const filtered = useMemo(() => {
    return discrepancies.filter(d => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (statusFilter !== 'all' && d.handleStatus !== statusFilter) return false;
      if (recordDate && d.date !== recordDate) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        const hay = `${d.customerName}${d.couponNo || ''}${d.projectName || ''}${d.relatedOrderNo || ''}${d.relatedRedemptionNo || ''}${d.description}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    }).sort((a, b) => {
      const sRank = { pending: 0, processing: 1, resolved: 2 };
      if (sRank[a.handleStatus] !== sRank[b.handleStatus]) return sRank[a.handleStatus] - sRank[b.handleStatus];
      return b.date.localeCompare(a.date);
    });
  }, [discrepancies, typeFilter, statusFilter, recordDate, keyword]);

  const stats = useMemo(() => {
    const out = { total: 0, pending: 0, processing: 0, resolved: 0 } as any;
    (Object.keys(typeMeta) as DiscrepancyType[]).forEach(t => out[t] = 0);
    out.total = discrepancies.length;
    discrepancies.forEach(d => {
      out[d.handleStatus] = (out[d.handleStatus] || 0) + 1;
      out[d.type] = (out[d.type] || 0) + 1;
    });
    out.totalAmount = discrepancies.reduce((s, d) => s + Math.abs(d.diffAmount), 0);
    return out;
  }, [discrepancies]);

  const reopen = () => {
    if (paymentOrders.length === 0 || redemptions.length === 0) {
      message.warning('请先导入收款单和核销流水');
      return;
    }
    modal.confirm({
      title: '重新生成差异核对清单',
      content: '将根据最新的收款单与核销流水重新识别差异，已填写的处理意见不会丢失。',
      okText: '确认重新生成',
      cancelText: '取消',
      onOk: () => {
        const existingMap = new Map(discrepancies.map(d => [
          `${d.type}|${d.couponNo || ''}|${d.customerId}|${d.projectName || ''}`,
          d
        ]));
        import('@/utils/mockData').then(({ generateDiscrepancies }) => {
          const newDiscs = generateDiscrepancies(paymentOrders, redemptions, coupons, businessDate);
          const merged = newDiscs.map(nd => {
            const key = `${nd.type}|${nd.couponNo || ''}|${nd.customerId}|${nd.projectName || ''}`;
            const old = existingMap.get(key);
            if (old) {
              return {
                ...nd,
                id: old.id,
                handler: old.handler,
                handleOpinion: old.handleOpinion,
                handleStatus: old.handleStatus,
                handleTime: old.handleTime
              };
            }
            return nd;
          });
          setDiscrepancies(merged);
          addAudit({
            module: 'discrepancy',
            action: 'regenerate',
            operator: '财务员',
            targetId: businessDate,
            beforeData: { count: discrepancies.length },
            afterData: { count: merged.length },
            remark: '重新生成差异清单'
          });
          message.success(`共识别 ${merged.length} 条差异`);
        });
      }
    });
  };

  const openDetail = (rec: DiscrepancyRecord) => {
    setSelectedRecord(rec);
    setDrawerOpen(true);
  };

  const openEdit = (rec: DiscrepancyRecord) => {
    setSelectedRecord(rec);
    form.setFieldsValue({
      handler: rec.handler || '财务员',
      handleStatus: rec.handleStatus,
      handleOpinion: rec.handleOpinion || ''
    });
    setEditOpen(true);
  };

  const submitEdit = async (values: any) => {
    if (!selectedRecord) return;
    const before = { ...selectedRecord };
    const updated = {
      ...selectedRecord,
      handler: values.handler,
      handleStatus: values.handleStatus,
      handleOpinion: values.handleOpinion,
      handleTime: new Date().toISOString()
    };
    const list = discrepancies.map(d => d.id === updated.id ? updated : d);
    setDiscrepancies(list);
    addAudit({
      module: 'discrepancy',
      action: 'update',
      operator: '财务员',
      targetId: updated.id,
      beforeData: before,
      afterData: updated,
      remark: '更新差异处理状态为 ' + (statusColorMap as any)[values.handleStatus].label
    });
    await persistAll();
    setEditOpen(false);
    message.success('处理意见已保存');
  };

  const batchMarkResolved = () => {
    const pending = filtered.filter(d => d.handleStatus === 'pending' || d.handleStatus === 'processing');
    if (pending.length === 0) {
      message.info('当前筛选结果中没有待处理的差异');
      return;
    }
    modal.confirm({
      title: `批量标记 ${pending.length} 条差异为已解决？`,
      content: '请确认这些差异已经核对完毕并有相应的处理记录。',
      okText: '确认批量处理',
      onOk: async () => {
        const now = new Date().toISOString();
        const list = discrepancies.map(d => {
          if (pending.find(p => p.id === d.id)) {
            return {
              ...d,
              handleStatus: 'resolved' as const,
              handler: d.handler || '财务员',
              handleOpinion: d.handleOpinion || '批量标记：核对无误',
              handleTime: now
            };
          }
          return d;
        });
        setDiscrepancies(list);
        addAudit({
          module: 'discrepancy',
          action: 'batch_resolve',
          operator: '财务员',
          targetId: `batch-${Date.now()}`,
          afterData: { count: pending.length },
          remark: '批量标记差异已解决'
        });
        await persistAll();
        message.success(`已标记 ${pending.length} 条差异为已解决`);
      }
    });
  };

  const relatedPayments = selectedRecord
    ? paymentOrders.filter(o => selectedRecord.relatedIds.includes(o.id) || (selectedRecord.couponNo && o.couponNo === selectedRecord.couponNo))
    : [];
  const relatedRedemptions = selectedRecord
    ? redemptions.filter(r => selectedRecord.relatedIds.includes(r.id) || (selectedRecord.couponNo && r.couponNo === selectedRecord.couponNo))
    : [];
  const relatedCoupon = selectedRecord?.couponNo
    ? coupons.find(c => c.couponNo === selectedRecord.couponNo)
    : null;

  const columns = [
    {
      title: '状态', dataIndex: 'handleStatus', width: 90, fixed: 'left' as const,
      render: (v: any) => {
        const s = statusColorMap[v as keyof typeof statusColorMap];
        return <Tag color={s.color} icon={s.icon}>{s.label}</Tag>;
      }
    },
    {
      title: '差异类型', dataIndex: 'type', width: 130,
      render: (v: DiscrepancyType) => {
        const t = typeMeta[v];
        return (
          <Tag color={t.border} icon={t.icon} style={{ border: `1px solid ${t.border}40`, background: t.bg, color: t.color }}>
            {t.label}
          </Tag>
        );
      }
    },
    { title: '日期', dataIndex: 'date', width: 105 },
    { title: '顾客', dataIndex: 'customerName', width: 110 },
    { title: '券号', dataIndex: 'couponNo', width: 120, render: (v: string) => v ? <span className="tag-pro">{v}</span> : '—' },
    { title: '项目', dataIndex: 'projectName', width: 140, ellipsis: true },
    {
      title: '差异金额', dataIndex: 'diffAmount', width: 110, align: 'right' as const,
      render: (v: number, r: DiscrepancyRecord) => (
        <span className={v > 0 ? 'amount-negative' : 'amount-positive'}>
          {v > 0 ? '+' : ''}¥{v.toFixed(2)}
        </span>
      )
    },
    { title: '处理人', dataIndex: 'handler', width: 80, render: (v: string) => v || '—' },
    { title: '处理时间', dataIndex: 'handleTime', width: 150, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—' },
    {
      title: '操作', key: 'op', width: 150, fixed: 'right' as const,
      render: (_: any, r: DiscrepancyRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => openDetail(r)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>处理</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">差异核对</h1>
          <p className="page-desc">
            自动识别四类差异：已收费未核销、已核销未收费、重复核销、金额不一致；可逐条填写处理意见并保留审核痕迹。
          </p>
        </div>
        <Space size={12}>
          <Button size="large" icon={<DeleteRowOutlined />} onClick={batchMarkResolved}>批量标记已解决</Button>
          <Button size="large" icon={<ReloadOutlined />} onClick={reopen} type="primary" danger>
            重新识别差异
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={5}>
          <Card bordered style={{ borderRadius: 8, borderLeft: `4px solid ${typeMeta.paid_not_redeemed.border}` }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">{typeMeta.paid_not_redeemed.icon} 已收费未核销</div>
            <div className="stat-card-value" style={{ color: typeMeta.paid_not_redeemed.color }}>
              {stats.paid_not_redeemed || 0}<span className="stat-card-unit">条</span>
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered style={{ borderRadius: 8, borderLeft: `4px solid ${typeMeta.redeemed_not_paid.border}` }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">{typeMeta.redeemed_not_paid.icon} 已核销未收费</div>
            <div className="stat-card-value" style={{ color: typeMeta.redeemed_not_paid.color }}>
              {stats.redeemed_not_paid || 0}<span className="stat-card-unit">条</span>
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8, borderLeft: `4px solid ${typeMeta.duplicate_redemption.border}` }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">{typeMeta.duplicate_redemption.icon} 重复核销</div>
            <div className="stat-card-value" style={{ color: typeMeta.duplicate_redemption.color }}>
              {stats.duplicate_redemption || 0}<span className="stat-card-unit">条</span>
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered style={{ borderRadius: 8, borderLeft: `4px solid ${typeMeta.amount_mismatch.border}` }} bodyStyle={{ padding: 16 }}>
            <div className="stat-card-label">{typeMeta.amount_mismatch.icon} 金额不一致</div>
            <div className="stat-card-value" style={{ color: typeMeta.amount_mismatch.color }}>
              {stats.amount_mismatch || 0}<span className="stat-card-unit">条</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
            <Row gutter={12}>
              <Col span={12}>
                <div className="stat-card-label">差异总数 / 金额</div>
                <div className="stat-card-value">{stats.total}<span className="stat-card-unit">条</span></div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  涉及 <span className="amount-negative">¥{stats.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                </div>
              </Col>
              <Col span={12}>
                <div className="stat-card-label">处理进度</div>
                <Progress
                  percent={stats.total > 0 ? Math.round((stats.resolved || 0) / stats.total * 100) : 100}
                  size="small"
                  style={{ marginTop: 12 }}
                  strokeColor="#16a34a"
                />
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  已解决 {stats.resolved || 0} · 待处理 {stats.pending || 0}
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <div className="filter-section">
        <Row gutter={[12, 12]} align="middle">
          <Col span={3}>
            <DatePicker
              style={{ width: '100%' }}
              value={recordDate ? dayjs(recordDate) : null}
              placeholder="差异日期"
              allowClear
              onChange={(d) => setRecordDate(d ? d.format('YYYY-MM-DD') : null)}
            />
          </Col>
          <Col span={3}>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="差异类型"
              value={typeFilter === 'all' ? undefined : typeFilter}
              onChange={(v) => setTypeFilter(v || 'all')}
              options={(Object.keys(typeMeta) as DiscrepancyType[]).map(t => ({
                value: t, label: typeMeta[t].label
              }))}
            />
          </Col>
          <Col span={3}>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="处理状态"
              value={statusFilter === 'all' ? undefined : statusFilter}
              onChange={(v) => setStatusFilter(v || 'all')}
              options={[
                { value: 'pending', label: '待处理' },
                { value: 'processing', label: '处理中' },
                { value: 'resolved', label: '已解决' }
              ]}
            />
          </Col>
          <Col span={8}>
            <Input
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              placeholder="搜索 顾客 / 券号 / 项目 / 订单号 / 核销单号"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={7} style={{ textAlign: 'right' }}>
            <Button
              onClick={() => { setKeyword(''); setTypeFilter('all'); setStatusFilter('all'); setRecordDate(null); }}
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
          scroll={{ x: 1300, y: 560 }}
          rowClassName={(r: any) => r.handleStatus === 'resolved' ? 'table-row-dim' : ''}
          expandable={{
            expandedRowRender: (r: DiscrepancyRecord) => (
              <div style={{ padding: '8px 16px', background: '#f9fafb', borderRadius: 6 }}>
                <Alert
                  type="info"
                  showIcon
                  message={typeMeta[r.type].label}
                  description={
                    <div>
                      <Paragraph style={{ margin: '0 0 8px' }}>{r.description}</Paragraph>
                      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 20 }}>
                        <span>涉及收款：{r.paidAmount != null ? `¥${r.paidAmount.toFixed(2)}` : '—'}</span>
                        <span>涉及核销：{r.redeemedAmount != null ? `¥${r.redeemedAmount.toFixed(2)}` : '—'}</span>
                        <span>处理人：{r.handler || '未分配'}</span>
                        <span>处理意见：{r.handleOpinion || '（未填写）'}</span>
                      </div>
                    </div>
                  }
                  style={{ border: 0, padding: 0, background: 'transparent' }}
                />
              </div>
            ),
            rowExpandable: () => true
          }}
          pagination={{
            pageSize: 12,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条差异，当前筛选 ${filtered.length} 条`
          }}
          onRow={(r: DiscrepancyRecord) => ({ onDoubleClick: () => openDetail(r) })}
        />
      </Card>

      <Drawer
        title="差异详情"
        width={780}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Space><Button onClick={() => selectedRecord && openEdit(selectedRecord)} icon={<EditOutlined />}>填写处理意见</Button><Button onClick={() => setDrawerOpen(false)}>关闭</Button></Space>}
      >
        {selectedRecord && (
          <>
            <div className={`discrepancy-card discrepancy-${selectedRecord.type}`}>
              <Row justify="space-between" style={{ marginBottom: 10 }}>
                <Space size={10}>
                  <Tag color={typeMeta[selectedRecord.type].border} icon={typeMeta[selectedRecord.type].icon} style={{ fontSize: 13, padding: '3px 10px' }}>
                    {typeMeta[selectedRecord.type].label}
                  </Tag>
                  <Tag color={statusColorMap[selectedRecord.handleStatus].color}>
                    {statusColorMap[selectedRecord.handleStatus].label}
                  </Tag>
                </Space>
                <Text type="secondary">{selectedRecord.date}</Text>
              </Row>
              <Title level={5} style={{ margin: '0 0 6px' }}>{selectedRecord.description}</Title>
              <Row gutter={[24, 8]} style={{ fontSize: 13, color: '#374151' }}>
                <Col span={8}>顾客：<Text strong>{selectedRecord.customerName}</Text></Col>
                <Col span={8}>券号：{selectedRecord.couponNo ? <span className="tag-pro">{selectedRecord.couponNo}</span> : '—'}</Col>
                <Col span={8}>项目：{selectedRecord.projectName || '—'}</Col>
                <Col span={8}>
                  收款金额：{selectedRecord.paidAmount != null ? <span className="amount-neutral">¥{selectedRecord.paidAmount.toFixed(2)}</span> : '—'}
                </Col>
                <Col span={8}>
                  核销金额：{selectedRecord.redeemedAmount != null ? <span className="amount-positive">¥{selectedRecord.redeemedAmount.toFixed(2)}</span> : '—'}
                </Col>
                <Col span={8}>
                  差异：<span className={selectedRecord.diffAmount > 0 ? 'amount-negative' : 'amount-positive'}>
                    {selectedRecord.diffAmount > 0 ? '+' : ''}¥{selectedRecord.diffAmount.toFixed(2)}
                  </span>
                </Col>
              </Row>
              <Divider style={{ margin: '14px 0' }} />
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {typeMeta[selectedRecord.type].desc}
              </div>
            </div>

            {relatedCoupon && (
              <>
                <div className="section-title" style={{ marginTop: 20 }}>关联卡券</div>
                <Card size="small" style={{ borderRadius: 8 }}>
                  <Descriptions column={3} size="small">
                    <Descriptions.Item label="券号"><span className="tag-pro">{relatedCoupon.couponNo}</span></Descriptions.Item>
                    <Descriptions.Item label="卡券名称">{relatedCoupon.couponName}</Descriptions.Item>
                    <Descriptions.Item label="状态">{relatedCoupon.status}</Descriptions.Item>
                    <Descriptions.Item label="总次数">{relatedCoupon.totalCount}</Descriptions.Item>
                    <Descriptions.Item label="已用">{relatedCoupon.usedCount}</Descriptions.Item>
                    <Descriptions.Item label="剩余">{relatedCoupon.totalCount - relatedCoupon.usedCount}</Descriptions.Item>
                    <Descriptions.Item label="单次价">¥{relatedCoupon.unitPrice.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="总金额">¥{relatedCoupon.totalAmount.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="售卖门店">{relatedCoupon.soldStore}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            )}

            {relatedPayments.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 20 }}>关联收款单（{relatedPayments.length} 条）</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={relatedPayments.map(p => ({ ...p, key: p.id }))}
                  columns={[
                    { title: '订单号', dataIndex: 'orderNo', render: (v) => <span className="tag-pro">{v}</span> },
                    { title: '日期', dataIndex: 'date', width: 110 },
                    { title: '项目', dataIndex: 'projectName', width: 140 },
                    { title: '应收', dataIndex: 'totalAmount', align: 'right', render: (v) => `¥${v.toFixed(2)}` },
                    { title: '实收', dataIndex: 'paidAmount', align: 'right', render: (v) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
                    { title: '支付方式', dataIndex: 'payMethod', width: 100 },
                    { title: '门店', dataIndex: 'salesStore', width: 110 }
                  ]}
                />
              </>
            )}

            {relatedRedemptions.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 20 }}>关联核销流水（{relatedRedemptions.length} 条）</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={relatedRedemptions.map(r => ({ ...r, key: r.id }))}
                  columns={[
                    { title: '核销单号', dataIndex: 'redemptionNo', render: (v) => <span className="tag-pro">{v}</span> },
                    { title: '时间', dataIndex: 'date', width: 150, render: (_: any, r: any) => `${r.date} ${r.time}` },
                    { title: '项目', dataIndex: 'projectName', width: 140 },
                    { title: '次数', dataIndex: 'redemptionCount', width: 60, align: 'center' },
                    { title: '金额', dataIndex: 'amount', align: 'right', render: (v) => <span className="amount-positive">¥{v.toFixed(2)}</span> },
                    { title: '服务门店', dataIndex: 'serviceStore', width: 110 },
                    { title: '医生', dataIndex: 'doctor', width: 90 }
                  ]}
                />
              </>
            )}

            {selectedRecord.handleOpinion && (
              <>
                <div className="section-title" style={{ marginTop: 20 }}>处理记录</div>
                <Card size="small" style={{ borderRadius: 8, background: selectedRecord.handleStatus === 'resolved' ? '#f0fdf4' : '#fffbeb' }}>
                  <Row gutter={[16, 4]} style={{ fontSize: 12 }}>
                    <Col span={6}>处理人：<Text strong>{selectedRecord.handler || '—'}</Text></Col>
                    <Col span={8}>状态：<Tag color={statusColorMap[selectedRecord.handleStatus].color}>{statusColorMap[selectedRecord.handleStatus].label}</Tag></Col>
                    <Col span={10}>时间：{selectedRecord.handleTime ? dayjs(selectedRecord.handleTime).format('YYYY-MM-DD HH:mm:ss') : '—'}</Col>
                    <Col span={24}>意见：<Paragraph style={{ margin: '4px 0 0' }}>{selectedRecord.handleOpinion}</Paragraph></Col>
                  </Row>
                </Card>
              </>
            )}
          </>
        )}
      </Drawer>

      <Modal
        title="填写处理意见"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => form.submit()}
        okText="保存处理意见"
        width={560}
      >
        {selectedRecord && (
          <div style={{ marginBottom: 16 }}>
            <Alert
              showIcon
              type="warning"
              icon={typeMeta[selectedRecord.type].icon}
              message={typeMeta[selectedRecord.type].label}
              description={
                <div style={{ fontSize: 12 }}>
                  <div>顾客：{selectedRecord.customerName} · 券号：{selectedRecord.couponNo || '—'}</div>
                  <div>涉及差异：<span className={selectedRecord.diffAmount > 0 ? 'amount-negative' : 'amount-positive'}>¥{Math.abs(selectedRecord.diffAmount).toFixed(2)}</span></div>
                </div>
              }
            />
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={submitEdit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="处理人" name="handler" rules={[{ required: true, message: '请填写处理人' }]}>
                <Input placeholder="请输入处理人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="处理状态" name="handleStatus" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="pending">待处理</Radio>
                  <Radio value="processing">处理中</Radio>
                  <Radio value="resolved">已解决</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="处理意见" name="handleOpinion" rules={[{ required: true, message: '请填写处理意见说明' }]}>
            <TextArea
              rows={5}
              placeholder="请详细说明差异原因、核查过程、处理方式、涉及人员等信息，以便后续审计追溯"
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DiscrepancyPage;
