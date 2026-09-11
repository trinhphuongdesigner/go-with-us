'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { colorTokens } from '@/theme/theme';

/** A short field is committed explicitly; failed saves keep the user's draft. */
export default function InlineRoadmapField({
  label,
  value,
  placeholder,
  type = 'text',
  required = false,
  strong = false,
  disabled = false,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: 'text' | 'date';
  required?: boolean;
  strong?: boolean;
  disabled?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const savingRef = React.useRef(false);

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const save = async () => {
    if (savingRef.current || disabled) return;
    const next = draft.trim();
    if (required && !next) {
      setError(type === 'date' ? 'Choose a deadline to save.' : 'This field cannot be empty.');
      return;
    }
    if (!inputRef.current?.reportValidity()) return;
    if (next === value) {
      close();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Box sx={{ py: 0.5 }}>
        <TextField
          inputRef={inputRef}
          autoFocus
          fullWidth
          size="small"
          label={label}
          value={draft}
          type={type}
          disabled={saving || disabled}
          error={!!error}
          helperText={error ?? 'Enter to save · Escape to cancel'}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              void save();
            }
            if (event.key === 'Escape' && !saving) {
              event.preventDefault();
              close();
            }
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton
            aria-label={`Cancel editing ${label}`}
            onClick={close}
            disabled={saving || disabled}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <IconButton
            aria-label={`Save ${label}`}
            color="primary"
            onClick={() => void save()}
            disabled={saving || disabled}
          >
            <CheckIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <ButtonBase
      ref={triggerRef}
      aria-label={`Edit ${label}`}
      disabled={disabled}
      onClick={() => {
        setDraft(value);
        setError(null);
        setEditing(true);
      }}
      sx={{
        display: 'flex',
        width: '100%',
        minHeight: 36,
        justifyContent: 'space-between',
        gap: 1,
        p: 0.75,
        borderRadius: 1,
        textAlign: 'left',
        alignItems: 'flex-start',
        '&:hover': { bgcolor: colorTokens.primarySubtle },
        '&.Mui-focusVisible': { outline: `2px solid ${colorTokens.primary}`, outlineOffset: 2 },
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: strong ? 17 : 13,
          fontWeight: strong ? 600 : 400,
          overflowWrap: 'anywhere',
          color: value ? colorTokens.heading : colorTokens.secondary,
        }}
      >
        {value || placeholder || label}
      </Typography>
      <EditOutlinedIcon
        sx={{ fontSize: 14, mt: 0.4, color: colorTokens.secondary, flexShrink: 0 }}
      />
    </ButtonBase>
  );
}
