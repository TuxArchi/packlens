import { render } from 'preact';
import { App } from './App';
import { t, uiLocale } from '../core/i18n';
import '../ui/theme.css';

document.documentElement.lang = uiLocale();
document.title = t('extName');

const root = document.getElementById('app');
if (root) render(<App />, root);
