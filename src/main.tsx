import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

const theme = {
  token: {
    colorPrimary: '#1f4e79',
    colorInfo: '#1f4e79',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    borderRadius: 6,
    fontSize: 13,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    colorBgLayout: '#f0f2f5',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: '#e5e7eb',
    colorBorderSecondary: '#f0f0f0',
    colorText: '#1f2937',
    colorTextSecondary: '#6b7280',
    colorTextTertiary: '#9ca3af'
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#111827',
      bodyBg: '#f0f2f5',
      headerHeight: 56,
      triggerBg: '#111827',
      headerPadding: '0 24px',
      siderWidth: 220
    },
    Menu: {
      darkItemBg: '#111827',
      darkSubMenuItemBg: '#1f2937',
      darkItemSelectedBg: '#1f4e79',
      darkItemColor: '#d1d5db',
      darkItemSelectedColor: '#ffffff',
      darkItemHoverColor: '#ffffff',
      darkItemHoverBg: '#1f2937',
      itemHeight: 44
    },
    Table: {
      headerBg: '#f9fafb',
      headerColor: '#374151',
      headerSplitColor: '#e5e7eb',
      cellPaddingBlock: 10,
      cellPaddingInline: 14,
      fontSize: 13,
      rowHoverBg: '#f5f7fa',
      borderColor: '#e5e7eb'
    },
    Card: {
      headerBg: '#ffffff',
      headerBorderRadius: 6,
      boxShadowTertiary: '0 1px 2px rgba(0,0,0,0.04)'
    },
    Button: {
      controlHeight: 34,
      controlHeightSM: 28,
      controlHeightLG: 40,
      fontWeight: 500
    }
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntdApp>
        <HashRouter>
          <App />
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);
