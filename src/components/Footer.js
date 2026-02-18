import React from 'react';
import { alpha } from '@mui/material/styles';
import { Box, Container, Typography } from '@mui/material';

const Footer = ({ isOpen = true }) => {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.paper',
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        mt: 'auto',
        py: 2,
        marginLeft: isOpen ? '240px' : '64px',
        transition: 'margin-left 0.3s ease',
      }}
    >
      <Container maxWidth="xl">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              lineHeight: 1.6,
            }}
          >
            1) 표본감시기관의 보고시점을 기준으로 취합 및 분석한 잠정통계로 변동 가능함<br />
            2) 동일주차별 비교를 위하여 22/23절기 53주를 제외한 그 외 절기의 53주는 52주와 동일(52주 중복)
          </Typography>
          <Typography
            variant="body2"
            sx={(theme) => ({
              fontSize: '0.875rem',
              color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.65) : 'text.secondary',
            })}
          >
            최근 업데이트 일시: 2025-11-03
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
