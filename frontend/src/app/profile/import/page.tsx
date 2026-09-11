'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { ApiError } from '@/lib/api/client';
import {
  applyProfileImport,
  createProfileImport,
  parseProfileImport,
  type ImportSourceType,
  type ParsedProfile,
} from '@/lib/api/profileImportsApi';

const STEPS = ['Provide your CV', 'Review what AI found', 'Save to profile'];

/** Which proposed items the user ticked, by section and index. */
type Selection = Record<keyof SelectableSections, Set<number>>;

interface SelectableSections {
  skills: unknown[];
  certifications: unknown[];
  projects: unknown[];
  awards: unknown[];
}

const allSelected = (parsed: ParsedProfile): Selection => ({
  skills: new Set(parsed.skills.map((_, i) => i)),
  certifications: new Set(parsed.certifications.map((_, i) => i)),
  projects: new Set(parsed.projects.map((_, i) => i)),
  awards: new Set(parsed.awards.map((_, i) => i)),
});

/**
 * M2 — CV / LinkedIn import. The AI only ever proposes: nothing reaches the
 * profile until the user ticks what they want and presses save.
 */
export default function ProfileImportPage() {
  const router = useRouter();

  const [step, setStep] = React.useState(0);
  const [sourceType, setSourceType] =
    React.useState<ImportSourceType>('CV_TEXT');
  const [sourceName, setSourceName] = React.useState('');
  const [rawText, setRawText] = React.useState('');

  const [importId, setImportId] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParsedProfile | null>(null);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [jobTitle, setJobTitle] = React.useState('');

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    // No object storage in this project — we read the text client-side and
    // only ever send the text. Binary CVs (PDF/DOCX) need pasting for now.
    if (!/\.(txt|md|markdown|json|csv)$/i.test(file.name)) {
      setError(
        'Only plain-text files can be read directly. For a PDF or Word CV, copy the text and paste it below.',
      );
      return;
    }
    setRawText(await file.text());
    setSourceName(file.name);
    setSourceType('CV_FILE');
  };

  const handleParse = async () => {
    if (rawText.trim().length < 20) {
      setError('Paste at least a few lines of your CV first.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await createProfileImport({
        sourceType,
        sourceName: sourceName || undefined,
        rawText,
      });
      const done = await parseProfileImport(created.id);
      if (!done.parsedData) {
        throw new Error('AI returned nothing to review');
      }
      setImportId(done.id);
      setParsed(done.parsedData);
      setSelection(allSelected(done.parsedData));
      setJobTitle(done.parsedData.profile.jobTitle ?? '');
      setStep(1);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to read this CV',
      );
    } finally {
      setBusy(false);
    }
  };

  const toggle = (section: keyof SelectableSections, index: number) => {
    if (!selection) return;
    const next = new Set(selection[section]);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelection({ ...selection, [section]: next });
  };

  const handleApply = async () => {
    if (!importId || !parsed || !selection) return;

    setBusy(true);
    setError(null);
    try {
      const applied = await applyProfileImport(importId, {
        jobTitle: jobTitle.trim() || undefined,
        skills: parsed.skills.filter((_, i) => selection.skills.has(i)),
        certifications: parsed.certifications.filter((_, i) =>
          selection.certifications.has(i),
        ),
        projects: parsed.projects.filter((_, i) => selection.projects.has(i)),
        awards: parsed.awards.filter((_, i) => selection.awards.has(i)),
      });
      setResult(
        `Added ${applied.applied.skills} skills, ${applied.applied.certifications} certificates, ${applied.applied.projects} projects and ${applied.applied.awards} achievements.`,
      );
      setStep(2);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to save to your profile',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Import CV"
          subtitle="Paste your CV or LinkedIn profile — AI turns it into structured profile data for you to review."
        />

        <Card sx={{ mb: 3 }}>
          <Stepper activeStep={step} alternativeLabel>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Card>

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}

        {step === 0 ? (
          <Card title="Your CV">
            <Stack spacing={2}>
              <TextField
                select
                label="Source"
                value={sourceType}
                onChange={(e) =>
                  setSourceType(e.target.value as ImportSourceType)
                }
                sx={{ maxWidth: 280 }}
              >
                <MenuItem value="CV_TEXT">Pasted CV text</MenuItem>
                <MenuItem value="CV_FILE">CV file</MenuItem>
                <MenuItem value="LINKEDIN_URL">LinkedIn profile</MenuItem>
              </TextField>

              {sourceType === 'LINKEDIN_URL' ? (
                <TextField
                  label="LinkedIn URL"
                  placeholder="https://www.linkedin.com/in/..."
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  fullWidth
                />
              ) : null}

              {sourceType === 'CV_FILE' ? (
                <Box>
                  <Button variant="outlined" component="label">
                    Choose file
                    <input
                      hidden
                      type="file"
                      accept=".txt,.md,.markdown,.json,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </Button>
                  {sourceName ? (
                    <Chip label={sourceName} size="small" sx={{ ml: 1.5 }} />
                  ) : null}
                </Box>
              ) : null}

              <TextField
                label="CV / profile text"
                helperText="For a PDF or Word CV, copy the text and paste it here."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                fullWidth
                multiline
                minRows={10}
              />

              {busy ? <LinearProgress /> : null}

              <Box>
                <Button
                  variant="contained"
                  onClick={handleParse}
                  disabled={busy}
                >
                  {busy ? 'Reading your CV...' : 'Read with AI'}
                </Button>
              </Box>
            </Stack>
          </Card>
        ) : null}

        {step === 1 && parsed && selection ? (
          <>
            {parsed.summary ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                {parsed.summary}
              </Alert>
            ) : null}

            <Card title="Your position" sx={{ mb: 3 }}>
              <TextField
                label="Job title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                fullWidth
                helperText="Leave empty to keep your current title"
              />
            </Card>

            <Card title={`Skills (${parsed.skills.length})`} sx={{ mb: 3 }}>
              {parsed.skills.length === 0 ? (
                <Typography variant="body2">None found.</Typography>
              ) : (
                <Stack>
                  {parsed.skills.map((skill, index) => (
                    <FormControlLabel
                      key={`${skill.name}-${index}`}
                      control={
                        <Checkbox
                          checked={selection.skills.has(index)}
                          onChange={() => toggle('skills', index)}
                        />
                      }
                      label={`${skill.name} — level ${skill.level}/5`}
                    />
                  ))}
                </Stack>
              )}
            </Card>

            <Card
              title={`Certificates (${parsed.certifications.length})`}
              sx={{ mb: 3 }}
            >
              {parsed.certifications.length === 0 ? (
                <Typography variant="body2">None found.</Typography>
              ) : (
                <Stack>
                  {parsed.certifications.map((certification, index) => (
                    <FormControlLabel
                      key={`${certification.name}-${index}`}
                      control={
                        <Checkbox
                          checked={selection.certifications.has(index)}
                          onChange={() => toggle('certifications', index)}
                        />
                      }
                      label={[
                        certification.name,
                        certification.issuer,
                        certification.score,
                        certification.issuedAt,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  ))}
                </Stack>
              )}
            </Card>

            <Card title={`Projects (${parsed.projects.length})`} sx={{ mb: 3 }}>
              {parsed.projects.length === 0 ? (
                <Typography variant="body2">None found.</Typography>
              ) : (
                <Stack divider={<Divider />} spacing={1}>
                  {parsed.projects.map((project, index) => (
                    <Box key={`${project.name}-${index}`} sx={{ pt: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selection.projects.has(index)}
                            onChange={() => toggle('projects', index)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {project.name}
                            </Typography>
                            <Typography variant="body2">
                              {project.role}
                              {project.domain ? ` · ${project.domain}` : ''}
                              {project.startDate
                                ? ` · ${project.startDate} → ${project.endDate ?? 'now'}`
                                : ''}
                            </Typography>
                            {project.contribution ? (
                              <Typography variant="body2">
                                {project.contribution}
                              </Typography>
                            ) : null}
                          </Box>
                        }
                      />
                      {project.techStack && project.techStack.length > 0 ? (
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ flexWrap: 'wrap', gap: 0.75, ml: 4, mb: 1 }}
                        >
                          {project.techStack.map((tech) => (
                            <Chip
                              key={tech}
                              label={tech}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Stack>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>

            <Card title={`Achievements (${parsed.awards.length})`} sx={{ mb: 3 }}>
              {parsed.awards.length === 0 ? (
                <Typography variant="body2">None found.</Typography>
              ) : (
                <Stack>
                  {parsed.awards.map((award, index) => (
                    <FormControlLabel
                      key={`${award.title}-${index}`}
                      control={
                        <Checkbox
                          checked={selection.awards.has(index)}
                          onChange={() => toggle('awards', index)}
                        />
                      }
                      label={[award.title, award.issuer, award.awardedAt]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  ))}
                </Stack>
              )}
            </Card>

            {busy ? <LinearProgress sx={{ mb: 2 }} /> : null}

            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" onClick={handleApply} disabled={busy}>
                {busy ? 'Saving...' : 'Save selected to my profile'}
              </Button>
              <Button onClick={() => setStep(0)} disabled={busy}>
                Back
              </Button>
            </Stack>
          </>
        ) : null}

        {step === 2 ? (
          <Card title="Done">
            <Alert severity="success" sx={{ mb: 2 }}>
              {result}
            </Alert>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                onClick={() => router.push('/profile')}
              >
                View my profile
              </Button>
              <Button
                onClick={() => {
                  setStep(0);
                  setParsed(null);
                  setSelection(null);
                  setImportId(null);
                  setRawText('');
                  setSourceName('');
                  setResult(null);
                }}
              >
                Import another
              </Button>
            </Stack>
          </Card>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}
