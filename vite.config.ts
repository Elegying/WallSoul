import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({
 plugins:[react()],publicDir:mode==='desktop'?false:'resources',
 server:{port:1420,strictPort:true,watch:{
  usePolling:false,
  // Only frontend sources need HMR; generated assets and native build trees can be gigabytes.
  ignored:['**/src-tauri/**','**/artifacts/**','**/assets-source/**','**/tools/**','**/.local-*/**'],
 }},clearScreen:false,
}));
