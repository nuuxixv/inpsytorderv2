import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  FormControlLabel,
} from '@mui/material';
import {
  Lock as LockIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import {
  getRoleTemplates,
  createRoleTemplate,
  updateRoleTemplate,
  deleteRoleTemplate,
} from '../api/roleTemplates';

// Permission definitions for the matrix
const PERMISSION_COLUMNS = [
  { key: 'dashboard:view', label: '대시보드' },
  { key: 'orders:view', label: '주문 조회' },
  { key: 'orders:edit', label: '주문 편집' },
  { key: 'fulfillment:view', label: '출고 현황' },
  { key: 'events:view', label: '학회 조회' },
  { key: 'events:edit', label: '학회 편집' },
  { key: 'products:view', label: '상품 조회' },
  { key: 'products:edit', label: '상품 편집' },
  { key: 'users:manage', label: '사용자 관리' },
  { key: 'feedback:view', label: '피드백' },
  { key: 'bulletins:manage', label: '게시판 관리' },
];

const SettingsPage = () => {
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    free_shipping_threshold: 30000,
    shipping_cost: 3000,
  });

  // Role templates state
  const [roleTemplates, setRoleTemplates] = useState([]);
  const [roleTemplatesLoading, setRoleTemplatesLoading] = useState(true);
  const [roleTemplateSaving, setRoleTemplateSaving] = useState(false);
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', permissions: [] });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchRoleTemplates();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      if (data) {
        setSettings({
          free_shipping_threshold: data.free_shipping_threshold,
          shipping_cost: data.shipping_cost,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      addNotification('설정 정보를 불러오는 데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleTemplates = async () => {
    try {
      setRoleTemplatesLoading(true);
      const data = await getRoleTemplates();
      setRoleTemplates(data || []);
    } catch (error) {
      console.error('Error fetching role templates:', error);
      addNotification('역할 템플릿을 불러오는 데 실패했습니다.', 'error');
    } finally {
      setRoleTemplatesLoading(false);
    }
  };

  const isMasterTemplate = (template) => template.is_system && template.name === '마스터';

  const handleTogglePermission = async (template, permissionKey) => {
    if (template.is_system) return;
    const currentPerms = template.permissions || [];
    const newPerms = currentPerms.includes(permissionKey)
      ? currentPerms.filter((p) => p !== permissionKey)
      : [...currentPerms, permissionKey];

    try {
      setRoleTemplateSaving(true);
      await updateRoleTemplate(template.id, {
        name: template.name,
        description: template.description,
        permissions: newPerms,
      });
      setRoleTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, permissions: newPerms } : t))
      );
      addNotification('권한이 업데이트되었습니다.', 'success');
    } catch (error) {
      console.error('Error updating permission:', error);
      addNotification(`권한 업데이트 실패: ${error.message}`, 'error');
    } finally {
      setRoleTemplateSaving(false);
    }
  };

  const handleOpenNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', permissions: [] });
    setOpenTemplateDialog(true);
  };

  const handleOpenEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      permissions: template.permissions || [],
    });
    setOpenTemplateDialog(true);
  };

  const handleTemplateFormPermissionToggle = (permKey) => {
    setTemplateForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter((p) => p !== permKey)
        : [...prev.permissions, permKey],
    }));
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      addNotification('역할 이름을 입력해주세요.', 'warning');
      return;
    }
    try {
      setRoleTemplateSaving(true);
      if (editingTemplate) {
        await updateRoleTemplate(editingTemplate.id, templateForm);
        addNotification('역할 템플릿이 업데이트되었습니다.', 'success');
      } else {
        await createRoleTemplate(templateForm);
        addNotification('역할 템플릿이 생성되었습니다.', 'success');
      }
      setOpenTemplateDialog(false);
      fetchRoleTemplates();
    } catch (error) {
      console.error('Error saving role template:', error);
      addNotification(`역할 템플릿 저장 실패: ${error.message}`, 'error');
    } finally {
      setRoleTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      setRoleTemplateSaving(true);
      await deleteRoleTemplate(id);
      addNotification('역할 템플릿이 삭제되었습니다.', 'success');
      setDeleteConfirmId(null);
      fetchRoleTemplates();
    } catch (error) {
      console.error('Error deleting role template:', error);
      addNotification(`역할 템플릿 삭제 실패: ${error.message}`, 'error');
    } finally {
      setRoleTemplateSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('site_settings')
        .update({
          free_shipping_threshold: parseInt(settings.free_shipping_threshold, 10),
          shipping_cost: parseInt(settings.shipping_cost, 10),
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1); // Assuming ID 1 for now, or we can use a more robust way if needed
      
      if (error) throw error;
      addNotification('설정이 성공적으로 저장되었습니다.', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      addNotification(`설정 저장 실패: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
        설정
      </Typography>

      <Paper sx={{ p: 4, borderRadius: '16px', maxWidth: 600 }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              배송비 정책
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              주문 금액에 따른 배송비 및 무료 배송 기준을 설정합니다. 현장 판매는 배송비가 적용되지 않습니다.
            </Typography>
            
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="무료 배송 기준 금액"
                type="number"
                value={settings.free_shipping_threshold}
                onChange={(e) => setSettings({ ...settings, free_shipping_threshold: e.target.value })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">원</InputAdornment>,
                }}
                helperText="이 금액 이상 구매 시 배송비가 0원이 됩니다."
              />
              
              <TextField
                fullWidth
                label="배송비"
                type="number"
                value={settings.shipping_cost}
                onChange={(e) => setSettings({ ...settings, shipping_cost: e.target.value })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">원</InputAdornment>,
                }}
                helperText="기준 금액 미만 구매 시 부과되는 배송비입니다."
              />
            </Stack>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={fetchSettings}
              disabled={saving}
              sx={{ borderRadius: '10px', px: 3 }}
            >
              취소
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{ borderRadius: '10px', px: 4, fontWeight: 700 }}
            >
              {saving ? <CircularProgress size={24} /> : '저장하기'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Alert severity="info" sx={{ mt: 3, borderRadius: '12px' }}>
        설정 변경 사항은 즉시 적용됩니다.
        (이미 생성된 주문에는 영향을 주지 않으며, 신규 주문부터 적용됩니다.)
      </Alert>

      {/* Role Templates Management Section */}
      <Paper sx={{ p: 4, borderRadius: '16px', mt: 4, maxWidth: 'none' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            역할 템플릿 관리
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleOpenNewTemplate}
            sx={{ borderRadius: '10px' }}
          >
            새 역할 추가
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          사용자에게 부여할 역할별 권한을 관리합니다. 시스템 기본 역할은 삭제할 수 없습니다.
        </Typography>

        {roleTemplatesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, minWidth: 140, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>역할</TableCell>
                  {PERMISSION_COLUMNS.map((col) => (
                    <TableCell
                      key={col.key}
                      align="center"
                      sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 70, whiteSpace: 'nowrap' }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 700, minWidth: 80 }}>액션</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roleTemplates.map((template) => {
                  const isMaster = isMasterTemplate(template);
                  return (
                    <TableRow key={template.id} hover>
                      <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {template.name}
                          </Typography>
                          {template.is_system && (
                            <Chip
                              label="기본"
                              size="small"
                              icon={<LockIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined"
                              color="default"
                              sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                        {template.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                            {template.description}
                          </Typography>
                        )}
                      </TableCell>
                      {PERMISSION_COLUMNS.map((col) => {
                        const hasPermission = isMaster || (template.permissions || []).includes(col.key);
                        return (
                          <TableCell key={col.key} align="center" sx={{ p: 0.5 }}>
                            <Checkbox
                              size="small"
                              checked={hasPermission}
                              disabled={template.is_system || roleTemplateSaving}
                              onChange={() => handleTogglePermission(template, col.key)}
                            />
                          </TableCell>
                        );
                      })}
                      <TableCell align="center">
                        {!template.is_system ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                            <Tooltip title="편집">
                              <IconButton size="small" onClick={() => handleOpenEditTemplate(template)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="삭제">
                              <IconButton size="small" color="error" onClick={() => setDeleteConfirmId(template.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.disabled">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* New / Edit Role Template Dialog */}
      <Dialog open={openTemplateDialog} onClose={() => setOpenTemplateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {editingTemplate ? '역할 템플릿 편집' : '새 역할 추가'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            autoFocus
            label="역할 이름"
            fullWidth
            required
            value={templateForm.name}
            onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="예: 외부 파트너"
            sx={{ mt: 1 }}
          />
          <TextField
            label="설명"
            fullWidth
            multiline
            rows={2}
            value={templateForm.description}
            onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="이 역할의 용도를 설명합니다."
          />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              권한 선택
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {PERMISSION_COLUMNS.map((col) => (
                <FormControlLabel
                  key={col.key}
                  control={
                    <Checkbox
                      size="small"
                      checked={templateForm.permissions.includes(col.key)}
                      onChange={() => handleTemplateFormPermissionToggle(col.key)}
                    />
                  }
                  label={<Typography variant="body2">{col.label}</Typography>}
                  sx={{ minWidth: 140 }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenTemplateDialog(false)}>취소</Button>
          <Button
            variant="contained"
            onClick={handleSaveTemplate}
            disabled={roleTemplateSaving}
            sx={{ px: 4 }}
          >
            {roleTemplateSaving ? <CircularProgress size={22} /> : editingTemplate ? '업데이트' : '생성하기'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteConfirmId)} onClose={() => setDeleteConfirmId(null)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>역할 템플릿 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            이 역할 템플릿을 삭제하시겠습니까? 이미 이 역할이 할당된 사용자에게는 영향이 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmId(null)}>취소</Button>
          <Button
            onClick={() => handleDeleteTemplate(deleteConfirmId)}
            color="error"
            variant="contained"
            disabled={roleTemplateSaving}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsPage;
