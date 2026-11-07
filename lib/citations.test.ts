import { describe, expect, test } from 'bun:test';
import { citeKeys, escapeBibtex, formatCitation, parseName, toBibtex, toRis, type CitablePaper } from './citations';

const paper: CitablePaper = {
  title: 'Attention Is All You Need',
  authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
  year: 2017,
  journal: 'Advances in Neural Information Processing Systems',
  doi: '10.5555/3295222.3295349',
};

describe('parseName', () => {
  test('splits "First Last"', () => {
    expect(parseName('Ada Lovelace')).toEqual({ family: 'Lovelace', given: 'Ada' });
  });

  test('keeps "Last, First" as written', () => {
    expect(parseName('Lovelace, Ada')).toEqual({ family: 'Lovelace', given: 'Ada' });
  });

  test('treats lowercase particles as part of the family name', () => {
    expect(parseName('Ludwig van Beethoven')).toEqual({ family: 'van Beethoven', given: 'Ludwig' });
    expect(parseName('Anna van der Berg')).toEqual({ family: 'van der Berg', given: 'Anna' });
  });

  test('drops generational suffixes', () => {
    expect(parseName('Martin Luther King Jr.')).toEqual({ family: 'King', given: 'Martin Luther' });
  });

  test('handles a single name and empty input', () => {
    expect(parseName('Plato')).toEqual({ family: 'Plato', given: '' });
    expect(parseName('   ')).toEqual({ family: '', given: '' });
  });
});

describe('citeKeys', () => {
  test('builds author + year + first meaningful title word', () => {
    expect(citeKeys([paper])).toEqual(['vaswani2017attention']);
  });

  test('folds accents and handles missing author or year', () => {
    expect(citeKeys([{ title: 'The Cell', authors: ['José Ñandú'], year: null }])).toEqual(['nandundcell']);
    expect(citeKeys([{ title: 'Untitled Study' }])).toEqual(['anonnduntitled']);
  });

  test('disambiguates collisions with a, b, c', () => {
    expect(citeKeys([paper, paper, paper])).toEqual(['vaswani2017attention', 'vaswani2017attentiona', 'vaswani2017attentionb']);
  });
});

describe('escapeBibtex', () => {
  test('escapes LaTeX special characters', () => {
    expect(escapeBibtex('R&D costs 50% of $1_000 #1')).toBe('R\\&D costs 50\\% of \\$1\\_000 \\#1');
    expect(escapeBibtex('{braces}')).toBe('\\{braces\\}');
  });
});

describe('toBibtex', () => {
  test('writes an @article with protected title and doi url', () => {
    const out = toBibtex([paper]);
    expect(out).toContain('@article{vaswani2017attention,');
    expect(out).toContain('author = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki}');
    expect(out).toContain('title = {{Attention Is All You Need}}');
    expect(out).toContain('doi = {10.5555/3295222.3295349}');
    expect(out).toContain('url = {https://doi.org/10.5555/3295222.3295349}');
  });

  test('uses @misc without a journal and omits empty fields', () => {
    const out = toBibtex([{ title: 'Preprint', authors: ['A B'], year: 2024 }]);
    expect(out.startsWith('@misc{')).toBe(true);
    expect(out).not.toContain('journal');
    expect(out).not.toContain('doi');
  });

  test('normalises a doi given as a URL', () => {
    expect(toBibtex([{ title: 'X', doi: 'https://doi.org/10.1/abc' }])).toContain('doi = {10.1/abc}');
  });

  test('separates entries with a blank line', () => {
    expect(toBibtex([paper, { ...paper, title: 'Other' }]).split('\n\n').length).toBe(2);
  });
});

describe('toRis', () => {
  test('writes tagged lines with CRLF and an ER terminator', () => {
    const out = toRis([paper]);
    const lines = out.split('\r\n');
    expect(lines[0]).toBe('TY  - JOUR');
    expect(lines).toContain('AU  - Vaswani, Ashish');
    expect(lines).toContain('TI  - Attention Is All You Need');
    expect(lines).toContain('PY  - 2017');
    expect(lines.at(-1)).toBe('ER  - ');
  });

  test('flattens multi-line abstracts to a single line', () => {
    expect(toRis([{ title: 'X', abstract: 'line one\n\nline two' }])).toContain('AB  - line one line two');
  });
});

describe('formatCitation', () => {
  test('APA with three authors', () => {
    expect(formatCitation(paper, 'apa')).toBe(
      'Vaswani, A., Shazeer, N., & Parmar, N. (2017). Attention Is All You Need. Advances in Neural Information Processing Systems. https://doi.org/10.5555/3295222.3295349',
    );
  });

  test('APA with one author, hyphenated given name and no year', () => {
    expect(formatCitation({ title: 'A study', authors: ['Jean-Paul Sartre'] }, 'apa')).toBe('Sartre, J.-P. (n.d.). A study.');
  });

  test('APA with two authors uses an ampersand', () => {
    expect(formatCitation({ title: 'T', authors: ['Ann Lee', 'Bo Chen'], year: 2020 }, 'apa')).toBe(
      'Lee, A., & Chen, B. (2020). T.',
    );
  });

  test('MLA with three or more authors uses et al.', () => {
    expect(formatCitation(paper, 'mla')).toBe(
      'Vaswani, Ashish, et al. “Attention Is All You Need.” Advances in Neural Information Processing Systems, 2017, https://doi.org/10.5555/3295222.3295349.',
    );
  });

  test('MLA with two authors', () => {
    expect(formatCitation({ title: 'T', authors: ['Ann Lee', 'Bo Chen'], year: 2020 }, 'mla')).toBe(
      'Lee, Ann, and Bo Chen. “T.” 2020.',
    );
  });

  test('does not double the full stop on titles that already end in punctuation', () => {
    expect(formatCitation({ title: 'Why?', authors: ['A B'], year: 2020 }, 'apa')).toBe('B, A. (2020). Why?');
  });
});
