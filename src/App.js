import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Prediction from './components/Prediction';
import Footer from './components/Footer';
import './App.css';

const COLOR_MODE_STORAGE_KEY = 'ui_color_mode';

function getInitialColorMode() {
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (e) {
    // ignore
  }

  try {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return prefersDark ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

function buildTheme(mode) {
  const isDark = mode === 'dark';

  const palette = {
    mode,
    // Blue-first brand palette (matches the portal theme)
    primary: {
      main: '#2f5bff',
      dark: '#1f3fff',
      light: '#6b8cff',
      contrastText: '#ffffff',
    },
    secondary: { main: '#4f7cff' },
    background: {
      // Slightly cool-tinted backgrounds so the UI feels "blue"
      default: isDark ? '#0b1220' : '#f3f6ff',
      paper: isDark ? '#111a2e' : '#ffffff',
    },
    text: {
      primary: isDark ? '#e5e7eb' : '#111827',
      secondary: isDark ? alpha('#e5e7eb', 0.72) : '#6b7280',
    },
    divider: isDark ? alpha('#94a3b8', 0.18) : alpha('#94a3b8', 0.35),
  };

  return createTheme({
    palette,
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: [
        'Pretendard',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Malgun Gothic"',
        '맑은 고딕',
        'sans-serif',
      ].join(','),
      fontSize: 14,
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    shadows: [
      'none',
      '0px 1px 2px rgba(15, 23, 42, 0.06)',
      '0px 4px 10px rgba(15, 23, 42, 0.08)',
      '0px 10px 24px rgba(15, 23, 42, 0.10)',
      ...new Array(21).fill('none'),
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: palette.background.default,
            color: palette.text.primary,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            border: `1px solid ${palette.divider}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: isDark ? alpha('#ffffff', 0.04) : alpha('#0f172a', 0.02),
            transition: 'box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease',
          },
          notchedOutline: {
            borderColor: alpha(palette.divider, isDark ? 1 : 0.9),
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: {
            // keeps dropdown/search fields crisp
            fontSize: 13,
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            paddingTop: 10,
            paddingBottom: 10,
          },
          icon: {
            color: palette.text.secondary,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${palette.divider}`,
            boxShadow: isDark ? '0px 10px 30px rgba(0, 0, 0, 0.45)' : '0px 12px 28px rgba(15, 23, 42, 0.12)',
            backgroundImage: 'none',
          },
          list: {
            paddingTop: 6,
            paddingBottom: 6,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            margin: '2px 6px',
            paddingTop: 10,
            paddingBottom: 10,
            '&:hover': {
              backgroundColor: alpha(palette.primary.main, isDark ? 0.16 : 0.08),
            },
            '&.Mui-selected': {
              backgroundColor: alpha(palette.primary.main, isDark ? 0.22 : 0.12),
            },
            '&.Mui-selected:hover': {
              backgroundColor: alpha(palette.primary.main, isDark ? 0.28 : 0.16),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 600,
          },
          outlined: {
            borderColor: palette.divider,
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: palette.text.secondary,
            '&.Mui-checked': {
              color: palette.primary.main,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: 'background-color 120ms ease, border-color 120ms ease',
            '&:hover': {
              backgroundColor: alpha(palette.primary.main, isDark ? 0.16 : 0.08),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${palette.divider}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 12,
            fontWeight: 600,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? alpha('#0f172a', 0.35) : '#f1f5f9',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            backgroundColor: isDark ? alpha('#0f172a', 0.35) : '#f1f5f9',
            borderBottom: `1px solid ${palette.divider}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 10,
            backgroundColor: isDark ? '#0f172a' : '#111827',
            fontSize: 12,
          },
        },
      },
    },
  });
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState('dashboard');
  const [shouldOpenHospitalMap, setShouldOpenHospitalMap] = useState(false);
  const [colorMode, setColorMode] = useState(getInitialColorMode);

  useEffect(() => {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
    } catch (e) {
      // ignore
    }
  }, [colorMode]);

  const theme = useMemo(() => buildTheme(colorMode), [colorMode]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleColorMode = () => {
    setColorMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleMenuClick = (menuId) => {
    if (menuId === 'hospital') {
      setActiveMenuId('dashboard');
      setShouldOpenHospitalMap(true);
    } else if (menuId === 'news' || menuId === 'weekly' || menuId === 'influenza') {
      // Dashboard 컴포넌트가 activeMenuId를 보고 다이얼로그를 엶
      setActiveMenuId(menuId);
    } else {
      setActiveMenuId(menuId);
    }
  };

  const handleHospitalMapOpened = () => {
    setShouldOpenHospitalMap(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={toggleSidebar}
          onMenuClick={handleMenuClick}
          activeMenuId={activeMenuId}
        />
        <Header isOpen={sidebarOpen} colorMode={colorMode} onToggleColorMode={toggleColorMode} />
        {activeMenuId === 'prediction' ? (
          <Prediction isOpen={sidebarOpen} />
        ) : (
          <Dashboard 
            isOpen={sidebarOpen}
            shouldOpenHospitalMap={shouldOpenHospitalMap}
            onHospitalMapOpened={handleHospitalMapOpened}
            activeMenuId={activeMenuId}
          />
        )}
        <Footer isOpen={sidebarOpen} />
      </div>
    </ThemeProvider>
  );
}

export default App;

