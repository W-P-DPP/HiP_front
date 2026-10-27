import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // Generated shadcn files export non-component values (buttonVariants, useSidebar)
  // and use the headless setState-in-effect pattern, which the fast-refresh and
  // hooks lint rules don't account for. use-pagination-query.ts 里的分页越界自动回落
  // 是 TanStack Query 官方推荐模式（query 落定后同步页码状态），同样豁免。
  {
    files: [
      'src/components/ui/**/*.{ts,tsx}',
      'src/hooks/use-mobile.ts',
      'src/hooks/use-pagination-query.ts',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
