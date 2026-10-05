import { createRoot } from 'react-dom/client';
import Landing from './app/components/landing';
import './app/globals.css';
import './app/experience.css';
import './app/purchase.css';
import './app/loading.css';
import './app/large-screens.css';
import { installPortfolioScrollBridge } from './portfolio-scroll-bridge';

installPortfolioScrollBridge();
createRoot(document.getElementById('root')!).render(<Landing />);
