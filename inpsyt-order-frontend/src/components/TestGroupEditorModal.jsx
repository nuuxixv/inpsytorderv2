import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogActions, DialogContent, DialogTitle, Switch, FormControlLabel, Checkbox,
  IconButton, Menu, MenuItem, ListItemIcon, RadioGroup, Radio, FormControl, FormLabel,
  Autocomplete, Chip, CircularProgress, useTheme,
} from '@mui/material';
import {
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  fetchTestGroupOptions,
  saveTestGroupWithOptions,
  deleteProductOption,
  moveOptionsToGroup,
  splitTestGroup,
} from '../api/testGroups';

// =====================================================================
// 검사군 상세 편집 모달 (A6 §검사군 상세편집)
// - 검사군(상단: 검사명·약어·노출) + 하위 옵션(products) 인라인 테이블을 한 곳에서 편집.
// - 순서 ▲▼(드래그앤드롭 금지 — Non-Goal), 옵션 ⋮ = 이동/삭제.
// - 삭제는 master 전용(products DELETE RLS). edit 운영자는 버튼 비활성 + 안내.
// - 상품코드 중복 검증은 저장 시 로드된 전체 products 기준.
// - state 완전 격리 — 214검사군 헤더 렌더에 영향 없음(모달은 자체 로컬 state).
// =====================================================================

// 신규 옵션 name 자동조합 — "검사명 옵션명"(공백 1칸, 하이픈 금지). 편집 가능.
const composeOptionName = (groupName, optionName) =>
  [groupName?.trim(), optionName?.trim()].filter(Boolean).join(' ');

const emptyDraftOption = () => ({
  _draftId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  option_name: '',
  option_label: '',
  product_code: '',
  name: '',
  nameTouched: false,
  list_price: 0,
  is_common: false,
  is_active: true,
});

const TestGroupEditorModal = ({
  open,
  group,             // null = 신규 검사군, 객체 = 기존 편집
  allProducts,       // 상품코드 중복 검증용(로드된 전체 products)
  testGroups,        // 옵션 이동 대상 Autocomplete 소스
  canEdit,
  canDelete,         // master 여부(products DELETE 권한)
  onClose,
  onSaved,           // 저장/이동/삭제 후 상위 리로드
  addNotification,
}) => {
  const theme = useTheme();

  const [name, setName] = useState('');
  const [abbr, setAbbr] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // 옵션: 기존(id 보유) + 신규(_draftId). 삭제 예약은 deletedIds에 누적.
  const [options, setOptions] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 옵션 행 ⋮ 메뉴
  const [rowMenu, setRowMenu] = useState(null); // { el, option }

  // 옵션 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState(null); // 삭제할 옵션(id 보유 기존 옵션만)

  // 옵션 옮기기(분리·이동)
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveSelected, setMoveSelected] = useState(new Set());
  const [moveDest, setMoveDest] = useState('new'); // 'new' | 'existing'
  const [moveNewForm, setMoveNewForm] = useState({ name: '', abbr: '' });
  const [moveTarget, setMoveTarget] = useState(null); // 기존 검사군 객체
  const [moveRunning, setMoveRunning] = useState(false);

  const resetState = useCallback(() => {
    setName('');
    setAbbr('');
    setSortOrder(0);
    setIsActive(true);
    setOptions([]);
    setDeletedIds([]);
    setRowMenu(null);
    setDeleteTarget(null);
    setMoveOpen(false);
    setMoveSelected(new Set());
    setMoveDest('new');
    setMoveNewForm({ name: '', abbr: '' });
    setMoveTarget(null);
  }, []);

  // 열릴 때 상태 로드(기존이면 옵션 fetch, 신규면 빈 상태).
  React.useEffect(() => {
    if (!open) return;
    resetState();
    if (group) {
      setName(group.name || '');
      setAbbr(group.abbr || '');
      setSortOrder(group.sort_order ?? 0);
      setIsActive(group.is_active !== false);
      setLoading(true);
      fetchTestGroupOptions(group.id)
        .then((rows) => setOptions(rows.map((r) => ({ ...r, nameTouched: true }))))
        .catch((e) => addNotification(`옵션을 불러오지 못했습니다: ${e.message}`, 'error'))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group]);

  const patchOption = useCallback((key, patch) => {
    setOptions((prev) => prev.map((o) => ((o.id ?? o._draftId) === key ? { ...o, ...patch } : o)));
  }, []);

  const moveOptionRow = useCallback((index, dir) => {
    setOptions((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const addDraftOption = useCallback(() => {
    setOptions((prev) => [...prev, emptyDraftOption()]);
  }, []);

  // 옵션명 변경 시 신규 옵션 name 자동조합(사용자가 name을 직접 만지지 않은 경우만).
  const handleOptionNameChange = useCallback((key, value) => {
    setOptions((prev) => prev.map((o) => {
      if ((o.id ?? o._draftId) !== key) return o;
      const next = { ...o, option_name: value };
      // 신규 옵션(id 없음)이고 name 미편집이면 자동조합. 기존 옵션 name은 절대 덮어쓰지 않음.
      if (!o.id && !o.nameTouched) next.name = composeOptionName(name, value);
      return next;
    }));
  }, [name]);

  const removeDraftOption = useCallback((draftId) => {
    setOptions((prev) => prev.filter((o) => o._draftId !== draftId));
  }, []);

  // 옵션 옮기기 후 모달에서 해당 옵션 제거(리로드 없이 로컬 반영).
  const dropMovedOptions = useCallback((ids) => {
    const idSet = new Set(ids);
    setOptions((prev) => prev.filter((o) => !idSet.has(o.id)));
  }, []);

  const productCodeDupError = useMemo(() => {
    // 모달 내부 옵션끼리 + 로드된 전체 products 대비 상품코드 중복 감지.
    const codes = options.map((o) => (o.product_code || '').trim()).filter(Boolean);
    const localDup = codes.find((c, i) => codes.indexOf(c) !== i);
    if (localDup) return `상품코드 "${localDup}"가 이 검사군 안에서 중복됩니다.`;
    const myIds = new Set(options.filter((o) => o.id).map((o) => o.id));
    for (const o of options) {
      const code = (o.product_code || '').trim();
      if (!code) continue;
      const clash = allProducts.find((p) => (p.product_code || '').trim() === code && !myIds.has(p.id));
      if (clash) return `상품코드 "${code}"는 다른 상품(${clash.name})에서 이미 사용 중입니다.`;
    }
    return null;
  }, [options, allProducts]);

  const handleSave = async () => {
    if (!name.trim()) {
      addNotification('검사명을 입력해 주세요.', 'warning');
      return;
    }
    const missingCode = options.find((o) => !o.id && !(o.product_code || '').trim());
    if (missingCode) {
      addNotification('새 옵션의 상품 코드를 입력해 주세요.', 'warning');
      return;
    }
    if (productCodeDupError) {
      addNotification(productCodeDupError, 'error');
      return;
    }

    const newOptions = [];
    const updatedOptions = [];
    options.forEach((o, index) => {
      if (o.id) {
        updatedOptions.push({
          id: o.id,
          updates: {
            option_name: o.option_name || null,
            option_label: o.option_label || null,
            is_common: !!o.is_common,
            is_active: o.is_active !== false,
            sort_order: index,
          },
        });
      } else {
        newOptions.push({
          product_code: (o.product_code || '').trim(),
          name: (o.name || '').trim() || composeOptionName(name, o.option_name),
          list_price: Number(o.list_price) || 0,
          option_name: o.option_name || null,
          option_label: o.option_label || null,
          is_common: !!o.is_common,
          is_active: o.is_active !== false,
          sort_order: index,
        });
      }
    });

    setSaving(true);
    try {
      await saveTestGroupWithOptions({
        group: group
          ? { id: group.id, abbr: abbr.trim() || null, name: name.trim(), sort_order: Number(sortOrder) || 0, is_active: isActive }
          : { abbr: abbr.trim() || null, name: name.trim(), sort_order: Number(sortOrder) || 0, is_active: isActive },
        newOptions,
        updatedOptions,
        deletedIds,
      });
      addNotification('검사군을 저장했습니다.', 'success');
      onSaved();
      onClose();
    } catch (e) {
      addNotification(`저장 실패: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 옵션 삭제(즉시 — master 전용). order_items 스냅샷 보존.
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteProductOption(deleteTarget.id);
      setOptions((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      addNotification('옵션을 삭제했습니다.', 'success');
      setDeleteTarget(null);
      onSaved();
    } catch (e) {
      addNotification(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 옵션 옮기기 진입 — 저장 안 된 신규(draft) 옵션은 이동 불가(먼저 저장 필요).
  const openMove = () => {
    setMoveSelected(new Set());
    setMoveDest('new');
    setMoveNewForm({ name: '', abbr: '' });
    setMoveTarget(null);
    setMoveOpen(true);
  };

  const toggleMoveOption = (id) => {
    setMoveSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const savedOptions = options.filter((o) => o.id);
  const movingAll = moveSelected.size > 0 && moveSelected.size === savedOptions.length;
  const moveDestName = moveDest === 'new' ? moveNewForm.name.trim() : (moveTarget?.name || '');
  const moveConfirmDisabled =
    moveRunning ||
    moveSelected.size === 0 ||
    (moveDest === 'new' ? !moveNewForm.name.trim() : !moveTarget);

  const handleMove = async () => {
    const ids = Array.from(moveSelected);
    setMoveRunning(true);
    try {
      if (moveDest === 'new') {
        await splitTestGroup(
          { abbr: moveNewForm.abbr.trim() || null, name: moveNewForm.name.trim(), sort_order: 0, is_active: true },
          ids,
        );
        addNotification(`옵션 ${ids.length}개를 새 검사군으로 분리했습니다.`, 'success');
      } else {
        await moveOptionsToGroup(moveTarget.id, ids);
        addNotification(`옵션 ${ids.length}개를 '${moveTarget.name}'(으)로 옮겼습니다.`, 'success');
      }
      dropMovedOptions(ids);
      setMoveOpen(false);
      onSaved();
    } catch (e) {
      addNotification(`옮기기 실패: ${e.message}`, 'error');
    } finally {
      setMoveRunning(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {group ? '검사군 상세 편집' : '새 검사군'}
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.25 }}>
            검사군과 하위 옵션(판매 상품)을 한 곳에서 편집합니다. 저장 시 진열에 반영됩니다.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* 상단 — 검사명·약어·정렬·노출 */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
            <TextField
              autoFocus
              required
              label="검사명"
              size="small"
              placeholder="예: 한국판 웩슬러 아동지능검사"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              sx={{ flex: '2 1 260px' }}
            />
            <TextField
              label="약어"
              size="small"
              placeholder="예: K-WISC-V (없으면 비움)"
              value={abbr}
              onChange={(e) => setAbbr(e.target.value)}
              disabled={!canEdit}
              sx={{ flex: '1 1 160px' }}
            />
            <TextField
              label="정렬 순서"
              type="number"
              size="small"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={!canEdit}
              sx={{ width: 120 }}
            />
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={!canEdit} />}
              label={<Typography variant="body2">고객 주문서 노출</Typography>}
            />
            {!isActive && (
              <Chip label="숨김" size="small" sx={{ bgcolor: theme.gray[200], color: 'text.secondary', border: 0, fontWeight: 600 }} />
            )}
          </Box>

          {/* 본문 — 옵션 인라인 테이블 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              옵션 (하위 판매 상품)
            </Typography>
            {canEdit && savedOptions.length >= 1 && (
              <Button size="small" variant="outlined" color="error" startIcon={<MoveIcon />} onClick={openMove}>
                옵션 옮기기 (분리·이동)
              </Button>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : (
            <Table size="small" sx={{ '& td, & th': { borderColor: theme.gray[100] } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 64 }}>순서</TableCell>
                  <TableCell>옵션명 (형태)</TableCell>
                  <TableCell>말머리</TableCell>
                  <TableCell sx={{ width: 140 }}>상품코드</TableCell>
                  <TableCell align="right" sx={{ width: 120 }}>가격</TableCell>
                  <TableCell align="center" sx={{ width: 56 }}>공용</TableCell>
                  <TableCell align="center" sx={{ width: 64 }}>노출</TableCell>
                  {canEdit && <TableCell align="center" sx={{ width: 48 }} />}
                </TableRow>
              </TableHead>
              <TableBody>
                {options.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 8 : 7} align="center" sx={{ py: 3, color: 'text.disabled' }}>
                      옵션이 없습니다. 아래 &quot;옵션 추가&quot;로 하위 상품을 등록하세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  options.map((o, index) => {
                    const key = o.id ?? o._draftId;
                    const isDraft = !o.id;
                    return (
                      <TableRow key={key} sx={{ opacity: o.is_active === false ? 0.55 : 1 }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <IconButton size="small" onClick={() => moveOptionRow(index, -1)} disabled={!canEdit || index === 0}>
                              <ArrowUpwardIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton size="small" onClick={() => moveOptionRow(index, 1)} disabled={!canEdit || index === options.length - 1}>
                              <ArrowDownwardIcon fontSize="inherit" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            fullWidth
                            placeholder="예: 검사지·온라인코드 20개"
                            value={o.option_name || ''}
                            onChange={(e) => handleOptionNameChange(key, e.target.value)}
                            disabled={!canEdit}
                          />
                          {isDraft && (
                            <TextField
                              variant="standard"
                              fullWidth
                              placeholder="상품명 (자동조합 — 편집 가능)"
                              value={o.name || ''}
                              onChange={(e) => patchOption(key, { name: e.target.value, nameTouched: true })}
                              disabled={!canEdit}
                              sx={{ mt: 0.5, '& input': { fontSize: '0.75rem', color: 'text.secondary' } }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            fullWidth
                            placeholder="예: 교사용 12~23개월"
                            value={o.option_label || ''}
                            onChange={(e) => patchOption(key, { option_label: e.target.value })}
                            disabled={!canEdit}
                          />
                        </TableCell>
                        <TableCell>
                          {isDraft ? (
                            <TextField
                              variant="standard"
                              fullWidth
                              required
                              placeholder="수기 입력"
                              value={o.product_code || ''}
                              onChange={(e) => patchOption(key, { product_code: e.target.value })}
                              disabled={!canEdit}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{o.product_code || '-'}</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {isDraft ? (
                            <TextField
                              variant="standard"
                              type="number"
                              fullWidth
                              value={o.list_price ?? 0}
                              onChange={(e) => patchOption(key, { list_price: e.target.value })}
                              disabled={!canEdit}
                              inputProps={{ style: { textAlign: 'right' } }}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{(o.list_price || 0).toLocaleString()}원</Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox size="small" checked={!!o.is_common} onChange={(e) => patchOption(key, { is_common: e.target.checked })} disabled={!canEdit} />
                        </TableCell>
                        <TableCell align="center">
                          <Switch size="small" checked={o.is_active !== false} onChange={(e) => patchOption(key, { is_active: e.target.checked })} disabled={!canEdit} />
                        </TableCell>
                        {canEdit && (
                          <TableCell align="center">
                            {isDraft ? (
                              <IconButton size="small" onClick={() => removeDraftOption(o._draftId)} title="이 새 옵션 행 제거">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            ) : (
                              <IconButton size="small" onClick={(e) => setRowMenu({ el: e.currentTarget, option: o })}>
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}

          {canEdit && (
            <Button size="small" startIcon={<AddIcon />} onClick={addDraftOption} sx={{ mt: 1.5 }}>
              옵션 추가
            </Button>
          )}

          {productCodeDupError && (
            <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 1 }}>
              {productCodeDupError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={saving}>취소</Button>
          {canEdit && (
            <Button variant="contained" onClick={handleSave} disabled={saving || loading} startIcon={saving ? <CircularProgress size={14} /> : null}>
              저장
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 옵션 행 ⋮ 메뉴 — 이동 / 삭제 */}
      <Menu anchorEl={rowMenu?.el} open={Boolean(rowMenu)} onClose={() => setRowMenu(null)}>
        <MenuItem
          onClick={() => {
            setMoveSelected(new Set([rowMenu.option.id]));
            setMoveDest('new');
            setMoveNewForm({ name: '', abbr: '' });
            setMoveTarget(null);
            setMoveOpen(true);
            setRowMenu(null);
          }}
        >
          <ListItemIcon><MoveIcon fontSize="small" /></ListItemIcon>
          다른 검사군으로 옮기기
        </MenuItem>
        <MenuItem
          disabled={!canDelete}
          onClick={() => {
            setDeleteTarget(rowMenu.option);
            setRowMenu(null);
          }}
          sx={{ color: canDelete ? 'error.main' : undefined }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: canDelete ? 'error.main' : undefined }} /></ListItemIcon>
          {canDelete ? '삭제' : '삭제 (관리자 전용)'}
        </MenuItem>
        {!canDelete && (
          <Typography variant="caption" sx={{ px: 2, pb: 1, display: 'block', color: 'text.secondary', maxWidth: 220 }}>
            삭제는 관리자(master) 권한이 필요합니다. 판매중지는 노출 토글을 꺼 주세요.
          </Typography>
        )}
      </Menu>

      {/* 옵션 삭제 확인 */}
      <Dialog open={Boolean(deleteTarget)} onClose={saving ? undefined : () => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>옵션 삭제</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            <strong>{deleteTarget?.name}</strong>을(를) 완전히 삭제합니다.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            판매중지는 노출 토글로 하세요. 삭제는 되돌릴 수 없습니다. 과거 주문 기록은 보존됩니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={saving}>취소</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={saving} startIcon={saving ? <CircularProgress size={14} /> : null}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 옵션 옮기기 (분리·이동) */}
      <Dialog open={moveOpen} onClose={moveRunning ? undefined : () => setMoveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>옵션 옮기기 (분리·이동)</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl sx={{ mb: 2 }}>
            <FormLabel sx={{ fontSize: '0.8rem', mb: 0.5 }}>어디로 옮길까요?</FormLabel>
            <RadioGroup row value={moveDest} onChange={(e) => setMoveDest(e.target.value)}>
              <FormControlLabel value="new" control={<Radio size="small" />} label="새 검사군으로" />
              <FormControlLabel value="existing" control={<Radio size="small" />} label="기존 검사군으로" />
            </RadioGroup>
          </FormControl>

          {moveDest === 'new' ? (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                size="small"
                label="새 검사군 검사명"
                placeholder="예: 문장완성검사 (아동)"
                value={moveNewForm.name}
                onChange={(e) => setMoveNewForm((p) => ({ ...p, name: e.target.value }))}
                sx={{ flex: 2 }}
              />
              <TextField
                size="small"
                label="약어"
                placeholder="예: SCT-C"
                value={moveNewForm.abbr}
                onChange={(e) => setMoveNewForm((p) => ({ ...p, abbr: e.target.value }))}
                sx={{ flex: 1 }}
              />
            </Box>
          ) : (
            <Autocomplete
              size="small"
              sx={{ mb: 2 }}
              options={testGroups.filter((g) => g.id !== group?.id)}
              value={moveTarget}
              onChange={(_, v) => setMoveTarget(v)}
              getOptionLabel={(g) => (g.abbr ? `${g.abbr} · ${g.name}` : g.name)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label="옮길 대상 검사군" placeholder="약어·검사명으로 검색" />}
            />
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
            옮길 옵션 ({moveSelected.size}개 선택)
          </Typography>
          <Box sx={{ maxHeight: 240, overflow: 'auto', border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.md}px` }}>
            {savedOptions.map((o) => (
              <Box key={o.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderBottom: `1px solid ${theme.gray[100]}` }}>
                <Checkbox size="small" checked={moveSelected.has(o.id)} onChange={() => toggleMoveOption(o.id)} />
                <Box sx={{ minWidth: 0 }}>
                  {o.option_label && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{o.option_label}</Typography>
                  )}
                  <Typography variant="body2">{o.option_name || o.name}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* 확인 문구 3블록(정직·자체완결) */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              옵션 {moveSelected.size}개를 &apos;{moveDestName || '…'}&apos;(으)로 옮깁니다. 진열이 즉시 바뀝니다.
            </Typography>
            {movingAll && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                &apos;{name}&apos;에 남는 옵션이 없어집니다. 빈 검사군은 고객 진열에 표시되지 않으며, 필요 없으면 ⋮ 메뉴에서 직접 삭제하세요.
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              잘못 옮겼다면 반대로 다시 옮기면 됩니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMoveOpen(false)} disabled={moveRunning}>취소</Button>
          <Button variant="contained" color="error" onClick={handleMove} disabled={moveConfirmDisabled} startIcon={moveRunning ? <CircularProgress size={14} /> : null}>
            {moveDest === 'new'
              ? `${moveSelected.size}개를 새 검사군으로 분리`
              : `${moveSelected.size}개를 '${moveTarget?.name || '…'}'(으)로 옮기기`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TestGroupEditorModal;
