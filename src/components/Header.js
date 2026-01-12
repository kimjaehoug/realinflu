import React from 'react';
import { AppBar, Toolbar, Typography, Box, Container } from '@mui/material';

const Header = () => {
  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{ 
        backgroundColor: '#1a202c',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ py: 2, minHeight: '80px !important' }}>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="h5"
                component="div"
                sx={{
                  fontWeight: 700,
                  color: '#4fd1c7',
                  fontSize: '1.8rem',
                  mr: 3,
                  fontFamily: 'Pretendard',
                }}
              >
                Influenza
              </Typography>
              <Typography
                variant="h4"
                component="div"
                sx={{
                  fontWeight: 700,
                  color: 'white',
                  fontSize: '2.125rem',
                  fontFamily: 'Pretendard',
                }}
              >
                주요 발생 현황
              </Typography>
            </Box>

          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header;
