import tseslint from '@electron-toolkit/eslint-config-ts'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'build/**', '.worktrees/**', '*.config.*'] },
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
)
