import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared')
    }
  },
  server: {
    port: 5173,
    host: true, // 允许局域网访问，方便测试
    open: '/?devPanel=1' // 开发默认打开带调试面板参数
  },
  // 生产构建优化：确保开发代码被 Tree-Shaking 移除
  build: {
    rollupOptions: {
      output: {
        // 生产构建时，dev/ 目录下的模块不会被引用（import.meta.env.DEV = false）
        // Rollup 会自动 Tree-Shake 未使用的动态导入
        manualChunks: (id) => {
          // 开发工具单独打包（生产构建时因条件判断不会被加载）
          if (id.includes('/dev/')) {
            return 'dev-tools'
          }
        }
      }
    }
  },
  // 定义编译时常量，确保死代码消除
  define: {
    '__DEV_PANEL__': JSON.stringify(process.env.NODE_ENV !== 'production')
  }
})
