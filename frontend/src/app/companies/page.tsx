'use client';

import * as React from 'react';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import * as companiesApi from '@/lib/api/companiesApi';
import { ApiError } from '@/lib/api/client';
import type { Company } from '@/types';

const EMPTY_FORM = {
  name: '',
  industry: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    companiesApi
      .listCompanies()
      .then(setCompanies)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load companies');
      });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleField = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCreate = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      await companiesApi.createCompany({
        name: form.name,
        industry: form.industry || undefined,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      setForm(EMPTY_FORM);
      setFormOpen(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await companiesApi.deleteCompany(id);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete company');
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Companies"
          subtitle="Every company on the platform."
          actions={
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => setFormOpen((v) => !v)}
            >
              New company
            </Button>
          }
        />

        {formOpen ? (
          <Card title="Create a company" sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
              <TextField label="Company name" value={form.name} onChange={handleField('name')} size="small" />
              <TextField label="Industry (optional)" value={form.industry} onChange={handleField('industry')} size="small" />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Company Admin account
              </Typography>
              <TextField label="Admin name" value={form.adminName} onChange={handleField('adminName')} size="small" />
              <TextField label="Admin email" value={form.adminEmail} onChange={handleField('adminEmail')} size="small" />
              <TextField
                label="Admin password"
                type="password"
                value={form.adminPassword}
                onChange={handleField('adminPassword')}
                size="small"
              />
              {formError ? (
                <Typography variant="body2" sx={{ color: 'error.main' }}>
                  {formError}
                </Typography>
              ) : null}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="contained"
                  disabled={submitting || !form.name || !form.adminName || !form.adminEmail || !form.adminPassword}
                  onClick={handleCreate}
                >
                  Create
                </Button>
                <Button variant="text" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
              </Box>
            </Box>
          </Card>
        ) : null}

        <Card title="Companies">
          {error ? (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : !companies ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : companies.length === 0 ? (
            <Typography variant="body1">No companies yet.</Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Industry</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} hover>
                    <TableCell>{company.name}</TableCell>
                    <TableCell>{company.industry ?? '—'}</TableCell>
                    <TableCell>{new Date(company.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete company">
                        <IconButton size="small" onClick={() => handleDelete(company.id)}>
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContainer>
    </AppShell>
  );
}
