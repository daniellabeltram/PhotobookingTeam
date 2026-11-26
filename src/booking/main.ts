import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/booking.css';
import { boot } from './app';

const main = document.getElementById('main');
if (main) void boot(main);
