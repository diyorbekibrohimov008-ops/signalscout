export function getEnv(key: string): string | undefined {
  const netlifyGlobal = (globalThis as unknown as { Netlify?: { env?: { get?: (k: string) => string | undefined } } })
    .Netlify;
  const fromNetlify = netlifyGlobal?.env?.get?.(key);
  if (fromNetlify !== undefined && fromNetlify !== "") {
    return fromNetlify;
  }
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  return fromProcess && fromProcess !== "" ? fromProcess : undefined;
}
