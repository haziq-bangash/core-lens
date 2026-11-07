/**
 * Citation formatting for library papers: BibTeX, RIS, APA 7 and MLA 9.
 * Pure functions with no server or DOM dependencies, so they are safe to use on the client.
 */

export interface CitablePaper {
  id?: string;
  title: string;
  authors?: string[] | null;
  year?: number | null;
  doi?: string | null;
  journal?: string | null;
  abstract?: string | null;
  sourceUrl?: string | null;
}

export type CitationStyle = 'apa' | 'mla';

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

export interface ParsedName {
  family: string;
  given: string;
}

const NAME_PARTICLES = new Set(['van', 'von', 'de', 'der', 'den', 'del', 'della', 'di', 'da', 'dos', 'du', 'la', 'le', 'bin', 'ibn', 'al', 'el', 'st']);
const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);

/** Splits "Ada Lovelace", "Lovelace, Ada" or "Ludwig van Beethoven" into family and given names. */
export function parseName(raw: string): ParsedName {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { family: '', given: '' };

  if (name.includes(',')) {
    const [family, ...rest] = name.split(',');
    return { family: family.trim(), given: rest.join(' ').trim() };
  }

  const tokens = name.split(' ');
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1].toLowerCase())) tokens.pop();

  if (tokens.length === 1) return { family: tokens[0], given: '' };

  // The family name is the last word plus any lowercase particles right before it ("van der Berg").
  let familyStart = tokens.length - 1;
  while (familyStart > 1 && NAME_PARTICLES.has(tokens[familyStart - 1].toLowerCase())) familyStart--;

  return { family: tokens.slice(familyStart).join(' '), given: tokens.slice(0, familyStart).join(' ') };
}

/** "Jean-Paul Marie" -> "J.-P. M."; already-abbreviated initials are kept. */
function toInitials(given: string): string {
  return given
    .split(' ')
    .filter(Boolean)
    .map((word) =>
      word
        .split('-')
        .filter(Boolean)
        .map((part) => `${part[0].toUpperCase()}.`)
        .join('-'),
    )
    .join(' ');
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

function paperUrl(paper: CitablePaper): string | null {
  const doi = clean(paper.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  if (doi) return `https://doi.org/${doi}`;
  return clean(paper.sourceUrl) || null;
}

const authorList = (paper: CitablePaper) => (paper.authors ?? []).map(parseName).filter((a) => a.family);

const ascii = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

const TITLE_STOP_WORDS = new Set(['a', 'an', 'the', 'on', 'of', 'in', 'for', 'and', 'to', 'with', 'from', 'by', 'at']);

function baseCiteKey(paper: CitablePaper): string {
  const family = ascii(authorList(paper)[0]?.family ?? '') || 'anon';
  const year = paper.year ? String(paper.year) : 'nd';
  const word =
    clean(paper.title)
      .split(' ')
      .map(ascii)
      .find((w) => w.length > 2 && !TITLE_STOP_WORDS.has(w)) ?? '';
  return `${family}${year}${word}`;
}

/** Cite keys for a list of papers, made unique with a, b, c... suffixes where they collide. */
export function citeKeys(papers: CitablePaper[]): string[] {
  const seen = new Map<string, number>();
  return papers.map((paper) => {
    const base = baseCiteKey(paper);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}${String.fromCharCode(96 + count)}`;
  });
}

// ---------------------------------------------------------------------------
// BibTeX
// ---------------------------------------------------------------------------

/** Escapes characters that are special to LaTeX inside a BibTeX field value. */
export function escapeBibtex(value: string): string {
  return value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

export function toBibtex(papers: CitablePaper[]): string {
  const keys = citeKeys(papers);

  return papers
    .map((paper, index) => {
      const authors = authorList(paper)
        .map((a) => (a.given ? `${a.family}, ${a.given}` : a.family))
        .join(' and ');
      const url = paperUrl(paper);
      const journal = clean(paper.journal);

      const fields: Array<[string, string | null]> = [
        ['author', authors ? escapeBibtex(authors) : null],
        // Double braces stop BibTeX styles from lower-casing the title.
        ['title', `{${escapeBibtex(clean(paper.title))}}`],
        ['journal', journal ? escapeBibtex(journal) : null],
        ['year', paper.year ? String(paper.year) : null],
        ['doi', clean(paper.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') || null],
        ['url', url],
        ['abstract', clean(paper.abstract) ? escapeBibtex(clean(paper.abstract)) : null],
      ];

      const body = fields
        .filter((entry): entry is [string, string] => entry[1] !== null)
        .map(([name, value]) => `  ${name} = {${value}}`)
        .join(',\n');

      return `@${journal ? 'article' : 'misc'}{${keys[index]},\n${body}\n}`;
    })
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// RIS
// ---------------------------------------------------------------------------

export function toRis(papers: CitablePaper[]): string {
  return papers
    .map((paper) => {
      const journal = clean(paper.journal);
      const doi = clean(paper.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
      const url = paperUrl(paper);

      const lines: Array<[string, string | null]> = [
        ['TY', journal ? 'JOUR' : 'GEN'],
        ...authorList(paper).map((a): [string, string] => ['AU', a.given ? `${a.family}, ${a.given}` : a.family]),
        ['TI', clean(paper.title)],
        ['JO', journal || null],
        ['PY', paper.year ? String(paper.year) : null],
        ['DO', doi || null],
        ['UR', url],
        ['AB', clean(paper.abstract) || null],
      ];

      return [
        ...lines.filter((l): l is [string, string] => l[1] !== null).map(([tag, value]) => `${tag}  - ${value}`),
        'ER  - ',
      ].join('\r\n');
    })
    .join('\r\n\r\n');
}

// ---------------------------------------------------------------------------
// APA 7 and MLA 9 (plain text)
// ---------------------------------------------------------------------------

const endWithPeriod = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

function formatApa(paper: CitablePaper): string {
  const authors = authorList(paper).map((a) => (a.given ? `${a.family}, ${toInitials(a.given)}` : a.family));

  let authorText = '';
  if (authors.length === 1) authorText = authors[0];
  else if (authors.length === 2) authorText = `${authors[0]}, & ${authors[1]}`;
  else if (authors.length > 2) authorText = `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;

  const year = paper.year ? String(paper.year) : 'n.d.';
  const title = endWithPeriod(clean(paper.title));
  const journal = clean(paper.journal);
  const url = paperUrl(paper);

  const parts = [
    authorText ? endWithPeriod(authorText) : null,
    `(${year}).`,
    title,
    journal ? endWithPeriod(journal) : null,
    url,
  ];
  return parts.filter(Boolean).join(' ');
}

function formatMla(paper: CitablePaper): string {
  const people = authorList(paper);

  let authorText = '';
  if (people.length === 1) authorText = people[0].given ? `${people[0].family}, ${people[0].given}` : people[0].family;
  else if (people.length === 2) {
    const [first, second] = people;
    authorText = `${first.given ? `${first.family}, ${first.given}` : first.family}, and ${second.given ? `${second.given} ` : ''}${second.family}`;
  } else if (people.length > 2) {
    authorText = `${people[0].given ? `${people[0].family}, ${people[0].given}` : people[0].family}, et al`;
  }

  const title = `“${endWithPeriod(clean(paper.title))}”`;
  const journal = clean(paper.journal);
  const url = paperUrl(paper);

  const container = [journal || null, paper.year ? String(paper.year) : null, url].filter(Boolean).join(', ');

  return [authorText ? endWithPeriod(authorText) : null, title, container ? endWithPeriod(container) : null]
    .filter(Boolean)
    .join(' ');
}

export function formatCitation(paper: CitablePaper, style: CitationStyle): string {
  return style === 'apa' ? formatApa(paper) : formatMla(paper);
}
