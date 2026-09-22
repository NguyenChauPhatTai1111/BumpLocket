import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),'');return {base:env.VITE_BASE_PATH||'/',plugins:[react(),tailwind()],build:{outDir:'../public/app',emptyOutDir:true},server:{proxy:{'/api':'http://127.0.0.1:8000'}}};});
