import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/booking.css';
import '../styles/admin.css';
import { AdminApp } from './app';

const root = document.getElementById('admin-root');
if (root) void new AdminApp(root).start();
