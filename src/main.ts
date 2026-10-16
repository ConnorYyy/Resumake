import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';
import { initTelemetry } from './services/telemetry';

const app = createApp(App);

// 只上报程序异常、不含简历内容；未配置 DSN 或本地开发时不发送
initTelemetry(app);

app.use(createPinia()).mount('#app');
