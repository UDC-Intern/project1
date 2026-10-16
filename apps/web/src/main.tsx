import '@fontsource/andika/400.css';
import '@fontsource/andika/700.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import './styles/uk-tokens.css';
import './styles/uk-components.css';
import './styles/uk-adult.css';
import './styles/play.css';
import './styles/peta.css';
import './styles/site.css';
import './styles/adminCharts.css';
import './styles/billing.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { installAudioUnlock } from './audio/speech';

installAudioUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
