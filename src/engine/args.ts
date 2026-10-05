// A small option parser shared by the commands. Handles "-am msg", "--opt=value" and "--".

import { notSupported } from "./context";
import { has, own, setOwn } from "./objects";

/** `value`: takes an argument. `optional`: may take one, but only as "--opt=value". */
export type OptionSpec = Record<string, { value?: boolean; optional?: boolean; alias?: string }>;

export type Parsed = {
  flags: Record<string, string[]>;
  positional: string[];
  /** Arguments after a literal "--". null when there was no "--". */
  afterDashes: string[] | null;
};

export function parseArgs(command: string, args: string[], spec: OptionSpec): Parsed {
  const flags: Record<string, string[]> = {};
  const positional: string[] = [];
  let afterDashes: string[] | null = null;
  const canonical = (name: string) => own(spec, name)?.alias ?? name;
  const record = (name: string, value: string) => {
    const key = canonical(name);
    const list = own(flags, key) ?? [];
    setOwn(flags, key, list);
    list.push(value);
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (afterDashes) {
      afterDashes.push(arg);
      continue;
    }
    if (arg === "--") {
      afterDashes = [];
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = eq === -1 ? arg : arg.slice(0, eq);
      const def = own(spec, name);
      if (!def) notSupported(`git ${command} ${name}`);
      if (def.value) {
        if (eq !== -1) record(name, arg.slice(eq + 1));
        else if (i + 1 < args.length) record(name, args[++i]);
        else notSupported(`git ${command} ${name} without a value`);
      } else {
        if (eq !== -1 && !def.optional) notSupported(`git ${command} ${arg}`);
        record(name, eq === -1 ? "" : arg.slice(eq + 1));
      }
      continue;
    }
    if (arg.startsWith("-") && arg.length > 1 && arg !== "-") {
      for (let j = 1; j < arg.length; j++) {
        const name = `-${arg[j]}`;
        const def = own(spec, name);
        if (!def) notSupported(`git ${command} ${name}`);
        if (def.value) {
          const rest = arg.slice(j + 1);
          if (rest) record(name, rest);
          else if (i + 1 < args.length) record(name, args[++i]);
          else notSupported(`git ${command} ${name} without a value`);
          break;
        }
        record(name, "");
      }
      continue;
    }
    positional.push(arg);
  }
  return { flags, positional, afterDashes };
}

export function flag(p: Parsed, name: string): boolean {
  return has(p.flags, name);
}

export function value(p: Parsed, name: string): string | undefined {
  const v = own(p.flags, name);
  return v ? v[v.length - 1] : undefined;
}
