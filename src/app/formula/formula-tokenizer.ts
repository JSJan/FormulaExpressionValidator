/**
 * Lightweight tokenizer for the expression language.
 * Produces positional tokens used for syntax highlighting, validation and
 * autocomplete context detection.
 */

export type TokenType =
  | 'function' // identifier immediately followed by '('
  | 'identifier' // a field / variable reference
  | 'number'
  | 'operator'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'whitespace'
  | 'unknown';

export interface Token {
  type: TokenType;
  value: string;
  /** Inclusive start index into the source string. */
  start: number;
  /** Exclusive end index into the source string. */
  end: number;
}

const OPERATOR_CHARS = new Set(['+', '-', '*', '/', '^', '<', '>', '=', '!', '&', '|', '%']);
const MULTI_CHAR_OPERATORS = new Set(['==', '!=', '>=', '<=', '&&', '||']);

const isIdentStart = (ch: string) => /[A-Za-z_]/.test(ch);
const isIdentPart = (ch: string) => /\w/.test(ch);
const isDigit = (ch: string) => /\d/.test(ch);
const isSpace = (ch: string) => /\s/.test(ch);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    // Whitespace
    if (isSpace(ch)) {
      const start = i;
      while (i < n && isSpace(input[i])) i++;
      tokens.push({ type: 'whitespace', value: input.slice(start, i), start, end: i });
      continue;
    }

    // Identifier or function
    if (isIdentStart(ch)) {
      const start = i;
      i++;
      while (i < n && isIdentPart(input[i])) i++;
      const value = input.slice(start, i);
      // Look past whitespace to see if a '(' follows -> it's a function call.
      let j = i;
      while (j < n && isSpace(input[j])) j++;
      const type: TokenType = input[j] === '(' ? 'function' : 'identifier';
      tokens.push({ type, value, start, end: i });
      continue;
    }

    // Number (integer or decimal, optional scientific notation)
    if (isDigit(ch) || (ch === '.' && isDigit(input[i + 1] ?? ''))) {
      const start = i;
      i++;
      while (i < n && (isDigit(input[i]) || input[i] === '.')) i++;
      if (input[i] === 'e' || input[i] === 'E') {
        i++;
        if (input[i] === '+' || input[i] === '-') i++;
        while (i < n && isDigit(input[i])) i++;
      }
      tokens.push({ type: 'number', value: input.slice(start, i), start, end: i });
      continue;
    }

    // Parentheses / comma
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    // Operators (multi-char first)
    if (OPERATOR_CHARS.has(ch)) {
      const two = input.slice(i, i + 2);
      if (MULTI_CHAR_OPERATORS.has(two)) {
        tokens.push({ type: 'operator', value: two, start: i, end: i + 2 });
        i += 2;
        continue;
      }
      tokens.push({ type: 'operator', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    // Anything else is unknown / invalid
    tokens.push({ type: 'unknown', value: ch, start: i, end: i + 1 });
    i++;
  }

  return tokens;
}

/** Tokens excluding whitespace, useful for structural analysis. */
export function significantTokens(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.type !== 'whitespace');
}
