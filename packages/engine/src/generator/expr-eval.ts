/**
 * Evaluator ekspresi aman untuk konten: tanpa eval dan tanpa new Function.
 * Mendukung angka, variabel, + - * / %, perbandingan (< <= > >= == !=), && || !, kurung, dan fungsi
 * min, max, abs, floor, ceil, round, gcd (FPB), lcm (KPK), sqrt, pow. Hasilnya angka atau boolean.
 */
export type ExprValue = number | boolean;
export type Vars = Readonly<Record<string, number>>;

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: '('; v: '(' }
  | { t: ')'; v: ')' }
  | { t: ','; v: ',' };

type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'un'; op: '-' | '!'; arg: Node }
  | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'call'; fn: string; args: Node[] };

export class ExprError extends Error {}

const OPS = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '%', '<', '>', '!'];
const gcd2 = (a: number, b: number): number => {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) [x, y] = [y, x % y];
  return x;
};
const lcm2 = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : Math.abs(Math.trunc(a) * Math.trunc(b)) / gcd2(a, b);

const FUNCS: Record<string, (...xs: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: (x: number) => Math.abs(x),
  floor: (x: number) => Math.floor(x),
  ceil: (x: number) => Math.ceil(x),
  round: (x: number) => Math.round(x),
  gcd: (...xs: number[]) => xs.reduce(gcd2),
  lcm: (...xs: number[]) => xs.reduce(lcm2),
  sqrt: (x: number) => Math.sqrt(x),
  pow: (a: number, b: number) => (Number.isInteger(b) && b >= 0 && b <= 12 ? a ** b : Number.NaN),
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      const v = Number(src.slice(i, j));
      if (Number.isNaN(v)) throw new ExprError(`angka tidak valid di posisi ${i}`);
      out.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j]!)) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '(' || c === ')' || c === ',') {
      out.push({ t: c, v: c } as Token);
      i++;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`karakter tidak dikenal "${c}" di posisi ${i}`);
    out.push({ t: 'op', v: op });
    i += op.length;
  }
  return out;
}

// Urutan prioritas dari rendah ke tinggi: || < && < == != < < <= > >= < + - < * / %
const LEVELS = [['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];

function parse(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const expect = (t: Token['t']) => {
    const tok = tokens[pos];
    if (!tok || tok.t !== t) throw new ExprError(`diharapkan "${t}"`);
    pos++;
    return tok;
  };

  const primary = (): Node => {
    const tok = peek();
    if (!tok) throw new ExprError('ekspresi terpotong');
    if (tok.t === 'op' && (tok.v === '-' || tok.v === '!')) {
      pos++;
      return { k: 'un', op: tok.v, arg: primary() };
    }
    if (tok.t === 'num') {
      pos++;
      return { k: 'num', v: tok.v };
    }
    if (tok.t === 'id') {
      pos++;
      if (peek()?.t === '(') {
        if (!Object.hasOwn(FUNCS, tok.v)) throw new ExprError(`fungsi tidak dikenal "${tok.v}"`);
        pos++;
        const args: Node[] = [];
        if (peek()?.t !== ')') {
          args.push(binary(0));
          while (peek()?.t === ',') {
            pos++;
            args.push(binary(0));
          }
        }
        expect(')');
        return { k: 'call', fn: tok.v, args };
      }
      return { k: 'var', name: tok.v };
    }
    if (tok.t === '(') {
      pos++;
      const inner = binary(0);
      expect(')');
      return inner;
    }
    throw new ExprError(`token tak terduga "${tok.v}"`);
  };

  const binary = (level: number): Node => {
    if (level >= LEVELS.length) return primary();
    let left = binary(level + 1);
    for (;;) {
      const tok = peek();
      if (tok?.t !== 'op' || !LEVELS[level]!.includes(tok.v)) return left;
      pos++;
      left = { k: 'bin', op: tok.v, l: left, r: binary(level + 1) };
    }
  };

  const root = binary(0);
  if (pos !== tokens.length) throw new ExprError(`sisa token "${tokens[pos]!.v}"`);
  return root;
}

const num = (v: ExprValue): number => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

function evalNode(n: Node, vars: Vars): ExprValue {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'var': {
      // Hanya properti milik sendiri; prototype tidak pernah dibaca.
      const v = Object.hasOwn(vars, n.name) ? vars[n.name] : undefined;
      if (typeof v !== 'number') throw new ExprError(`variabel tidak dikenal "${n.name}"`);
      return v;
    }
    case 'un':
      return n.op === '-' ? -num(evalNode(n.arg, vars)) : !evalNode(n.arg, vars);
    case 'call':
      return FUNCS[n.fn]!(...n.args.map((a) => num(evalNode(a, vars))));
    case 'bin': {
      if (n.op === '&&') return Boolean(evalNode(n.l, vars)) && Boolean(evalNode(n.r, vars));
      if (n.op === '||') return Boolean(evalNode(n.l, vars)) || Boolean(evalNode(n.r, vars));
      const l = num(evalNode(n.l, vars));
      const r = num(evalNode(n.r, vars));
      switch (n.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          if (r === 0) throw new ExprError('pembagian dengan nol');
          return l / r;
        case '%':
          if (r === 0) throw new ExprError('pembagian dengan nol');
          return l % r;
        case '<':
          return l < r;
        case '<=':
          return l <= r;
        case '>':
          return l > r;
        case '>=':
          return l >= r;
        case '==':
          return l === r;
        default:
          return l !== r;
      }
    }
  }
}

const cache = new Map<string, Node>();

function compile(source: string): Node {
  let ast = cache.get(source);
  if (!ast) {
    ast = parse(tokenize(source));
    cache.set(source, ast);
  }
  return ast;
}

export const evalExpr = (source: string, vars: Vars): ExprValue => evalNode(compile(source), vars);

export function evalNumber(source: string, vars: Vars): number {
  const v = evalExpr(source, vars);
  if (typeof v !== 'number') throw new ExprError(`"${source}" harus menghasilkan angka`);
  return v;
}

export const evalBool = (source: string, vars: Vars): boolean => Boolean(evalExpr(source, vars));
