import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['next-env.d.ts', '.next/**', 'storage*/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { files: ['tests/**/*.ts', 'e2e/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off', 'react-hooks/rules-of-hooks': 'off' } },
];

export default config;
