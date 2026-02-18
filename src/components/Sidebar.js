import React from 'react';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import AutoGraphOutlinedIcon from '@mui/icons-material/AutoGraphOutlined';
import NewspaperOutlinedIcon from '@mui/icons-material/NewspaperOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';

const Sidebar = ({ isOpen, onToggle, onMenuClick, activeMenuId = 'dashboard' }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardOutlinedIcon fontSize="small" /> },
    { id: 'prediction', label: 'AI Prediction', icon: <AutoGraphOutlinedIcon fontSize="small" /> },
    { id: 'news', label: '감염병 뉴스', icon: <NewspaperOutlinedIcon fontSize="small" /> },
    { id: 'weekly', label: '주간 발생 동향', icon: <InsightsOutlinedIcon fontSize="small" /> },
    { id: 'influenza', label: '인플루엔자란?', icon: <InfoOutlinedIcon fontSize="small" /> },
    { id: 'hospital', label: '근처 병원찾기', icon: <LocalHospitalOutlinedIcon fontSize="small" /> },
  ];

  return (
    <Box
      sx={{
        width: isOpen ? 240 : 64,
        height: '100vh',
        // Blue brand sidebar (similar to the reference UI)
        bgcolor: (theme) => theme.palette.primary.main,
        color: '#fff',
        borderRight: 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1000,
        transition: 'width 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* 로고 영역 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? 'space-between' : 'center',
          p: 2,
          borderBottom: `1px solid ${alpha('#ffffff', 0.18)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={onToggle}
            sx={{
              color: '#fff',
              p: 0.5,
              '&:hover': {
                backgroundColor: alpha('#ffffff', 0.14),
              },
            }}
          >
            <MenuRoundedIcon fontSize="small" />
          </IconButton>
          {isOpen && (
            <Typography
              variant="h6"
              sx={{
                color: '#fff',
                fontWeight: 800,
                fontSize: '1.05rem',
                whiteSpace: 'nowrap',
              }}
            >
              인플루엔자 정보 포털
            </Typography>
          )}
        </Box>
      </Box>

      {isOpen && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.8), fontWeight: 700, letterSpacing: '0.08em' }}>
            MENU
          </Typography>
        </Box>
      )}

      {/* 메뉴 항목 */}
      <List sx={{ flex: 1, p: 1.5, pt: 1 }}>
        {menuItems.map((item) => {
          const isActive = item.id === activeMenuId;
          return (
            <Tooltip key={item.id} title={!isOpen ? item.label : ''} placement="right">
              <ListItemButton
                onClick={() => onMenuClick && onMenuClick(item.id)}
                sx={(theme) => ({
                  mb: 0.75,
                  borderRadius: 2,
                  border: `1px solid ${isActive ? alpha('#ffffff', 0.40) : 'transparent'}`,
                  backgroundColor: isActive ? alpha('#ffffff', 0.16) : 'transparent',
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: isActive ? alpha('#ffffff', 0.20) : alpha('#ffffff', 0.12),
                    color: '#fff',
                  },
                  py: 1.25,
                  px: isOpen ? 1.5 : 1,
                  justifyContent: isOpen ? 'flex-start' : 'center',
                  minHeight: 44,
                  position: 'relative',
                  '&::before': isActive
                    ? {
                        content: '""',
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        backgroundColor: '#fff',
                      }
                    : undefined,
                })}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 34,
                    color: alpha('#ffffff', isActive ? 1 : 0.9),
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {isOpen && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.92rem',
                      fontWeight: isActive ? 700 : 500,
                      color: '#fff',
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>

      {/* 로그아웃 버튼 */}
      <Divider sx={{ borderColor: alpha('#ffffff', 0.18) }} />
      <Box sx={{ p: 1.5 }}>
        <Tooltip title={!isOpen ? '로그아웃' : ''} placement="right">
          <ListItemButton
            sx={(theme) => ({
              borderRadius: 2,
              color: alpha('#ffffff', 0.92),
              '&:hover': {
                backgroundColor: alpha('#ffffff', 0.12),
                color: '#fff',
              },
              py: 1.1,
              px: isOpen ? 1.5 : 1,
              justifyContent: isOpen ? 'flex-start' : 'center',
              minHeight: 44,
            })}
          >
            <ListItemIcon sx={{ minWidth: 34, color: 'inherit', justifyContent: 'center' }}>
              <LogoutOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {isOpen && (
              <ListItemText
                primary="로그아웃"
                primaryTypographyProps={{
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  color: 'inherit',
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default Sidebar;
