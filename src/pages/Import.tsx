import React, { useState, useRef, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Button,
  Upload,
  Table,
  Space,
  Tabs,
  Tag,
  App,
  Typography,
  Divider,
  Alert,
  Progress,
  Tooltip,
  Statistic
} from 'antd';
import {
  UploadOutlined,
  InboxOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  FileExcelOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useApp } from '@/App';
import type { PaymentOrder, Coupon, RedemptionRecord } from '@/types';
import { genId } from '@/store';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

type ImportType = 'payment' | 'coupon' | 'redemption';

interface PendingImport {
  type: ImportType;
  fileName: string;
  rows: any[];
  importedAt: string;
}

const typeMeta: Record<ImportType, {
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  sampleColumns: string[];
}> = {
  payment: {
    title: '当日收款单',
    desc: '来源：收银系统导出（支持POS、门店管理系统、美团/点评后台）',
    icon: <UploadOutlined />,
    color: '#1f4e79',
    sampleColumns: ['订单号', '日期', '顾客姓名', '手机号', '项目名称', '项目类别', '应收金额', '实收金额', '支付方式', '券号', '咨询师', '门店', '来源类型']
  },
  coupon: {
    title: '卡券发放表',
    desc: '来源：卡券系统 / 咨询师台账导出',
    icon: <FileExcelOutlined />,
    color: '#059669',
    sampleColumns: ['券号', '卡券名称', '顾客姓名', '手机号', '项目名称', '类别', '总次数', '已用次数', '单次价格', '总金额', '售卖门店', '发放日期', '有效期起', '有效期止', '来源类型', '咨询师']
  },
  redemption: {
    title: '核销流水',
    desc: '来源：服务核销终端 / HIS 系统导出',
    icon: <CheckCircleOutlined />,
    color: '#d97706',
    sampleColumns: ['核销单号', '日期', '时间', '顾客姓名', '券号', '卡券名称', '项目名称', '类别', '核销次数', '单次价格', '核销金额', '服务门店', '售卖门店', '咨询师', '操作医生', '操作员']
  }
};

const formatMoney = (v: any) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s¥￥]/g, ''));
  return isNaN(n) ? 0 : Number(n.toFixed(2));
};
const cleanStr = (v: any) => (v === null || v === undefined ? '' : String(v).trim());

const ImportPage: React.FC = () => {
  const {
    businessDate,
    setBusinessDate,
    paymentOrders,
    setPaymentOrders,
    coupons,
    setCoupons,
    redemptions,
    setRedemptions,
    addAudit,
    persistAll,
    meta
  } = useApp();
  const { message, modal } = App.useApp();
  const [activeTab, setActiveTab] = useState<ImportType>('payment');
  const [pendingMap, setPendingMap] = useState<Record<ImportType, PendingImport | null>>({
    payment: null,
    coupon: null,
    redemption: null
  });

  const pendingCounts = useMemo(
    () => ({
      payment: pendingMap.payment?.rows.length || 0,
      coupon: pendingMap.coupon?.rows.length || 0,
      redemption: pendingMap.redemption?.rows.length || 0
    }),
    [pendingMap]
  );

  const totalPending = pendingCounts.payment + pendingCounts.coupon + pendingCounts.redemption;

  const readExcelFile = (file: File): Promise<any[]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const handleFileUpload = async (file: File, type: ImportType) => {
    try {
      const rows = await readExcelFile(file);
      if (rows.length === 0) {
        message.warning('文件为空或格式不正确');
        return false;
      }
      setPendingMap(prev => ({
        ...prev,
        [type]: {
          type,
          fileName: file.name,
          rows,
          importedAt: new Date().toLocaleTimeString('zh-CN')
        }
      }));
      message.success(`已读取 ${rows.length} 条数据，请预览确认后导入`);
      setActiveTab(type);
    } catch (err) {
      message.error('文件解析失败，请检查格式（支持 .xlsx/.xls/.csv）');
    }
    return false;
  };

  const previewColumns = (type: ImportType) => {
    const sample = pendingMap[type]?.rows[0] || {};
    const keys = Object.keys(sample);
    return [
      { title: '序号', dataIndex: 'idx', fixed: 'left' as const, width: 60 },
      ...keys.slice(0, 10).map(k => ({
        title: k,
        dataIndex: k,
        ellipsis: true,
        width: Math.max(100, String(k).length * 18)
      })),
      ...(keys.length > 10
        ? [{ title: `... 共 ${keys.length} 列`, dataIndex: '_more', width: 110, render: () => <Text type="secondary">更多列</Text> }]
        : [])
    ];
  };

  const previewData = (type: ImportType) =>
    (pendingMap[type]?.rows || []).slice(0, 50).map((r, i) => ({ ...r, idx: i + 1, key: i }));

  const convertPayment = (raw: any, idx: number): PaymentOrder => {
    const payDate = raw['日期'] || raw['date'] || raw['订单日期'] || businessDate;
    const sourceRaw = (raw['来源类型'] || raw['类型'] || '').toString();
    const sourceType: 'normal' | 'gift' | 'staff' =
      /赠送|赠券|gift/i.test(sourceRaw) ? 'gift'
      : /员工|福利|staff/i.test(sourceRaw) ? 'staff' : 'normal';
    const name = cleanStr(raw['顾客姓名'] || raw['姓名'] || raw['customer']);
    const phone = cleanStr(raw['手机号'] || raw['电话'] || raw['phone']);
    const customerId = 'C' + (phone || name || idx.toString()).replace(/\D/g, '').slice(-6) || `C${idx}`;
    return {
      id: genId('PO'),
      orderNo: cleanStr(raw['订单号'] || raw['order_no'] || raw['单号']) || `SK${Date.now()}${idx}`,
      date: dayjs(payDate).isValid() ? dayjs(payDate).format('YYYY-MM-DD') : businessDate,
      customerId,
      customerName: name,
      phone,
      totalAmount: formatMoney(raw['应收金额'] ?? raw['订单金额'] ?? raw['total']),
      paidAmount: formatMoney(raw['实收金额'] ?? raw['支付金额'] ?? raw['paid'] ?? raw['应收金额']),
      payMethod: cleanStr(raw['支付方式'] || raw['支付'] || raw['pay_method']) || '未指定',
      couponNo: cleanStr(raw['券号'] || raw['coupon_no'] || raw['卡号']),
      projectName: cleanStr(raw['项目名称'] || raw['项目'] || raw['project']),
      projectCategory: cleanStr(raw['项目类别'] || raw['类别'] || raw['category']) || '未分类',
      consultant: cleanStr(raw['咨询师'] || raw['顾问']) || pickMeta(meta.consultants, idx),
      salesStore: cleanStr(raw['门店'] || raw['售卖门店'] || raw['store']) || pickMeta(meta.stores, idx),
      sourceType,
      createdAt: `${businessDate} ${cleanStr(raw['时间']) || '00:00'}:00`
    };
  };

  const convertCoupon = (raw: any, idx: number): Coupon => {
    const totalCount = Math.max(1, Number(raw['总次数'] ?? raw['次数'] ?? raw['count'] ?? 1) | 0);
    const usedCount = Math.min(totalCount, Math.max(0, Number(raw['已用次数'] ?? raw['used'] ?? 0) | 0));
    const issueDate = raw['发放日期'] || raw['issue_date'] || businessDate;
    const validFrom = raw['有效期起'] || issueDate;
    const validTo = raw['有效期止'] || raw['valid_to'] || dayjs(issueDate).add(365, 'day').format('YYYY-MM-DD');
    const sourceRaw = (raw['来源类型'] || raw['类型'] || '').toString();
    const sourceType: 'normal' | 'gift' | 'staff' =
      /赠送|赠券|gift/i.test(sourceRaw) ? 'gift'
      : /员工|福利|staff/i.test(sourceRaw) ? 'staff' : 'normal';
    const name = cleanStr(raw['顾客姓名'] || raw['姓名']);
    const phone = cleanStr(raw['手机号'] || raw['电话']);
    const customerId = 'C' + (phone || name || idx.toString()).replace(/\D/g, '').slice(-6) || `C${idx}`;
    const unitPrice = formatMoney(raw['单次价格'] ?? raw['单价'] ?? raw['unit_price'] ?? 0);
    const totalAmount = formatMoney(raw['总金额'] ?? raw['amount'] ?? unitPrice * totalCount);
    return {
      id: genId('CP'),
      couponNo: cleanStr(raw['券号'] || raw['coupon_no']) || `KQ${Date.now()}${idx}`,
      couponName: cleanStr(raw['卡券名称'] || raw['名称']) || `${cleanStr(raw['项目名称']) || '项目'} ×${totalCount}次卡`,
      customerId,
      customerName: name,
      phone,
      projectName: cleanStr(raw['项目名称'] || raw['项目']),
      projectCategory: cleanStr(raw['项目类别'] || raw['类别']) || '未分类',
      totalCount,
      usedCount,
      unitPrice,
      totalAmount,
      soldStore: cleanStr(raw['售卖门店'] || raw['门店']) || pickMeta(meta.stores, idx),
      validFrom: dayjs(validFrom).isValid() ? dayjs(validFrom).format('YYYY-MM-DD') : issueDate,
      validTo: dayjs(validTo).isValid() ? dayjs(validTo).format('YYYY-MM-DD') : dayjs(issueDate).add(365, 'day').format('YYYY-MM-DD'),
      sourceType,
      issueDate: dayjs(issueDate).isValid() ? dayjs(issueDate).format('YYYY-MM-DD') : businessDate,
      consultant: cleanStr(raw['咨询师']) || pickMeta(meta.consultants, idx),
      status: usedCount >= totalCount ? 'used_up' : 'active'
    };
  };

  const convertRedemption = (raw: any, idx: number): RedemptionRecord => {
    const rDate = raw['日期'] || raw['date'] || businessDate;
    const name = cleanStr(raw['顾客姓名'] || raw['姓名']);
    const phone = cleanStr(raw['手机号'] || raw['电话']);
    const customerId = 'C' + (phone || name || idx.toString()).replace(/\D/g, '').slice(-6) || `C${idx}`;
    const rCount = Math.max(1, Number(raw['核销次数'] || raw['次数'] || 1) | 0);
    const unitPrice = formatMoney(raw['单次价格'] ?? raw['单价'] ?? 0);
    const amount = formatMoney(raw['核销金额'] ?? raw['金额'] ?? unitPrice * rCount);
    const soldStore = cleanStr(raw['售卖门店'] || raw['售出门店']) || pickMeta(meta.stores, idx);
    const serviceStore = cleanStr(raw['服务门店'] || raw['核销门店'] || raw['门店']) || soldStore;
    return {
      id: genId('RD'),
      redemptionNo: cleanStr(raw['核销单号'] || raw['单号']) || `HX${Date.now()}${idx}`,
      date: dayjs(rDate).isValid() ? dayjs(rDate).format('YYYY-MM-DD') : businessDate,
      time: cleanStr(raw['时间']) || `${String(9 + (idx % 10)).padStart(2, '0')}:${String(idx % 60).padStart(2, '0')}`,
      customerId,
      customerName: name,
      couponNo: cleanStr(raw['券号'] || raw['coupon_no']),
      couponName: cleanStr(raw['卡券名称'] || raw['名称']),
      projectName: cleanStr(raw['项目名称'] || raw['项目']),
      projectCategory: cleanStr(raw['项目类别'] || raw['类别']) || '未分类',
      redemptionCount: rCount,
      unitPrice,
      amount,
      serviceStore,
      soldStore,
      consultant: cleanStr(raw['咨询师']) || pickMeta(meta.consultants, idx),
      doctor: cleanStr(raw['操作医生'] || raw['医生']) || pickMeta(meta.doctors, idx),
      operator: cleanStr(raw['操作员'] || raw['前台']) || pickMeta(meta.consultants, idx),
      remark: cleanStr(raw['备注'])
    };
  };

  const pickMeta = (arr: string[], idx: number) => arr[idx % arr.length];

  const executeImport = (type: ImportType) => {
    const pending = pendingMap[type];
    if (!pending || pending.rows.length === 0) {
      message.warning('没有可导入的数据');
      return;
    }
    modal.confirm({
      title: `确认导入 ${typeMeta[type].title}`,
      content: (
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            文件 <Text strong>{pending.fileName}</Text> 共 <Text strong type="warning">{pending.rows.length}</Text> 条记录。
          </Paragraph>
          <Alert
            type="info"
            showIcon
            message={`将追加写入到营业日期 ${businessDate} 的对应数据表中。若存在同订单号/券号的记录，您可以选择在下一步进行去重合并。`}
          />
        </div>
      ),
      okText: '确认导入',
      cancelText: '取消',
      onOk: async () => {
        let converted: any[] = [];
        switch (type) {
          case 'payment':
            converted = pending.rows.map((r, i) => convertPayment(r, i));
            setPaymentOrders(prev => [...prev, ...converted]);
            break;
          case 'coupon':
            converted = pending.rows.map((r, i) => convertCoupon(r, i));
            setCoupons(prev => [...prev, ...converted]);
            break;
          case 'redemption':
            converted = pending.rows.map((r, i) => convertRedemption(r, i));
            setRedemptions(prev => [...prev, ...converted]);
            break;
        }
        addAudit({
          module: 'import',
          action: `import_${type}`,
          operator: '财务员',
          targetId: `${businessDate}-${pending.fileName}`,
          beforeData: null,
          afterData: { count: converted.length, fileName: pending.fileName },
          remark: `导入 ${typeMeta[type].title} ${converted.length} 条`
        });
        setPendingMap(prev => ({ ...prev, [type]: null }));
        await persistAll();
        message.success(`成功导入 ${converted.length} 条 ${typeMeta[type].title}`);
      }
    });
  };

  const clearPending = (type: ImportType) => {
    setPendingMap(prev => ({ ...prev, [type]: null }));
    message.info('已清除待导入数据');
  };

  const downloadTemplate = (type: ImportType) => {
    const cols = typeMeta[type].sampleColumns;
    const sample = [cols];
    for (let i = 0; i < 3; i++) {
      sample.push(cols.map(c => {
        if (/日期|发放|有效期/.test(c)) return businessDate;
        if (/金额|价格/.test(c)) return (500 + i * 100).toString();
        if (/次数/.test(c)) return (i + 1).toString();
        if (/姓名/.test(c)) return ['示例顾客A', '示例顾客B', '示例顾客C'][i];
        if (/手机/.test(c)) return '138' + (10000000 + i * 111).toString();
        if (/券号|订单号|核销单/.test(c)) return `DEMO${(i + 1).toString().padStart(6, '0')}`;
        if (/门店/.test(c)) return meta.stores[i % meta.stores.length];
        if (/咨询师/.test(c)) return meta.consultants[i % meta.consultants.length];
        if (/医生/.test(c)) return meta.doctors[i % meta.doctors.length];
        if (/项目类别/.test(c)) return meta.categories[i % meta.categories.length];
        if (/项目名称/.test(c)) return Object.values(meta.projectsByCategory)[i % 6][0];
        if (/支付方式/.test(c)) return meta.payMethods[i % meta.payMethods.length];
        if (/来源类型/.test(c)) return ['正常购买', '赠送券', '员工福利券'][i % 3];
        return '';
      }));
    }
    const ws = XLSX.utils.aoa_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, typeMeta[type].title);
    XLSX.writeFile(wb, `${typeMeta[type].title}-导入模板.xlsx`);
    message.success(`已下载 ${typeMeta[type].title} 模板`);
  };

  const StatCard = ({ type }: { type: ImportType }) => {
    const counts = {
      payment: paymentOrders.filter(o => o.date === businessDate).length,
      coupon: coupons.filter(c => c.issueDate === businessDate).length,
      redemption: redemptions.filter(r => r.date === businessDate).length
    };
    const amounts = {
      payment: paymentOrders.filter(o => o.date === businessDate).reduce((s, o) => s + o.paidAmount, 0),
      coupon: coupons.filter(c => c.issueDate === businessDate).reduce((s, c) => s + c.totalAmount, 0),
      redemption: redemptions.filter(r => r.date === businessDate).reduce((s, r) => s + r.amount, 0)
    };
    const t = typeMeta[type];
    return (
      <Card
        bordered
        style={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${t.color}14`, color: t.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20
          }}>
            {t.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{t.title}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {counts[type]}
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6, fontWeight: 400 }}>条</span>
            </div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
              ¥{amounts[type].toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        {pendingCounts[type] > 0 && (
          <div style={{
            marginTop: 12, padding: '6px 10px',
            background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6,
            fontSize: 12, color: '#9a3412', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>待导入：{pendingCounts[type]} 条</span>
            <Tag color="orange" style={{ margin: 0 }}>待确认</Tag>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">数据导入</h1>
          <p className="page-desc">
            导入收银系统的当日收款单、卡券系统的发放表、核销终端的服务流水，系统将自动关联核对。
          </p>
        </div>
        <Space size={12}>
          <DatePicker
            value={dayjs(businessDate)}
            onChange={(d) => d && setBusinessDate(d.format('YYYY-MM-DD'))}
            size="large"
            style={{ width: 160 }}
          />
          <Button size="large" icon={<ReloadOutlined />} onClick={() => message.success('数据已刷新')}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={8}><StatCard type="payment" /></Col>
        <Col span={8}><StatCard type="coupon" /></Col>
        <Col span={8}><StatCard type="redemption" /></Col>
      </Row>

      {totalPending > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={
            <Space>
              <span>有 <strong>{totalPending}</strong> 条数据待导入确认</span>
              {(['payment', 'coupon', 'redemption'] as ImportType[]).map(t =>
                pendingCounts[t] > 0 ? <Tag key={t} color="orange">{typeMeta[t].title}: {pendingCounts[t]}</Tag> : null
              )}
              <Button type="primary" size="small" onClick={() => {
                (['payment', 'coupon', 'redemption'] as ImportType[]).forEach(t => {
                  if (pendingCounts[t] > 0) executeImport(t);
                });
              }}>
                一键确认全部
              </Button>
            </Space>
          }
        />
      )}

      <Card
        bordered
        style={{ borderRadius: 8 }}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as ImportType)}
          size="large"
          items={(['payment', 'coupon', 'redemption'] as ImportType[]).map(type => {
            const t = typeMeta[type];
            return {
              key: type,
              label: (
                <span style={{ padding: '4px 8px' }}>
                  {t.icon} <span style={{ marginLeft: 6 }}>{t.title}</span>
                  {pendingCounts[type] > 0 && <BadgeDanger count={pendingCounts[type]} />}
                </span>
              ),
              children: (
                <div style={{ padding: '4px 24px 24px' }}>
                  <div style={{
                    padding: '16px 20px',
                    background: `${t.color}08`,
                    borderLeft: `3px solid ${t.color}`,
                    borderRadius: '0 6px 6px 0',
                    marginBottom: 20
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.color, marginBottom: 4 }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{t.desc}</div>
                  </div>

                  <Row gutter={[16, 16]}>
                    <Col span={pendingMap[type] ? 10 : 24}>
                      <Dragger
                        multiple={false}
                        accept=".xlsx,.xls,.csv"
                        showUploadList={false}
                        beforeUpload={(file) => handleFileUpload(file as File, type)}
                        style={{ padding: 24, background: pendingMap[type] ? '#f9fafb' : '#fff' }}
                      >
                        <p className="ant-upload-drag-icon" style={{ color: t.color }}>
                          <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">点击或拖拽 Excel / CSV 文件到此区域</p>
                        <p className="ant-upload-hint" style={{ fontSize: 12, color: '#9ca3af' }}>
                          支持 .xlsx、.xls、.csv 格式，首行为列名
                        </p>
                      </Dragger>

                      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                        <Button
                          icon={<DownloadOutlined />}
                          onClick={() => downloadTemplate(type)}
                        >
                          下载导入模板
                        </Button>
                        <Space>
                          {pendingMap[type] && (
                            <>
                              <Button
                                icon={<ClearOutlined />}
                                onClick={() => clearPending(type)}
                              >
                                清除
                              </Button>
                              <Button
                                type="primary"
                                icon={<UploadOutlined />}
                                onClick={() => executeImport(type)}
                              >
                                确认导入 ({pendingCounts[type]} 条)
                              </Button>
                            </>
                          )}
                        </Space>
                      </div>
                    </Col>

                    {pendingMap[type] && (
                      <Col span={14}>
                        <div style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          overflow: 'hidden',
                          height: 420,
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{
                            padding: '10px 16px',
                            background: '#f9fafb',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <Space size={8}>
                              <EyeOutlined style={{ color: '#374151' }} />
                              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                                数据预览 - {pendingMap[type]!.fileName}
                              </span>
                              <Tag color="blue">{pendingMap[type]!.importedAt}</Tag>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              显示前 50 行 / 共 {pendingMap[type]!.rows.length} 行
                            </Text>
                          </div>
                          <div style={{ flex: 1, overflow: 'auto' }}>
                            <Table
                              className="upload-preview-table"
                              size="small"
                              pagination={false}
                              columns={previewColumns(type)}
                              dataSource={previewData(type)}
                              scroll={{ x: 'max-content', y: 340 }}
                            />
                          </div>
                        </div>
                      </Col>
                    )}
                  </Row>

                  <Divider style={{ margin: '28px 0 16px' }}>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>字段映射说明</span>
                  </Divider>

                  <div style={{
                    padding: 14,
                    background: '#f9fafb',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#374151',
                    lineHeight: 1.9
                  }}>
                    <Text strong style={{ color: '#111827' }}>系统识别字段（中英文列名均可）：</Text>
                    <div style={{ marginTop: 6, columns: 2, columnGap: 32 }}>
                      {t.sampleColumns.map(c => (
                        <div key={c}>· {c}</div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e5e7eb', color: '#6b7280' }}>
                      注：来源类型中包含"赠送/赠券/gift"会标记为 <Tag color="green">赠送券</Tag>；
                      包含"员工/福利/staff"会标记为 <Tag color="purple">员工福利券</Tag>；其余默认为 <Tag>正常购买</Tag>。
                    </div>
                  </div>
                </div>
              )
            };
          })}
        />
      </Card>
    </div>
  );
};

const BadgeDanger: React.FC<{ count: number }> = ({ count }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20, height: 18,
    padding: '0 6px',
    marginLeft: 8,
    background: '#fee2e2', color: '#dc2626',
    fontSize: 11, fontWeight: 600,
    borderRadius: 9,
    fontVariantNumeric: 'tabular-nums'
  }}>
    {count}
  </span>
);

export default ImportPage;
