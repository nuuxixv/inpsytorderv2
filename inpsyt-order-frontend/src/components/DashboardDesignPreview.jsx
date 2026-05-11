import React, { useState } from 'react';
import {
  Box, Typography, Button, FormControl, InputLabel, Select, MenuItem, Chip,
  ToggleButton, ToggleButtonGroup, Tooltip, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  MenuBook as BookIcon,
  Psychology as TestIcon,
  ShoppingCart as CartIcon,
  Receipt as ReceiptIcon,
  Dashboard as DashboardIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalShipping as ShippingIcon,
  Assignment as ReportIcon,
  History as HistoryIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatCard, StatusChip } from './ui';
import PreviewShell from './preview/PreviewShell';
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

/**
 * DEV-ONLY keystone: /preview/dashboard.
 * 목데이터 + PreviewShell (사이드바/헤더) — 인증/Supabase 없이 시안 확인용.
 * 실제 데이터 흐름은 DashboardPage.jsx 참고.
 */

const MOCK = {
  eventName: '2026년 한국심리학회 연차학술대회',
  totalRevenue: 42380000,
  testRevenue: 28650000,
  bookRevenue: 12250000,
  shippingRevenue: 1480000,
  yoyPct: 18,
  totalOrders: 324,
  todayOrdersCount: 47,
  statusCounts: { pending: 18, paid: 54, completed: 238, cancelled: 9, refunded: 5 },
  testTop: [
    { product_id: 't1', name: 'MMPI-2 전산채점 사용권', totalQuantity: 142, totalAmount: 4260000 },
    { product_id: 't2', name: 'K-WAIS-IV 지능검사 프로토콜', totalQuantity: 98, totalAmount: 3920000 },
    { product_id: 't3', name: 'MBTI Form M 자가채점', totalQuantity: 76, totalAmount: 2280000 },
    { product_id: 't4', name: 'K-WISC-V 지능검사 기록용지', totalQuantity: 61, totalAmount: 1830000 },
    { product_id: 't5', name: 'PAI 성격평가질문지', totalQuantity: 48, totalAmount: 1920000 },
    { product_id: 't6', name: 'TCI 기질 및 성격검사', totalQuantity: 42, totalAmount: 1260000 },
    { product_id: 't7', name: 'BGT 벤더게슈탈트검사', totalQuantity: 36, totalAmount: 1080000 },
    { product_id: 't8', name: 'SCT 문장완성검사', totalQuantity: 28, totalAmount: 560000 },
    { product_id: 't9', name: 'HTP 집-나무-사람 검사', totalQuantity: 22, totalAmount: 660000 },
  ],
  bookTop: [
    { product_id: 'b1', name: '심리평가의 임상적 활용', totalQuantity: 86, totalAmount: 2580000 },
    { product_id: 'b2', name: 'DSM-5-TR 정신질환의 진단 및 통계편람', totalQuantity: 64, totalAmount: 3840000 },
    { product_id: 'b3', name: '아동·청소년 심리치료', totalQuantity: 51, totalAmount: 1530000 },
    { product_id: 'b4', name: 'MMPI-2 해석상담', totalQuantity: 42, totalAmount: 1260000 },
    { product_id: 'b5', name: '로샤 종합체계 워크북', totalQuantity: 38, totalAmount: 1520000 },
    { product_id: 'b6', name: '인지행동치료의 실제', totalQuantity: 31, totalAmount: 930000 },
    { product_id: 'b7', name: '발달심리학 교과서', totalQuantity: 24, totalAmount: 960000 },
  ],
  recentOrders: [
    { id: '1', customer_name: '김현수', status: 'paid', final_payment: 245000, created_at: '2026-04-20T10:24:00' },
    { id: '2', customer_name: '이정민', status: 'pending', final_payment: 89000, created_at: '2026-04-20T10:18:00' },
    { id: '3', customer_name: '박지훈', status: 'completed', final_payment: 412000, created_at: '2026-04-20T09:55:00' },
    { id: '4', customer_name: '최서연', status: 'completed', final_payment: 178000, created_at: '2026-04-20T09:42:00' },
    { id: '5', customer_name: '정다은', status: 'refunded', final_payment: 64000, created_at: '2026-04-20T09:30:00' },
  ],
};

const StatusBar = ({ statusCounts, totalOrders, onStatusClick }) => {
  const theme = useTheme();
  const orderedStatuses = ['pending', 'paid', 'completed', 'cancelled', 'refunded'];
  const segments = orderedStatuses
    .filter(s => (statusCounts[s] || 0) > 0)
    .map(s => ({ key: s, count: statusCounts[s], pct: (statusCounts[s] / totalOrders) * 100 }));
  return (
    <Box>
      <Box sx={{ display: 'flex', width: '100%', borderRadius: `${theme.radii.sm}px`, overflow: 'hidden', height: 10, bgcolor: theme.gray[100] }}>
        {segments.map(seg => (
          <Tooltip key={seg.key} title={`${STATUS_TO_KOREAN[seg.key]} · ${seg.count}건 · ${seg.pct.toFixed(1)}%`} arrow>
            <Box onClick={() => onStatusClick?.(seg.key)} sx={{ flex: seg.count, bgcolor: theme.status[seg.key], minWidth: 6, cursor: 'pointer', transition: 'opacity 0.2s', '&:hover': { opacity: 0.85 } }} />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 2 }}>
        {segments.map(seg => (
          <Box key={seg.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', px: 1.25, py: 0.75, borderRadius: `${theme.radii.sm}px`, bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}`, '&:hover': { bgcolor: alpha(theme.status[seg.key], 0.06), borderColor: alpha(theme.status[seg.key], 0.3) } }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.status[seg.key] }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>{STATUS_TO_KOREAN[seg.key]}</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 800, letterSpacing: '-0.01em' }}>{seg.count}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const RankingList = ({ items, color }) => {
  const theme = useTheme();
  const [sortBy, setSortBy] = useState('quantity');
  const [expanded, setExpanded] = useState(false);
  const sorted = [...items].sort((a, b) => sortBy === 'amount' ? (b.totalAmount - a.totalAmount) : (b.totalQuantity - a.totalQuantity));
  const displayed = expanded ? sorted : sorted.slice(0, 5);
  const hasMore = sorted.length > 5;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <ToggleButtonGroup size="small" value={sortBy} exclusive onChange={(_, v) => v && setSortBy(v)} sx={{
          '& .MuiToggleButton-root': {
            px: 1.25, py: 0.375, fontSize: '0.75rem', fontWeight: 700, border: `1px solid ${theme.gray[200]}`, color: 'text.secondary', borderRadius: `${theme.radii.sm}px !important`,
            '&.Mui-selected': { bgcolor: alpha(color, 0.1), color, borderColor: alpha(color, 0.3) },
            '&:first-of-type': { mr: 0.5 },
          },
        }}>
          <ToggleButton value="quantity">수량순</ToggleButton>
          <ToggleButton value="amount">금액순</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box>
        {displayed.map((item, i) => {
          const isTop3 = i < 3;
          return (
            <Box key={item.product_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: i === displayed.length - 1 ? 'none' : `1px solid ${theme.gray[100]}` }}>
              <Box sx={{ width: 24, height: 24, flexShrink: 0, borderRadius: `${theme.radii.sm}px`, bgcolor: isTop3 ? alpha(color, 0.1) : theme.gray[50], color: isTop3 ? color : theme.gray[500], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                {i + 1}
              </Box>
              <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: isTop3 ? 700 : 500, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, color: isTop3 ? color : 'text.primary', letterSpacing: '-0.02em', fontFeatureSettings: '"tnum" 1' }}>
                  {sortBy === 'amount' ? `${item.totalAmount.toLocaleString()}원` : `${item.totalQuantity}부`}
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
                  {sortBy === 'amount' ? `${item.totalQuantity}부` : `${item.totalAmount.toLocaleString()}원`}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {hasMore && (
        <Box sx={{ mt: 1.5, pt: 1.25, borderTop: `1px solid ${theme.gray[100]}`, display: 'flex', justifyContent: 'center' }}>
          <Button
            size="small"
            onClick={() => setExpanded(e => !e)}
            endIcon={expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'text.secondary',
              '&:hover': { bgcolor: alpha(color, 0.06), color },
            }}
          >
            {expanded ? '접기' : `전체 보기 (${sorted.length})`}
          </Button>
        </Box>
      )}
    </Box>
  );
};

const DashboardDesignPreview = () => {
  const theme = useTheme();
  const data = MOCK;

  return (
    <PreviewShell activePath="/admin/dashboard">
      <PageHeader
        title="대시보드"
        subtitle={data.eventName}
        icon={DashboardIcon}
        action={
          <Button size="small" variant="outlined" startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}>
            새로고침
          </Button>
        }
      />

      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', gap: 1.25, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' } }}>
          <FormControl fullWidth size="small">
            <InputLabel>연도</InputLabel>
            <Select value="2026" label="연도"><MenuItem value="2026">2026년</MenuItem></Select>
          </FormControl>
          <ChevronRightIcon sx={{ color: 'text.disabled', flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
          <FormControl fullWidth size="small">
            <InputLabel>학회</InputLabel>
            <Select value="한국심리학회" label="학회"><MenuItem value="한국심리학회">한국심리학회</MenuItem></Select>
          </FormControl>
          <ChevronRightIcon sx={{ color: 'text.disabled', flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
          <FormControl fullWidth size="small">
            <InputLabel>상세 행사</InputLabel>
            <Select value="all" label="상세 행사"><MenuItem value="all">전체 합산</MenuItem></Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>일자</Typography>
          <Chip label="전체" size="small" color="primary" sx={{ fontWeight: 700 }} />
          <Chip label="1일차 · 04-18" size="small" variant="outlined" />
          <Chip label="2일차 · 04-19" size="small" variant="outlined" />
          <Chip label="3일차 · 04-20" size="small" variant="outlined" />
        </Box>
      </SectionCard>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SectionCard>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3, pb: 3, borderBottom: `1px solid ${theme.gray[100]}` }}>
              <StatCard variant="hero" label="총 매출액" value={data.totalRevenue.toLocaleString()} unit="원" icon={ReceiptIcon} color={theme.accent.revenue} trend={data.yoyPct} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: `${theme.radii.md}px`, bgcolor: theme.gray[50] }}>
                <Box sx={{ width: 36, height: 36, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(theme.accent.attention, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CartIcon sx={{ fontSize: 18, color: theme.accent.attention }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>오늘 접수</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
                    <Typography sx={{ fontSize: '1.375rem', fontWeight: 800, color: 'text.primary', letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}>{data.todayOrdersCount}</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'text.secondary' }}>건</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
              <StatCard label="검사 판매" value={data.testRevenue.toLocaleString()} unit="원" icon={TestIcon} color={theme.accent.tests} />
              <StatCard label="도서 판매" value={data.bookRevenue.toLocaleString()} unit="원" icon={BookIcon} color={theme.accent.books} />
              <StatCard label="배송비" value={data.shippingRevenue.toLocaleString()} unit="원" icon={ShippingIcon} color={theme.accent.shipping} />
            </Box>
          </Box>
        </SectionCard>

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SectionCard title="주문 처리 현황" subtitle={`누적 ${data.totalOrders}건`}>
              <StatusBar statusCounts={data.statusCounts} totalOrders={data.totalOrders} onStatusClick={() => {}} />
            </SectionCard>
          </Box>
          <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
            <SectionCard interactive sx={{ borderColor: alpha(theme.accent.attention, 0.3), bgcolor: alpha(theme.accent.attention, 0.04), height: '100%', '&:hover': { borderColor: alpha(theme.accent.attention, 0.5), bgcolor: alpha(theme.accent.attention, 0.08) } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(theme.accent.attention, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <WarningIcon sx={{ fontSize: 18, color: theme.accent.attention }} />
                </Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, color: theme.accent.attention, letterSpacing: '-0.01em' }}>처리 필요</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>결제대기</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum" 1' }}>{data.statusCounts.pending}건</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>출고 대기</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum" 1' }}>{data.statusCounts.paid}건</Typography>
                </Box>
              </Box>
            </SectionCard>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SectionCard title="검사 판매 순위" icon={TrophyIcon}>
              <RankingList items={data.testTop} color={theme.accent.tests} />
            </SectionCard>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SectionCard title="도서 판매 순위" icon={TrophyIcon}>
              <RankingList items={data.bookTop} color={theme.accent.books} />
            </SectionCard>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SectionCard title="현장 보고서" icon={ReportIcon}>
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <ReportIcon sx={{ fontSize: 40, color: theme.gray[300], mb: 1 }} />
                <Typography variant="body2">특정 행사를 선택하면 보고서를 작성할 수 있습니다</Typography>
              </Box>
            </SectionCard>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SectionCard title="최근 주문" icon={HistoryIcon}>
              <Box>
                {data.recentOrders.map((order, idx) => (
                  <Box key={order.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, px: 1.25, mx: -1.25, borderRadius: `${theme.radii.md}px`, cursor: 'pointer', borderBottom: idx === data.recentOrders.length - 1 ? 'none' : `1px solid ${theme.gray[100]}`, '&:hover': { bgcolor: theme.gray[50] } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: `${theme.radii.sm}px`, bgcolor: theme.gray[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 800, color: 'text.secondary' }}>
                        {order.customer_name.slice(0, 1)}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{order.customer_name}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                          <StatusChip status={order.status} size="sm" />
                          <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>{order.created_at.slice(5, 16).replace('T', ' ')}</Typography>
                        </Box>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 800, letterSpacing: '-0.025em', fontFeatureSettings: '"tnum" 1' }}>
                      {order.final_payment.toLocaleString()}원
                    </Typography>
                  </Box>
                ))}
              </Box>
            </SectionCard>
          </Box>
        </Box>
      </Box>
    </PreviewShell>
  );
};

export default DashboardDesignPreview;
