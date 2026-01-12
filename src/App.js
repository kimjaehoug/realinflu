import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Footer from './components/Footer';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1e3a8a',
      light: '#3b82f6',
      dark: '#1e40af',
    },
    secondary: {
      main: '#0369a1',
    },
    background: {
      default: '#f3f4f6',
      paper: '#ffffff',
    },
  },
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
  },
  components: {
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#f1f5f9',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#f1f5f9',
          borderBottom: '2px solid #cbd5e1',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        <Header />
        <Dashboard />
        <Footer />
      </div>
    </ThemeProvider>
  );
}

export default App;

