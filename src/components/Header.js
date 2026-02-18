import React from 'react';
import { alpha } from '@mui/material/styles';
import { Badge, Box, IconButton, InputBase, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

const Header = ({ isOpen, colorMode = 'light', onToggleColorMode }) => {
  return (
    <Box
      sx={{
        height: 60,
        bgcolor: 'background.paper',
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        position: 'fixed',
        top: 0,
        left: isOpen ? 240 : 64,
        right: 0,
        zIndex: 999,
        transition: 'left 0.3s ease',
      }}
    >
      {/* Search */}
      <Box
        sx={(theme) => ({
          flex: 1,
          maxWidth: 520,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: 999,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.04)
              : alpha(theme.palette.common.black, 0.02),
        })}
      >
        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <InputBase
          placeholder="Search"
          inputProps={{ 'aria-label': 'search' }}
          sx={{
            flex: 1,
            fontSize: 14,
            color: 'text.primary',
            '& input::placeholder': { color: 'text.secondary', opacity: 1 },
          }}
        />
      </Box>

      {/* Right actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          onClick={() => {
            if (typeof onToggleColorMode === 'function') onToggleColorMode();
          }}
          sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }}
          aria-label="toggle color mode"
        >
          {colorMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
        </IconButton>

        <IconButton sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }} aria-label="language">
          <TranslateOutlinedIcon />
        </IconButton>

        <IconButton sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }} aria-label="notifications">
          <Badge color="error" variant="dot" overlap="circular">
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>

        <Box
          sx={(theme) => ({
            ml: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            px: 1,
            py: 0.5,
            borderRadius: 999,
            '&:hover': {
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.06)
                  : alpha(theme.palette.common.black, 0.04),
            },
          })}
        >
          <Box
            sx={(theme) => ({
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.08)
                  : alpha(theme.palette.common.black, 0.06),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: 'text.secondary',
              fontSize: 12,
            })}
          >
            A
          </Box>
          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
            Admin
          </Typography>
          <KeyboardArrowDownRoundedIcon sx={{ color: 'text.secondary' }} />
        </Box>
      </Box>
    </Box>
  );
};

export default Header;
