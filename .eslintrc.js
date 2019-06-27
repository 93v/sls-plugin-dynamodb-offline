module.exports = {
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2018 },
  env: { browser: true, node: true, es6: true },
  globals: { module: true, process: true, require: true },
  rules: {
    eqeqeq: ['error', 'allow-null'],
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'max-len': ['error', 80],
    'no-alert': 'off',
    'no-console': ['error', { allow: ['log', 'warn', 'info', 'error'] }],
    'no-inline-comments': 'error',
    'no-native-reassign': 'off',
    'no-undef': 'error',
    'no-unused-vars': 'warn',
    semi: ['error', 'always'],
    'space-before-function-paren': [
      'error',
      { anonymous: 'always', named: 'never' },
    ],
    strict: ['error', 'safe'],
    'comma-dangle': ['error', 'always-multiline'],
    'new-cap': ['error', { capIsNew: false }],
    'require-jsdoc': [
      'error',
      {
        require: {
          FunctionDeclaration: false,
          MethodDefinition: false,
          ClassDeclaration: false,
        },
      },
    ],
  },
};
