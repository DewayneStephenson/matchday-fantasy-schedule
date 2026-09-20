import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../styles.css';
import './enhancements.css';
import './bracket.css';
import './forecast.css';
import './scenario.css';
import './live.css';
import './layout-fixes.css';
import './standings.css';
import './live-bracket.css';
import './full-bracket.css';
import './helmets.css';
import './interactive-bracket.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
