import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { CATEGORIES, FUNCTIONS, FunctionDef, exampleFor } from './expression-catalog';
import { Token, tokenize } from './formula-tokenizer';
import {
  CompletionContext,
  Diagnostic,
  FieldDef,
  FormulaValidatorService,
} from './formula-validator.service';

interface HighlightSegment {
  text: string;
  cls: string;
}

interface Suggestion {
  kind: 'function' | 'field';
  name: string;
  detail: string;
  description: string;
  category?: string;
  func?: FunctionDef;
}

const ZERO_ARG = (f: FunctionDef) => f.minArgs === 0 && f.maxArgs === 0;

@Component({
  selector: 'app-formula-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formula-editor.component.html',
  styleUrls: ['./formula-editor.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FormulaEditorComponent),
      multi: true,
    },
  ],
})
export class FormulaEditorComponent implements AfterViewInit, OnChanges, ControlValueAccessor {
  /** Available fields/variables the user can reference. */
  @Input() fields: FieldDef[] = [];
  @Input() placeholder = 'Type a formula, e.g. Add(A1, A2)';

  @Output() valueChange = new EventEmitter<string>();
  @Output() validChange = new EventEmitter<boolean>();
  @Output() diagnosticsChange = new EventEmitter<Diagnostic[]>();

  @ViewChild('input', { static: true }) inputRef!: ElementRef<HTMLInputElement>;

  value = '';
  highlightSegments: HighlightSegment[] = [];
  diagnostics: Diagnostic[] = [];

  suggestions: Suggestion[] = [];
  showSuggestions = false;
  activeSuggestion = 0;

  context: CompletionContext | null = null;

  private fieldSet: ReadonlySet<string> = new Set();
  private disabled = false;

  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(private validator: FormulaValidatorService) {}

  ngAfterViewInit(): void {
    this.recompute();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      this.fieldSet = new Set(this.fields.map((f) => f.name));
    }
  }

  // ---- ControlValueAccessor ----
  writeValue(value: string): void {
    this.value = value ?? '';
    if (this.inputRef) {
      this.inputRef.nativeElement.value = this.value;
      this.recompute();
    }
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
  get isDisabled(): boolean {
    return this.disabled;
  }

  // ---- Event handlers ----
  onInput(): void {
    const el = this.inputRef.nativeElement;
    this.value = el.value;
    const caret = el.selectionStart ?? this.value.length;
    this.recompute();
    this.updateContext(caret, true);
    this.emit();
  }

  onCaretMove(): void {
    const el = this.inputRef.nativeElement;
    const caret = el.selectionStart ?? this.value.length;
    this.updateContext(caret, false);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.showSuggestions && this.suggestions.length > 0) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.activeSuggestion = (this.activeSuggestion + 1) % this.suggestions.length;
          this.scrollActiveIntoView();
          return;
        case 'ArrowUp':
          event.preventDefault();
          this.activeSuggestion =
            (this.activeSuggestion - 1 + this.suggestions.length) % this.suggestions.length;
          this.scrollActiveIntoView();
          return;
        case 'Enter':
        case 'Tab':
          event.preventDefault();
          this.applySuggestion(this.suggestions[this.activeSuggestion]);
          return;
        case 'Escape':
          event.preventDefault();
          this.showSuggestions = false;
          return;
      }
    }

    // Ctrl/Cmd+Space to force-open suggestions.
    if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
      event.preventDefault();
      const caret = this.inputRef.nativeElement.selectionStart ?? this.value.length;
      this.updateContext(caret, true, true);
    }
  }

  onBlur(): void {
    this.onTouched();
    // Delay so a click on a suggestion still registers.
    setTimeout(() => (this.showSuggestions = false), 150);
  }

  // ---- Suggestions ----
  applySuggestion(s: Suggestion): void {
    if (!this.context) return;
    const { replaceStart, replaceEnd } = this.context;
    let insert: string;
    let caretOffset: number;

    if (s.kind === 'function') {
      const zero = s.func ? ZERO_ARG(s.func) : false;
      insert = `${s.name}()`;
      caretOffset = zero ? insert.length : s.name.length + 1;
    } else {
      insert = s.name;
      caretOffset = insert.length;
    }

    const next = this.value.slice(0, replaceStart) + insert + this.value.slice(replaceEnd);
    const caret = replaceStart + caretOffset;

    this.value = next;
    const el = this.inputRef.nativeElement;
    el.value = next;
    el.focus();
    el.setSelectionRange(caret, caret);

    this.showSuggestions = false;
    this.recompute();
    this.updateContext(caret, true);
    this.emit();
  }

  onSuggestionHover(i: number): void {
    this.activeSuggestion = i;
  }

  // ---- Internal ----
  private recompute(): void {
    const tokens = tokenize(this.value);
    this.highlightSegments = this.buildSegments(tokens);
    this.diagnostics = this.validator.validate(this.value, this.fieldSet);
    this.diagnosticsChange.emit(this.diagnostics);
    this.validChange.emit(this.diagnostics.every((d) => d.severity !== 'error'));
  }

  private updateContext(caret: number, allowOpen: boolean, force = false): void {
    const ctx = this.validator.getCompletionContext(this.value, caret);
    this.context = ctx;

    const items = this.buildSuggestions(ctx.word);
    this.suggestions = items;
    this.activeSuggestion = 0;

    if (!allowOpen) {
      // Only refresh the argument hint, keep dropdown state as-is unless empty.
      if (items.length === 0) this.showSuggestions = false;
      return;
    }

    const trigger = force || ctx.word.length > 0 || !!ctx.activeFunction;
    this.showSuggestions = trigger && items.length > 0;
  }

  private buildSuggestions(word: string): Suggestion[] {
    const lower = word.toLowerCase();
    const fromFunctions: Suggestion[] = FUNCTIONS.map((f) => ({
      kind: 'function' as const,
      name: f.name,
      detail: f.signature,
      description: f.summary,
      category: f.category,
      func: f,
    }));
    const fromFields: Suggestion[] = this.fields.map((f) => ({
      kind: 'field' as const,
      name: f.name,
      detail: [f.unit, f.description].filter(Boolean).join(' · ') || 'Field',
      description: f.description ?? 'Field / variable reference.',
    }));

    const all = [...fromFields, ...fromFunctions];
    if (!lower) {
      return all.slice(0, 50);
    }

    const scored = all
      .map((s) => ({ s, score: this.score(s.name.toLowerCase(), lower) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
    return scored.slice(0, 50).map((x) => x.s);
  }

  private score(name: string, query: string): number {
    if (name === query) return 100;
    if (name.startsWith(query)) return 80;
    const idx = name.indexOf(query);
    if (idx > 0) return 40;
    return 0;
  }

  private buildSegments(tokens: Token[]): HighlightSegment[] {
    return tokens.map((t) => {
      let cls = `tok tok-${t.type}`;
      const overlap = this.overlapSeverity(t.start, t.end);
      if (overlap === 'error') cls += ' tok-underline-error';
      else if (overlap === 'warning') cls += ' tok-underline-warning';
      return { text: t.value, cls };
    });
  }

  private overlapSeverity(start: number, end: number): 'error' | 'warning' | null {
    let result: 'error' | 'warning' | null = null;
    for (const d of this.diagnostics) {
      if (d.start < end && d.end > start) {
        if (d.severity === 'error') return 'error';
        result = 'warning';
      }
    }
    return result;
  }

  private scrollActiveIntoView(): void {
    setTimeout(() => {
      const list = document.querySelector('.fe-suggestions');
      const active = list?.querySelector('.fe-suggestion.active');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }

  private emit(): void {
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

  // ---- Template helpers ----
  get hasErrors(): boolean {
    return this.diagnostics.some((d) => d.severity === 'error');
  }

  get errorDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /** Signature parts for the argument hint, with the active parameter flagged. */
  get argHintParts(): { text: string; active: boolean }[] | null {
    const fn = this.context?.activeFunction;
    if (!fn) return null;
    if (fn.params.length === 0) {
      return [{ text: '(no arguments)', active: false }];
    }
    const activeIdx = Math.min(this.context!.activeArgIndex, fn.params.length - 1);
    return fn.params.map((param, i) => {
      const isVariadic = param.variadic;
      const active = i === activeIdx || !!(isVariadic && this.context!.activeArgIndex >= i);
      const label = param.optional ? `${param.name}?` : param.name;
      return { text: isVariadic ? `...${label}` : label, active };
    });
  }

  get activeParamDescription(): string | null {
    const fn = this.context?.activeFunction;
    if (!fn || fn.params.length === 0) return null;
    const idx = Math.min(this.context!.activeArgIndex, fn.params.length - 1);
    const param = fn.params[idx];
    return `${param.name}: ${param.description}`;
  }

  get activeFunctionExample(): string | null {
    const fn = this.context?.activeFunction;
    return fn ? exampleFor(fn) : null;
  }

  trackByIndex(index: number): number {
    return index;
  }

  readonly categoryOrder = CATEGORIES;
}
