#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const repoRoot = path.resolve(__dirname, '..');
const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

const bannedEnvRegex = /process\.env\.DIFY_API_BASE|process\.env\.NEXT_PUBLIC_DIFY_API_BASE|NEXT_PUBLIC_DIFY_API_BASE|DIFY_API_BASE/g;
const clientFetchDifyRegex = /fetch\([^)]*['\"][^'\"]*dify[^'\"]*['\"]/ig;
const commentLineRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
const japaneseChar = /[\u3040-\u30FF\u4E00-\u9FFF]/; // hiragana/katakana/kanji

let errors = [];
let warnings = [];

// Gather files under apps/web (client and server) to analyze
const files = glob.sync(patterns.join('|'), { cwd: repoRoot, absolute: true, ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'] });

files.forEach(file => {
  const rel = path.relative(repoRoot, file);
  const content = read(file);

  // 1) banned env usage anywhere
  if (bannedEnvRegex.test(content)) {
    errors.push(`${rel}: 禁止された環境変数が直接参照されています (DIFY_API_BASE/NEXT_PUBLIC_DIFY_API_BASE)。`);
  }

  // 2) client-side direct fetch to external Dify-like URLs (heuristic)
  // Only consider files under apps/web/app as client/server; we warn if a file under apps/web/app contains http fetch to a url containing 'dify' or 'api.dify'
  if (rel.startsWith('apps/web/app') && clientFetchDifyRegex.test(content)) {
    const isApiRoute = rel.includes('app/api/dify') || rel.includes('app/api/dify/');
    if (!isApiRoute) {
      warnings.push(`${rel}: クライアント側(?)で Dify へ直接 fetch をしている可能性があります。サーバー Route (apps/web/app/api/dify) 経由にしてください。`);
    }
  }

  // 3) comment language check: warn if file has comment lines but none containing Japanese chars
  const comments = content.match(commentLineRegex);
  if (comments && comments.length > 0) {
    const anyJapanese = comments.some(c => japaneseChar.test(c));
    if (!anyJapanese) {
      warnings.push(`${rel}: コメントに日本語が含まれていません。コメントは日本語で記載してください。`);
    }
  }
});

console.log('AI Implementation Rules validation');
console.log('===================================');

if (errors.length > 0) {
  console.error('\nErrors:');
  errors.forEach(e => console.error(' - ' + e));
}
if (warnings.length > 0) {
  console.warn('\nWarnings:');
  warnings.forEach(w => console.warn(' - ' + w));
}

if (errors.length > 0) {
  console.error('\n検査に失敗しました。上記のエラーを解消してください。');
  process.exit(2);
}

if (warnings.length > 0) {
  console.warn('\n検査は完了しました（警告あり）。必要に応じて警告を修正してください。');
  process.exit(1);
}

console.log('\n検査は完了しました。違反は検出されませんでした。');
process.exit(0);
