import { render } from 'preact';
import { t, uiLocale } from '../core/i18n';
import { Options } from './Options';
import '../ui/theme.css';

document.documentElement.lang = uiLocale();
document.title = t('options.title');

const root = document.getElementById('app');
if (root) render(<Options />, root);
