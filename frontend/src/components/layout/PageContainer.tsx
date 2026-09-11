import Box from '@mui/material/Box';

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 4 },
      }}
    >
      {children}
    </Box>
  );
}
