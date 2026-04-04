import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parse } from 'yaml';

function loadAction(name) {
    const content = readFileSync(new URL(`../${name}/action.yml`, import.meta.url), 'utf-8');
    return parse(content);
}

describe('setup action.yml', () => {
    const action = loadAction('setup');

    test('has required fields', () => {
        expect(action.name).toBe('BrewMail Setup');
        expect(action.runs.using).toBe('composite');
    });

    test('api-key input is required', () => {
        expect(action.inputs['api-key'].required).toBe(true);
    });

    test('base-url has default', () => {
        expect(action.inputs['base-url'].default).toBe('https://brewmail.dev');
    });

    test('has install, configure, and verify steps', () => {
        expect(action.runs.steps.length).toBe(3);
        expect(action.runs.steps[0].name).toContain('Install');
        expect(action.runs.steps[1].name).toContain('Configure');
        expect(action.runs.steps[2].name).toContain('Verify');
    });
});

describe('create-address action.yml', () => {
    const action = loadAction('create-address');

    test('has required fields', () => {
        expect(action.name).toBe('BrewMail Create Address');
        expect(action.runs.using).toBe('composite');
    });

    test('ttl has default value', () => {
        expect(action.inputs.ttl.default).toBe('3600');
    });

    test('outputs address', () => {
        expect(action.outputs.address).toBeDefined();
    });
});

describe('assert-email action.yml', () => {
    const action = loadAction('assert-email');

    test('has required fields', () => {
        expect(action.name).toBe('BrewMail Assert Email');
        expect(action.runs.using).toBe('composite');
    });

    test('address input is required', () => {
        expect(action.inputs.address.required).toBe(true);
    });

    test('assertion inputs are optional', () => {
        expect(action.inputs.subject.required).toBeFalsy();
        expect(action.inputs['subject-contains'].required).toBeFalsy();
        expect(action.inputs.from.required).toBeFalsy();
        expect(action.inputs['body-contains'].required).toBeFalsy();
    });

    test('timeout has default', () => {
        expect(action.inputs.timeout.default).toBe('30');
    });

    test('outputs passed and result', () => {
        expect(action.outputs.passed).toBeDefined();
        expect(action.outputs.result).toBeDefined();
    });

    test('step writes to GITHUB_STEP_SUMMARY', () => {
        const runScript = action.runs.steps[0].run;
        expect(runScript).toContain('GITHUB_STEP_SUMMARY');
    });
});
