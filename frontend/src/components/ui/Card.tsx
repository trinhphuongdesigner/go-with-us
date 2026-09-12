import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

interface CardProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  sx?: object;
  className?: string;
}

/**
 * The primary layout unit per style-concept.md section 4 — every list/
 * table/form should live inside one of these rather than sitting directly
 * on the page background.
 */
export default function Card({
  title,
  actions,
  children,
  sx,
  className,
}: CardProps) {
  return (
    <MuiCard sx={sx} className={className}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        {title || actions ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            {title ? <Typography variant="h2">{title}</Typography> : <span />}
            {actions}
          </Box>
        ) : null}
        {children}
      </CardContent>
    </MuiCard>
  );
}
