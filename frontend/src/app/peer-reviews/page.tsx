'use client';

import * as React from 'react';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { listUsers } from '@/lib/api/usersApi';
import {
  listGivenReviews,
  listReceivedReviews,
  createPeerReview,
  type GivenPeerReview,
  type ReceivedPeerReview,
} from '@/lib/api/peerReviewsApi';
import { ApiError } from '@/lib/api/client';
import type { User } from '@/types';

// Kept small and self-contained — a future phase can grow this into a
// richer competency-specific set without touching the API contract
// (ratings is an open Json? column server-side).
const RATING_CRITERIA: { key: string; label: string }[] = [
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'communication', label: 'Communication' },
];

const RATING_VALUES = [1, 2, 3, 4, 5];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function RatingChips({ ratings }: { ratings: Record<string, number> | null }) {
  if (!ratings || Object.keys(ratings).length === 0) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
      {Object.entries(ratings).map(([key, value]) => (
        <Chip key={key} size="small" label={`${key}: ${value}/5`} />
      ))}
    </Stack>
  );
}

export default function PeerReviewsPage() {
  const { user } = useAuth();

  const [colleagues, setColleagues] = React.useState<User[]>([]);
  const [colleaguesLoading, setColleaguesLoading] = React.useState(true);

  const [revieweeId, setRevieweeId] = React.useState('');
  const [content, setContent] = React.useState('');
  const [ratingValues, setRatingValues] = React.useState<Record<string, number>>(
    Object.fromEntries(RATING_CRITERIA.map((c) => [c.key, 3])),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState(false);

  const [givenReviews, setGivenReviews] = React.useState<GivenPeerReview[]>([]);
  const [receivedReviews, setReceivedReviews] = React.useState<ReceivedPeerReview[]>([]);
  const [listsLoading, setListsLoading] = React.useState(true);
  const [listsError, setListsError] = React.useState<string | null>(null);

  // Used by handleSubmit (a click handler, not an effect) to refetch after
  // a successful submit — safe to write as async/await there. The mount
  // load below deliberately does NOT call this: React 19's
  // react-hooks/set-state-in-effect rule flags calling a separately-defined
  // function from inside an effect when that function's body eventually
  // calls setState, even after an await/in a finally block. Writing the
  // fetch as a literal .then/.catch/.finally chain directly inside the
  // effect (same shape AuthContext.tsx's mount effect already uses) avoids
  // that false positive, so the same fetch is duplicated in that shape
  // below rather than shared.
  const refreshLists = React.useCallback(async () => {
    try {
      const [given, received] = await Promise.all([listGivenReviews(), listReceivedReviews()]);
      setGivenReviews(given);
      setReceivedReviews(received);
      setListsError(null);
    } catch (error) {
      setListsError(error instanceof ApiError ? error.message : 'Failed to load reviews');
    } finally {
      setListsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    Promise.all([listGivenReviews(), listReceivedReviews()])
      .then(([given, received]) => {
        setGivenReviews(given);
        setReceivedReviews(received);
        setListsError(null);
      })
      .catch((error) => {
        setListsError(error instanceof ApiError ? error.message : 'Failed to load reviews');
      })
      .finally(() => setListsLoading(false));
  }, []);

  React.useEffect(() => {
    if (!user) return;
    listUsers()
      .then((users) => {
        setColleagues(users.filter((u) => u.id !== user.id && u.companyId === user.companyId));
      })
      .catch(() => setColleagues([]))
      .finally(() => setColleaguesLoading(false));
  }, [user]);

  const handleRatingChange = (key: string, value: number) => {
    setRatingValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    if (!revieweeId || !content.trim()) {
      setFormError('Pick a colleague and write some feedback first.');
      return;
    }

    setSubmitting(true);
    try {
      await createPeerReview({
        revieweeId,
        content: content.trim(),
        ratings: ratingValues,
      });
      setContent('');
      setRevieweeId('');
      setRatingValues(Object.fromEntries(RATING_CRITERIA.map((c) => [c.key, 3])));
      setFormSuccess(true);
      setListsLoading(true);
      await refreshLists();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const noColleagues = !colleaguesLoading && colleagues.length === 0;

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Peer Reviews" subtitle="Reviews you have given and received." />

        <Card title="Write a review" sx={{ mb: 3 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              {formError ? <Alert severity="error">{formError}</Alert> : null}
              {formSuccess ? <Alert severity="success">Review submitted.</Alert> : null}

              <TextField
                select
                label="Colleague"
                value={revieweeId}
                onChange={(e) => setRevieweeId(e.target.value)}
                disabled={colleaguesLoading || noColleagues}
                helperText={noColleagues ? 'No colleagues found in your company yet.' : ' '}
                fullWidth
              >
                {colleagues.map((colleague) => (
                  <MenuItem key={colleague.id} value={colleague.id}>
                    {colleague.name}
                    {colleague.jobTitle ? ` — ${colleague.jobTitle}` : ''}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Feedback"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                multiline
                minRows={4}
                fullWidth
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                {RATING_CRITERIA.map((criterion) => (
                  <TextField
                    key={criterion.key}
                    select
                    label={criterion.label}
                    value={ratingValues[criterion.key]}
                    onChange={(e) => handleRatingChange(criterion.key, Number(e.target.value))}
                    sx={{ minWidth: 160 }}
                  >
                    {RATING_VALUES.map((value) => (
                      <MenuItem key={value} value={value}>
                        {value} / 5
                      </MenuItem>
                    ))}
                  </TextField>
                ))}
              </Stack>

              <Box>
                <Button type="submit" variant="contained" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit review'}
                </Button>
              </Box>
            </Stack>
          </Box>
        </Card>

        {listsError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {listsError}
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Card title="Reviews I've written">
              {listsLoading ? (
                <CircularProgress size={24} />
              ) : givenReviews.length === 0 ? (
                <Typography variant="body2">You haven&apos;t written any reviews yet.</Typography>
              ) : (
                <Stack divider={<Divider />} spacing={2}>
                  {givenReviews.map((review) => (
                    <Box key={review.id}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {review.reviewee.name?.[0]?.toUpperCase() ?? '?'}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {review.reviewee.name}
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: 12 }}>
                            {formatDate(review.createdAt)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {review.content}
                      </Typography>
                      <RatingChips ratings={review.ratings} />
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Card title="Reviews about me">
              {listsLoading ? (
                <CircularProgress size={24} />
              ) : receivedReviews.length === 0 ? (
                <Typography variant="body2">No one has reviewed you yet.</Typography>
              ) : (
                <Stack divider={<Divider />} spacing={2}>
                  {receivedReviews.map((review) => (
                    <Box key={review.id}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {review.reviewer.name?.[0]?.toUpperCase() ?? '?'}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {review.reviewer.name}
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: 12 }}>
                            {formatDate(review.createdAt)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {review.content}
                      </Typography>
                      <RatingChips ratings={review.ratings} />
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          </Box>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
