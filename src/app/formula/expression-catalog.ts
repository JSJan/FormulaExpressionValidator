/**
 * Metadata catalog for the Anvil expression language.
 * Descriptions and signatures are derived from the expression reference docs
 * (src/Anvil.Server/Proto/doc/expressions).
 */

export type ParamType = 'vector' | 'scalar' | 'number' | 'boolean' | 'date';

export interface FunctionParam {
  name: string;
  description: string;
  type: ParamType;
  optional?: boolean;
  /** A variadic parameter absorbs all remaining arguments (e.g. Vn). */
  variadic?: boolean;
}

export interface FunctionDef {
  name: string;
  category: string;
  summary: string;
  /** Human readable signature, e.g. "RollingSum(values, windowMinutes)". */
  signature: string;
  params: FunctionParam[];
  minArgs: number;
  /** null = unbounded (variadic). */
  maxArgs: number | null;
  returns: ParamType;
  /** Infix / prefix operator equivalent, if any. */
  operator?: string;
}

const p = (
  name: string,
  description: string,
  type: ParamType = 'vector',
  extra: Partial<FunctionParam> = {},
): FunctionParam => ({ name, description, type, ...extra });

/** A variadic "value" tail parameter used by many aggregate functions. */
const variadicValues = (name = 'Vn') =>
  p(name, 'One or more additional input vectors.', 'vector', { variadic: true });

export const FUNCTIONS: FunctionDef[] = [
  // ---- Vector Operations ----
  {
    name: 'Add',
    category: 'Vector Operations',
    summary: 'Element-wise addition of multiple vectors. NaN in any input yields NaN.',
    signature: 'Add(A, B, ...)',
    params: [p('A', 'First vector.'), p('B', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
    operator: '+',
  },
  {
    name: 'Subtract',
    category: 'Vector Operations',
    summary: 'Subtracts all subsequent vectors from the first, element-wise.',
    signature: 'Subtract(A, B, ...)',
    params: [p('A', 'Minuend vector.'), p('B', 'Vector to subtract.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
    operator: '-',
  },
  {
    name: 'Multiply',
    category: 'Vector Operations',
    summary: 'Element-wise multiplication of multiple vectors.',
    signature: 'Multiply(A, B, ...)',
    params: [p('A', 'First factor.'), p('B', 'Second factor.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
    operator: '*',
  },
  {
    name: 'Divide',
    category: 'Vector Operations',
    summary: 'Divides the first vector by all subsequent vectors sequentially.',
    signature: 'Divide(A, B, ...)',
    params: [p('A', 'Dividend.'), p('B', 'Divisor.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
    operator: '/',
  },
  {
    name: 'Power',
    category: 'Vector Operations',
    summary: 'Raises the base vector to the power of the exponent vector(s), element-wise.',
    signature: 'Power(base, exponent)',
    params: [p('base', 'Base vector.'), p('exponent', 'Exponent vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
    operator: '^',
  },
  {
    name: 'SquareRoot',
    category: 'Vector Operations',
    summary: 'Computes the square root of each element in a vector.',
    signature: 'SquareRoot(A)',
    params: [p('A', 'Input vector.')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'vector',
  },
  {
    name: 'Minus',
    category: 'Vector Operations',
    summary: 'Negates all elements in a vector (multiplies each element by -1).',
    signature: 'Minus(A)',
    params: [p('A', 'Vector to negate.')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'vector',
    operator: '-',
  },
  {
    name: 'Abs',
    category: 'Vector Operations',
    summary: 'Computes the absolute value of each element in a vector.',
    signature: 'Abs(V)',
    params: [p('V', 'Input vector.')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'vector',
  },

  // ---- Logical Operations ----
  {
    name: 'And',
    category: 'Logical Operations',
    summary: 'Element-wise logical AND. TRUE only when all inputs are TRUE.',
    signature: 'And(A, B, ...)',
    params: [p('A', 'First boolean vector.', 'boolean'), p('B', 'Second boolean vector.', 'boolean'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'boolean',
    operator: '&&',
  },
  {
    name: 'Or',
    category: 'Logical Operations',
    summary: 'Element-wise logical OR. TRUE when at least one input is TRUE.',
    signature: 'Or(A, B, ...)',
    params: [p('A', 'First boolean vector.', 'boolean'), p('B', 'Second boolean vector.', 'boolean'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'boolean',
    operator: '||',
  },
  {
    name: 'Invert',
    category: 'Logical Operations',
    summary: 'Element-wise logical NOT. Flips TRUE to FALSE and FALSE to TRUE.',
    signature: 'Invert(V)',
    params: [p('V', 'Boolean vector to invert.', 'boolean')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'boolean',
    operator: '!',
  },

  // ---- Conditional Operations ----
  {
    name: 'If',
    category: 'Conditional Operations',
    summary: 'Evaluates a condition vector and returns a boolean TRUE/FALSE/UNKNOWN result.',
    signature: 'If(condition, vector)',
    params: [p('condition', 'Condition vector.', 'boolean'), p('vector', 'Value vector.')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'boolean',
  },
  {
    name: 'IfElse',
    category: 'Conditional Operations',
    summary: 'Ternary conditional: returns trueValue when condition is TRUE, else falseValue.',
    signature: 'IfElse(condition, trueValue, falseValue)',
    params: [
      p('condition', 'Condition vector (non-zero is TRUE).', 'boolean'),
      p('trueValue', 'Value returned when condition is TRUE.'),
      p('falseValue', 'Value returned when condition is FALSE.'),
    ],
    minArgs: 3,
    maxArgs: 3,
    returns: 'vector',
  },
  {
    name: 'Binary',
    category: 'Conditional Operations',
    summary: 'Converts a vector to binary: 1 for known values, 0 for unknown/NaN.',
    signature: 'Binary(V)',
    params: [p('V', 'Input vector.')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'vector',
  },
  {
    name: 'Boolean',
    category: 'Conditional Operations',
    summary: 'Converts numeric values to boolean using standard truthiness rules.',
    signature: 'Boolean(V)',
    params: [p('V', 'Input vector.')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'boolean',
  },

  // ---- Transformation Operations ----
  {
    name: 'DefaultUnknown',
    category: 'Transformation Operations',
    summary: 'Replaces NaN values in the first vector with values from the second vector.',
    signature: 'DefaultUnknown(V1, V2)',
    params: [p('V1', 'Primary vector.'), p('V2', 'Fallback vector for NaN positions.')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },
  {
    name: 'Coalesce',
    category: 'Transformation Operations',
    summary: 'Returns the first non-NaN value from multiple vectors at each position.',
    signature: 'Coalesce(V1, V2, ...)',
    params: [p('V1', 'Highest priority vector.'), p('V2', 'Next priority vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'ChangeOfValue',
    category: 'Transformation Operations',
    summary: 'Difference between each element and the previous element in a vector.',
    signature: 'ChangeOfValue(V)',
    params: [p('V', 'Input vector.')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'vector',
  },
  {
    name: 'SignChanges',
    category: 'Transformation Operations',
    summary: 'Returns 1 when the sign of (V1 - V2) changes between intervals, else 0.',
    signature: 'SignChanges(V1, V2)',
    params: [p('V1', 'First vector.'), p('V2', 'Second vector.')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },

  // ---- Aggregation Operations ----
  {
    name: 'Max',
    category: 'Aggregation Operations',
    summary: 'Element-wise maximum across multiple vectors.',
    signature: 'Max(V1, V2, ...)',
    params: [p('V1', 'First vector.'), p('V2', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'Min',
    category: 'Aggregation Operations',
    summary: 'Element-wise minimum across multiple vectors.',
    signature: 'Min(V1, V2, ...)',
    params: [p('V1', 'First vector.'), p('V2', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'Avg',
    category: 'Aggregation Operations',
    summary: 'Element-wise average (mean) across multiple vectors.',
    signature: 'Avg(V1, V2, ...)',
    params: [p('V1', 'First vector.'), p('V2', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'AvgVector',
    category: 'Aggregation Operations',
    summary: 'Single average across all elements of all vectors, broadcast as a constant vector.',
    signature: 'AvgVector(V1, ...)',
    params: [p('V1', 'Input vector.'), variadicValues()],
    minArgs: 1,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'Combine',
    category: 'Aggregation Operations',
    summary: 'Merges vectors by taking the last non-NaN value at each position.',
    signature: 'Combine(V1, V2, ...)',
    params: [p('V1', 'First vector.'), p('V2', 'Overriding vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },

  // ---- Threshold / Clipping ----
  {
    name: 'ThresholdMin',
    category: 'Threshold / Clipping',
    summary: 'Finds the first subsequent value >= threshold at each position, else NaN.',
    signature: 'ThresholdMin(threshold, V1, V2, ...)',
    params: [p('threshold', 'Minimum threshold vector.'), p('V1', 'First candidate vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'ThresholdMax',
    category: 'Threshold / Clipping',
    summary: 'Finds the first subsequent value <= threshold at each position, else NaN.',
    signature: 'ThresholdMax(threshold, V1, V2, ...)',
    params: [p('threshold', 'Maximum threshold vector.'), p('V1', 'First candidate vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'CutoffMin',
    category: 'Threshold / Clipping',
    summary: 'Keeps values up to and including the first element <= threshold; rest become NaN.',
    signature: 'CutoffMin(values, threshold)',
    params: [p('values', 'Value vector.'), p('threshold', 'Cutoff threshold.')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },
  {
    name: 'CutoffMax',
    category: 'Threshold / Clipping',
    summary: 'Keeps values up to and including the first element >= threshold; rest become NaN.',
    signature: 'CutoffMax(values, threshold)',
    params: [p('values', 'Value vector.'), p('threshold', 'Cutoff threshold.')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },

  // ---- Percentage / Soft ----
  {
    name: 'SoftAdd',
    category: 'Percentage / Soft',
    summary: 'Element-wise addition treating NaN as zero.',
    signature: 'SoftAdd(V1, V2, ...)',
    params: [p('V1', 'First vector.'), p('V2', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'SoftSubtract',
    category: 'Percentage / Soft',
    summary: 'Element-wise subtraction treating NaN as zero.',
    signature: 'SoftSubtract(V1, V2, ...)',
    params: [p('V1', 'First vector.'), p('V2', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'vector',
  },
  {
    name: 'Percent',
    category: 'Percentage / Soft',
    summary: 'Percentage that the numerator represents of the denominator: V1 * 100 / V2.',
    signature: 'Percent(numerator, denominator)',
    params: [p('numerator', 'Numerator vector.'), p('denominator', 'Denominator vector.')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },

  // ---- Rolling Window ----
  {
    name: 'RollingSum',
    category: 'Rolling Window',
    summary: 'Sum of values within a trailing sliding window (window length in minutes).',
    signature: 'RollingSum(values, windowMinutes)',
    params: [p('values', 'Value vector.'), p('windowMinutes', 'Window length in minutes.', 'number')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },
  {
    name: 'RollingAvg',
    category: 'Rolling Window',
    summary: 'Average of values within a trailing sliding window (window length in minutes).',
    signature: 'RollingAvg(values, windowMinutes)',
    params: [p('values', 'Value vector.'), p('windowMinutes', 'Window length in minutes.', 'number')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },
  {
    name: 'RollingMin',
    category: 'Rolling Window',
    summary: 'Minimum of values within a trailing sliding window (window length in minutes).',
    signature: 'RollingMin(values, windowMinutes)',
    params: [p('values', 'Value vector.'), p('windowMinutes', 'Window length in minutes.', 'number')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },
  {
    name: 'RollingMax',
    category: 'Rolling Window',
    summary: 'Maximum of values within a trailing sliding window (window length in minutes).',
    signature: 'RollingMax(values, windowMinutes)',
    params: [p('values', 'Value vector.'), p('windowMinutes', 'Window length in minutes.', 'number')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },
  {
    name: 'RollingStdDev',
    category: 'Rolling Window',
    summary: 'Standard deviation of values within a trailing sliding window (minutes).',
    signature: 'RollingStdDev(values, windowMinutes)',
    params: [p('values', 'Value vector.'), p('windowMinutes', 'Window length in minutes.', 'number')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },

  // ---- Date Vector ----
  {
    name: 'Interval',
    category: 'Date Vector',
    summary: 'Returns the timestamps of the evaluation intervals.',
    signature: 'Interval()',
    params: [],
    minArgs: 0,
    maxArgs: 0,
    returns: 'date',
  },
  {
    name: 'IntervalStart',
    category: 'Date Vector',
    summary: 'Constant vector of the start timestamp of the first evaluation interval.',
    signature: 'IntervalStart()',
    params: [],
    minArgs: 0,
    maxArgs: 0,
    returns: 'date',
  },
  {
    name: 'IntervalEnd',
    category: 'Date Vector',
    summary: 'Constant vector of the timestamp of the last evaluation interval.',
    signature: 'IntervalEnd()',
    params: [],
    minArgs: 0,
    maxArgs: 0,
    returns: 'date',
  },
  {
    name: 'IntervalLength',
    category: 'Date Vector',
    summary: 'Constant vector of the number of intervals in the evaluation table.',
    signature: 'IntervalLength()',
    params: [],
    minArgs: 0,
    maxArgs: 0,
    returns: 'number',
  },

  // ---- DateTime Extraction ----
  {
    name: 'Minute',
    category: 'DateTime Extraction',
    summary: 'Extracts the minute component (0-59) from a date vector.',
    signature: 'Minute(dateVector)',
    params: [p('dateVector', 'Date vector.', 'date')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'number',
  },
  {
    name: 'Hour24',
    category: 'DateTime Extraction',
    summary: 'Extracts the hour (0-23, 24-hour format) from a date vector.',
    signature: 'Hour24(dateVector)',
    params: [p('dateVector', 'Date vector.', 'date')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'number',
  },
  {
    name: 'Hour12',
    category: 'DateTime Extraction',
    summary: 'Extracts the hour (1-12, 12-hour format) from a date vector.',
    signature: 'Hour12(dateVector)',
    params: [p('dateVector', 'Date vector.', 'date')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'number',
  },
  {
    name: 'Day',
    category: 'DateTime Extraction',
    summary: 'Extracts the day of month (1-31) from a date vector.',
    signature: 'Day(dateVector)',
    params: [p('dateVector', 'Date vector.', 'date')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'number',
  },
  {
    name: 'Month',
    category: 'DateTime Extraction',
    summary: 'Extracts the month (1-12) from a date vector.',
    signature: 'Month(dateVector)',
    params: [p('dateVector', 'Date vector.', 'date')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'number',
  },
  {
    name: 'Week',
    category: 'DateTime Extraction',
    summary: 'Extracts the ISO week number (1-53) from a date vector.',
    signature: 'Week(dateVector)',
    params: [p('dateVector', 'Date vector.', 'date')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'number',
  },
  {
    name: 'Year',
    category: 'DateTime Extraction',
    summary: 'Extracts the year from a date vector.',
    signature: 'Year(dateVector)',
    params: [p('dateVector', 'Date vector.', 'date')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'number',
  },
  {
    name: 'DayOfWeek',
    category: 'DateTime Extraction',
    summary: 'Extracts the day of week (0-6) from a date vector.',
    signature: 'DayOfWeek(dateVector)',
    params: [p('dateVector', 'Date vector.', 'date')],
    minArgs: 1,
    maxArgs: 1,
    returns: 'number',
  },

  // ---- Day-of-Week ----
  ...(
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
  ).map<FunctionDef>((day) => ({
    name: `Is${day}`,
    category: 'Day-of-Week',
    summary: `Returns TRUE for intervals that fall on a ${day}, with optional hour-range filtering.`,
    signature: `Is${day}(dateVector, startHour?, endHour?)`,
    params: [
      p('dateVector', 'Date vector.', 'date'),
      p('startHour', 'Optional inclusive start hour (0-23).', 'number', { optional: true }),
      p('endHour', 'Optional inclusive end hour (0-23).', 'number', { optional: true }),
    ],
    minArgs: 1,
    maxArgs: 3,
    returns: 'boolean',
  })),
  {
    name: 'IsWeekday',
    category: 'Day-of-Week',
    summary: 'Returns TRUE for intervals on a weekday (Mon-Fri), with optional hour-range filtering.',
    signature: 'IsWeekday(dateVector, startHour?, endHour?)',
    params: [
      p('dateVector', 'Date vector.', 'date'),
      p('startHour', 'Optional inclusive start hour (0-23).', 'number', { optional: true }),
      p('endHour', 'Optional inclusive end hour (0-23).', 'number', { optional: true }),
    ],
    minArgs: 1,
    maxArgs: 3,
    returns: 'boolean',
  },

  // ---- Complex Time ----
  {
    name: 'AnySumOfPeriodGreaterThan',
    category: 'Complex Time',
    summary: 'Keeps values for periods where the windowed sum exceeds a threshold, else NaN.',
    signature: 'AnySumOfPeriodGreaterThan(values, intervalMinutes, sumThreshold)',
    params: [
      p('values', 'Value vector.'),
      p('intervalMinutes', 'Period length in minutes.', 'number'),
      p('sumThreshold', 'Sum threshold to exceed.', 'number'),
    ],
    minArgs: 3,
    maxArgs: 3,
    returns: 'vector',
  },
  {
    name: 'SignChangesPerMinutes',
    category: 'Complex Time',
    summary: 'TRUE when threshold crossings within a window exceed a change limit.',
    signature: 'SignChangesPerMinutes(values, threshold, windowMinutes, changeLimit)',
    params: [
      p('values', 'Value vector.'),
      p('threshold', 'Threshold to cross.', 'number'),
      p('windowMinutes', 'Window length in minutes.', 'number'),
      p('changeLimit', 'Maximum allowed sign changes.', 'number'),
    ],
    minArgs: 4,
    maxArgs: 4,
    returns: 'boolean',
  },
  {
    name: 'LastHours',
    category: 'Complex Time',
    summary: 'Keeps only the last N hours of data; earlier values become NaN.',
    signature: 'LastHours(values, hours)',
    params: [p('values', 'Value vector.'), p('hours', 'Number of trailing hours to keep.', 'number')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },
  {
    name: 'OnTime',
    category: 'Complex Time',
    summary: 'Shifts data forward by removing the first N minutes (set to NaN).',
    signature: 'OnTime(values, minutesToShift)',
    params: [p('values', 'Value vector.'), p('minutesToShift', 'Minutes to shift forward.', 'number')],
    minArgs: 2,
    maxArgs: 2,
    returns: 'vector',
  },

  // ---- Comparison Operations ----
  {
    name: 'Equal',
    category: 'Comparison Operations',
    summary: 'TRUE where all corresponding elements are equal.',
    signature: 'Equal(A, B, ...)',
    params: [p('A', 'First vector.'), p('B', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'boolean',
    operator: '==',
  },
  {
    name: 'NotEqual',
    category: 'Comparison Operations',
    summary: 'TRUE where corresponding elements are not all equal (inverse of Equal).',
    signature: 'NotEqual(A, B, ...)',
    params: [p('A', 'First vector.'), p('B', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'boolean',
    operator: '!=',
  },
  {
    name: 'GreaterThan',
    category: 'Comparison Operations',
    summary: 'TRUE where the first vector is greater than all subsequent vectors.',
    signature: 'GreaterThan(A, B, ...)',
    params: [p('A', 'First vector.'), p('B', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'boolean',
    operator: '>',
  },
  {
    name: 'GreaterEqual',
    category: 'Comparison Operations',
    summary: 'TRUE where the first vector is greater than or equal to all subsequent vectors.',
    signature: 'GreaterEqual(A, B, ...)',
    params: [p('A', 'First vector.'), p('B', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'boolean',
    operator: '>=',
  },
  {
    name: 'LessThan',
    category: 'Comparison Operations',
    summary: 'TRUE where the first vector is less than all subsequent vectors.',
    signature: 'LessThan(A, B, ...)',
    params: [p('A', 'First vector.'), p('B', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'boolean',
    operator: '<',
  },
  {
    name: 'LessEqual',
    category: 'Comparison Operations',
    summary: 'TRUE where the first vector is less than or equal to all subsequent vectors.',
    signature: 'LessEqual(A, B, ...)',
    params: [p('A', 'First vector.'), p('B', 'Second vector.'), variadicValues()],
    minArgs: 2,
    maxArgs: null,
    returns: 'boolean',
    operator: '<=',
  },
];

/** Fast lookup by lower-cased function name. */
export const FUNCTION_MAP: ReadonlyMap<string, FunctionDef> = new Map(
  FUNCTIONS.map((f) => [f.name.toLowerCase(), f]),
);

export function findFunction(name: string): FunctionDef | undefined {
  return FUNCTION_MAP.get(name.toLowerCase());
}

/** Distinct categories in catalog declaration order. */
export const CATEGORIES: string[] = FUNCTIONS.reduce<string[]>((acc, f) => {
  if (!acc.includes(f.category)) acc.push(f.category);
  return acc;
}, []);
