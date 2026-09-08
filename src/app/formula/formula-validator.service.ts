import { Injectable } from '@angular/core';
import { FunctionDef, findFunction } from './expression-catalog';
import { Token, significantTokens, tokenize } from './formula-tokenizer';

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;
  start: number;
  end: number;
}

export interface FieldDef {
  name: string;
  description?: string;
  unit?: string;
}

/** Autocomplete context computed for a caret position. */
export interface CompletionContext {
  /** The identifier prefix currently being typed (may be empty). */
  word: string;
  /** Range in the source that a chosen suggestion should replace. */
  replaceStart: number;
  replaceEnd: number;
  /** The enclosing function call at the caret, if any. */
  activeFunction?: FunctionDef;
  /** Zero-based index of the argument the caret is currently in. */
  activeArgIndex: number;
}

const UNARY_OPERATORS = new Set(['-', '+', '!']);

interface Frame {
  def?: FunctionDef;
  name: string;
  isCall: boolean;
  argCount: number;
  argHasContent: boolean;
  start: number;
}

@Injectable({ providedIn: 'root' })
export class FormulaValidatorService {
  /**
   * Validate a formula string.
   * @param knownFields Optional list of valid field names. When empty, field
   *                    identifiers are not checked (any identifier is allowed).
   */
  validate(input: string, knownFields: ReadonlySet<string> = new Set()): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const sig = significantTokens(tokenize(input));
    if (sig.length === 0) return diagnostics;

    const stack: Frame[] = [];
    let expectValue = true;
    let pendingFunc: { def?: FunctionDef; name: string } | null = null;

    const top = () => stack.at(-1);
    const markContent = () => {
      const f = top();
      if (f) f.argHasContent = true;
    };

    for (const t of sig) {
      switch (t.type) {
        case 'function': {
          if (!expectValue) {
            diagnostics.push(err(`Unexpected function "${t.value}" — an operator is missing.`, t));
          }
          const def = findFunction(t.value);
          if (!def) {
            diagnostics.push(err(`Unknown function "${t.value}".`, t));
          }
          pendingFunc = { def, name: t.value };
          break;
        }

        case 'lparen': {
          if (pendingFunc) {
            stack.push({
              def: pendingFunc.def,
              name: pendingFunc.name,
              isCall: true,
              argCount: 0,
              argHasContent: false,
              start: t.start,
            });
            pendingFunc = null;
          } else {
            if (!expectValue) {
              diagnostics.push(err('Unexpected "(" — an operator is missing.', t));
            }
            stack.push({ name: '', isCall: false, argCount: 0, argHasContent: false, start: t.start });
          }
          expectValue = true;
          break;
        }

        case 'comma': {
          const f = top();
          if (!f) {
            diagnostics.push(err('"," is only valid inside a function call.', t));
          } else if (!f.isCall) {
            diagnostics.push(err('"," is not allowed inside grouping parentheses.', t));
          } else if (expectValue) {
            diagnostics.push(err('Empty argument before ",".', t));
            f.argCount++;
            f.argHasContent = false;
          } else {
            f.argCount++;
            f.argHasContent = false;
          }
          expectValue = true;
          break;
        }

        case 'rparen': {
          const f = stack.pop();
          if (!f) {
            diagnostics.push(err('Unmatched ")".', t));
            expectValue = false;
            break;
          }
          if (f.isCall) {
            const trailingEmpty = expectValue && f.argCount > 0 && !f.argHasContent;
            if (trailingEmpty) {
              diagnostics.push(err('Trailing empty argument before ")".', t));
            }
            const argCount = f.argCount + (f.argHasContent ? 1 : 0);
            if (f.def && !trailingEmpty) {
              const msg = arityError(f.def, argCount);
              if (msg) diagnostics.push({ message: msg, severity: 'error', start: f.start, end: t.end });
            }
          } else if (expectValue) {
            diagnostics.push({ message: 'Empty parentheses.', severity: 'error', start: f.start, end: t.end });
          }
          markContent();
          expectValue = false;
          break;
        }

        case 'identifier': {
          if (!expectValue) {
            diagnostics.push(err(`Unexpected "${t.value}" — an operator is missing.`, t));
          }
          if (knownFields.size > 0 && !knownFields.has(t.value)) {
            diagnostics.push({
              message: `Unknown field "${t.value}".`,
              severity: 'warning',
              start: t.start,
              end: t.end,
            });
          }
          markContent();
          expectValue = false;
          break;
        }

        case 'number': {
          if (!expectValue) {
            diagnostics.push(err(`Unexpected number "${t.value}" — an operator is missing.`, t));
          }
          markContent();
          expectValue = false;
          break;
        }

        case 'operator': {
          if (expectValue) {
            if (!UNARY_OPERATORS.has(t.value)) {
              diagnostics.push(err(`Unexpected operator "${t.value}".`, t));
            }
            // unary operator keeps expecting a value
          } else {
            expectValue = true;
          }
          break;
        }

        case 'unknown': {
          diagnostics.push(err(`Unexpected character "${t.value}".`, t));
          break;
        }
      }
    }

    // Unclosed function calls / groups.
    for (const f of stack) {
      diagnostics.push({
        message: f.isCall ? `Missing closing ")" for "${f.name}".` : 'Missing closing ")".',
        severity: 'error',
        start: f.start,
        end: f.start + 1,
      });
    }

    // Dangling operator / comma at the end.
    if (expectValue && stack.length === 0) {
      const last = sig.at(-1)!;
      if (last.type === 'operator' || last.type === 'comma') {
        diagnostics.push(err('Incomplete expression — expected a value.', last));
      }
    }

    return diagnostics.sort((a, b) => a.start - b.start);
  }

  /** Compute the autocomplete context for a caret position. */
  getCompletionContext(input: string, caret: number): CompletionContext {
    const tokens = tokenize(input);

    // Current word being typed (identifier ending at caret).
    let wordStart = caret;
    while (wordStart > 0 && /\w/.test(input[wordStart - 1])) wordStart--;
    const word = input.slice(wordStart, caret);
    // Do not treat a pure-number as an identifier prefix.
    const isWord = word.length > 0 && /[A-Za-z_]/.test(word[0]);

    // Walk tokens before the caret to find the enclosing call + argument index.
    const stack: Array<{ def?: FunctionDef; argIndex: number; isCall: boolean }> = [];
    let pendingFunc: FunctionDef | undefined | null = null;
    let pendingIsFunc = false;

    for (const t of tokens) {
      if (t.start >= caret) break;
      switch (t.type) {
        case 'function':
          pendingFunc = findFunction(t.value);
          pendingIsFunc = true;
          break;
        case 'lparen':
          stack.push(
            pendingIsFunc
              ? { def: pendingFunc ?? undefined, argIndex: 0, isCall: true }
              : { argIndex: 0, isCall: false },
          );
          pendingIsFunc = false;
          pendingFunc = null;
          break;
        case 'rparen':
          if (t.end <= caret) stack.pop();
          break;
        case 'comma': {
          const f = stack.at(-1);
          if (f?.isCall) f.argIndex++;
          break;
        }
        case 'whitespace':
          break;
        default:
          pendingIsFunc = false;
          pendingFunc = null;
          break;
      }
    }

    const activeCall = [...stack].reverse().find((f) => f.isCall);
    return {
      word: isWord ? word : '',
      replaceStart: isWord ? wordStart : caret,
      replaceEnd: caret,
      activeFunction: activeCall?.def,
      activeArgIndex: activeCall?.argIndex ?? 0,
    };
  }
}

function err(message: string, t: Token): Diagnostic {
  return { message, severity: 'error', start: t.start, end: t.end };
}

function arityError(def: FunctionDef, count: number): string | null {
  const { minArgs, maxArgs, name } = def;
  if (count < minArgs || (maxArgs !== null && count > maxArgs)) {
    if (maxArgs === null) {
      return `"${name}" expects at least ${minArgs} argument${minArgs === 1 ? '' : 's'} (got ${count}).`;
    }
    if (minArgs === maxArgs) {
      return `"${name}" expects exactly ${minArgs} argument${minArgs === 1 ? '' : 's'} (got ${count}).`;
    }
    return `"${name}" expects between ${minArgs} and ${maxArgs} arguments (got ${count}).`;
  }
  return null;
}
