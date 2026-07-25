/** Commit format: type(scope): description AB#ticket — see SDS Section 32.4. */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'refactor', 'test', 'docs'],
    ],
    'scope-enum': [
      2,
      'always',
      ['auth', 'notes', 'tags', 'search', 'share', 'versions', 'shared', 'config','e2e'],
    ],
    'scope-empty': [2, 'never'],
  },
};
