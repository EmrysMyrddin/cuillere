module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.ts', '.js'],
      },
    },
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.spec.js'],
      plugins: ['jest'],
      extends: ['plugin:jest/recommended'],
      env: {
        'jest/globals': true,
      },
      rules: {
        'jest/expect-expect': 'off',
        'jest/no-disabled-tests': 'off',
      },
    },
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/member-delimiter-style': ['error', {
      multiline: {
        delimiter: 'none',
        requireLast: false,
      },
      singleline: {
        delimiter: 'semi',
        requireLast: false,
      },
    }],
    'arrow-parens': [2, 'as-needed', { requireForBlockBody: true }],
    'consistent-return': 'off',
    'func-names': 'off',
    'implicit-arrow-linebreak': 'off',
    'import/extensions': ['error', {
      ts: 'never',
    }],
    'import/no-extraneous-dependencies': 'off',
    'import/prefer-default-export': 'off',
    indent: 'off',
    'max-classes-per-file': 'off',
    'max-len': ['error', { code: 160 }],
    'no-await-in-loop': 'off',
    'no-cond-assign': 'off',
    'no-console': 'off',
    'no-continue': 'off',
    'no-dupe-class-members': 'off',
    'no-multi-assign': 'off',
    'no-multiple-empty-lines': ['warn', { max: 1 }],
    'no-new-wrappers': 'off',
    'no-param-reassign': ['error', { props: false }],
    'no-plusplus': 'off',
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      // disable this one in order to allow sequentially awaiting on a list of promises
      // {
      //     selector: 'ForOfStatement',
      //     message: 'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.',
      // },
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],
    'no-return-assign': 'off',
    'no-shadow': 'off',
    'no-use-before-define': 'off',
    'object-curly-newline': ['error', { consistent: true }],
    'object-shorthand': ['error', 'always', { avoidQuotes: false }],
    'require-yield': 'off',
    semi: ['error', 'never'],
  },
}
