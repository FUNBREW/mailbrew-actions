import { describe, test, expect, beforeEach } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, chmodSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { parse } from 'yaml';

/*
 * 入力（件名など）をスクリプトへ ${{ inputs.* }} で直接埋め込んだり eval したりすると、
 * 引用符や $(...) を含む値でスクリプトが壊れ、任意のコマンドが走る（GitHub の「script injection」）。
 * 入力は step の env で渡し、引数は配列で組む。ここでは実際に bash で流して、値がそのまま CLI に届くことを見る。
 */

function steps(name) {
    return parse(readFileSync(new URL(`../${name}/action.yml`, import.meta.url), 'utf-8')).runs.steps;
}

let dir;
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mb-action-'));
    // 受け取った引数を 1 行ずつ書き出すだけの偽の mailbrew
    writeFileSync(join(dir, 'mailbrew'), `#!/usr/bin/env bash
for a in "$@"; do printf '%s\\n' "$a" >> "${dir}/args"; done
if [ "$1" = "create-address" ]; then echo "t9xk2m@acme.mailbrew.dev  (expires: 2026-11-10T12:00:00Z)"; fi
if [ "$1" = "assert" ]; then echo '{"passed":true}'; fi
`);
    chmodSync(join(dir, 'mailbrew'), 0o755);
});

function runStep(step, env) {
    writeFileSync(join(dir, 'out'), '');
    writeFileSync(join(dir, 'summary'), '');
    execFileSync('bash', ['-e', '-c', step.run], {
        env: { PATH: `${dir}:${process.env.PATH}`, GITHUB_OUTPUT: join(dir, 'out'), GITHUB_STEP_SUMMARY: join(dir, 'summary'), GITHUB_ENV: join(dir, 'genv'), ...env },
    });
    return {
        args: existsSync(join(dir, 'args')) ? readFileSync(join(dir, 'args'), 'utf-8').trimEnd().split('\n') : [],
        out: readFileSync(join(dir, 'out'), 'utf-8'),
    };
}

describe.each(['setup', 'create-address', 'assert-email'])('%s', (name) => {
    test('run: に ${{ }} を直接書かない（入力は env で渡す）', () => {
        for (const step of steps(name)) {
            expect(step.run ?? '').not.toMatch(/\$\{\{/);
        }
    });

    test('eval を使わない', () => {
        for (const step of steps(name)) {
            expect(step.run ?? '').not.toMatch(/\beval\b/);
        }
    });
});

describe('assert-email の実行', () => {
    const step = () => steps('assert-email').find((s) => s.id === 'assert');

    test('引用符・$(...)・空白を含む件名が、そのまま 1 つの引数として届き、コマンドとして走らない', () => {
        const nasty = `He said "hi" $(touch ${'${MB_PWNED}'}) & ok`;
        const pwned = join(dir, 'pwned');
        const { args, out } = runStep(step(), {
            MB_ADDRESS: 'a@acme.mailbrew.dev', MB_TIMEOUT: '45', MB_SUBJECT: '', MB_SUBJECT_CONTAINS: nasty,
            MB_FROM: '', MB_TO: '', MB_BODY_CONTAINS: 'line; rm -rf /', MB_PWNED: pwned,
        });

        expect(args).toEqual(['assert', 'a@acme.mailbrew.dev', '--timeout', '45', '--subject-contains', nasty, '--body-contains', 'line; rm -rf /']);
        expect(existsSync(pwned)).toBe(false);
        expect(out).toContain('passed=true');
    });

    test('空の入力は引数に入れない', () => {
        const { args } = runStep(step(), {
            MB_ADDRESS: 'a@acme.mailbrew.dev', MB_TIMEOUT: '30', MB_SUBJECT: 'Welcome', MB_SUBJECT_CONTAINS: '',
            MB_FROM: '', MB_TO: '', MB_BODY_CONTAINS: '',
        });

        expect(args).toEqual(['assert', 'a@acme.mailbrew.dev', '--timeout', '30', '--subject', 'Welcome']);
    });

    test('step の env が、入力を MB_* に割り当てている', () => {
        expect(step().env).toMatchObject({
            MB_ADDRESS: '${{ inputs.address }}', MB_TIMEOUT: '${{ inputs.timeout }}', MB_SUBJECT: '${{ inputs.subject }}',
            MB_SUBJECT_CONTAINS: '${{ inputs.subject-contains }}', MB_FROM: '${{ inputs.from }}', MB_TO: '${{ inputs.to }}',
            MB_BODY_CONTAINS: '${{ inputs.body-contains }}',
        });
    });
});

describe('create-address の実行', () => {
    test('作ったアドレスを出力に書き、TTL を引数で渡す', () => {
        const step = steps('create-address').find((s) => s.id === 'create');
        const { args, out } = runStep(step, { MB_TTL: '300' });

        expect(args).toEqual(['create-address', '--ttl', '300']);
        expect(out).toContain('address=t9xk2m@acme.mailbrew.dev');
        expect(step.env).toMatchObject({ MB_TTL: '${{ inputs.ttl }}' });
    });
});

describe('setup の実行', () => {
    test('API キーと接続先を GITHUB_ENV に書く', () => {
        const step = steps('setup').find((s) => s.name.includes('Configure'));
        runStep(step, { MB_API_KEY: 'mb_test_key', MB_BASE_URL: 'https://mailbrew.dev' });

        expect(readFileSync(join(dir, 'genv'), 'utf-8')).toBe('MAILBREW_API_KEY=mb_test_key\nMAILBREW_BASE_URL=https://mailbrew.dev\n');
        expect(step.env).toMatchObject({ MB_API_KEY: '${{ inputs.api-key }}', MB_BASE_URL: '${{ inputs.base-url }}' });
    });
});
