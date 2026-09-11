import Box from '@mui/material/Box';

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      {children}
    </Box>
  );
}
