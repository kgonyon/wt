import { describe, it, expect } from 'bun:test';
import { buildPortVars, substitutePortVars, processLine, applyReplacements } from './env';

describe('buildPortVars', () => {
  it('builds WT_PORT_N vars from port array', () => {
    const vars = buildPortVars([3000, 3001, 3002]);
    expect(vars).toEqual({
      WT_PORT_1: '3000',
      WT_PORT_2: '3001',
      WT_PORT_3: '3002',
    });
  });

  it('returns empty object for empty array', () => {
    expect(buildPortVars([])).toEqual({});
  });

  it('handles single port', () => {
    expect(buildPortVars([8080])).toEqual({ WT_PORT_1: '8080' });
  });
});

describe('substitutePortVars', () => {
  const portVars = { WT_PORT_1: '3000', WT_PORT_2: '3001' };

  it('substitutes ${WT_PORT_N} placeholders', () => {
    expect(substitutePortVars('http://localhost:${WT_PORT_1}', portVars)).toBe(
      'http://localhost:3000',
    );
  });

  it('substitutes multiple placeholders', () => {
    expect(
      substitutePortVars('${WT_PORT_1}:${WT_PORT_2}', portVars),
    ).toBe('3000:3001');
  });

  it('leaves unknown WT_PORT vars as-is', () => {
    expect(substitutePortVars('${WT_PORT_99}', portVars)).toBe('${WT_PORT_99}');
  });

  it('returns string unchanged if no placeholders', () => {
    expect(substitutePortVars('no-vars-here', portVars)).toBe('no-vars-here');
  });
});

describe('processLine', () => {
  const replace = { DATABASE_URL: 'postgres://localhost:${WT_PORT_1}/db' };
  const portVars = { WT_PORT_1: '5432' };

  it('replaces matching key with substituted value', () => {
    expect(processLine('DATABASE_URL=old_value', replace, portVars)).toBe(
      'DATABASE_URL=postgres://localhost:5432/db',
    );
  });

  it('leaves non-matching keys unchanged', () => {
    expect(processLine('API_KEY=secret', replace, portVars)).toBe(
      'API_KEY=secret',
    );
  });

  it('leaves comment lines unchanged', () => {
    expect(processLine('# This is a comment', replace, portVars)).toBe(
      '# This is a comment',
    );
  });

  it('leaves empty lines unchanged', () => {
    expect(processLine('', replace, portVars)).toBe('');
  });

  it('handles keys with no value in replace map', () => {
    const r = { PORT: '${WT_PORT_1}' };
    expect(processLine('PORT=3000', r, portVars)).toBe('PORT=5432');
  });
});

describe('applyReplacements', () => {
  const replace = {
    PORT: '${WT_PORT_1}',
    HOST: 'localhost',
  };
  const portVars = { WT_PORT_1: '3000' };

  it('replaces all matching lines in content', () => {
    const content = 'PORT=8080\nHOST=0.0.0.0\nOTHER=value';
    const result = applyReplacements(content, replace, portVars);
    expect(result).toBe('PORT=3000\nHOST=localhost\nOTHER=value');
  });

  it('preserves comments and empty lines', () => {
    const content = '# comment\n\nPORT=8080';
    const result = applyReplacements(content, replace, portVars);
    expect(result).toBe('# comment\n\nPORT=3000');
  });

  it('handles content with no replacements', () => {
    const content = 'UNKNOWN=value\nANOTHER=thing';
    const result = applyReplacements(content, replace, portVars);
    expect(result).toBe(content);
  });
});
