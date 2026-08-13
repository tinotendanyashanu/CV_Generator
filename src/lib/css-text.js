export function resolvePrintableCss(cvCss, printCss) {
  const combined = `${cvCss || ''}\n${printCss || ''}`;
  if (combined.includes('@page') && combined.includes('.cv')) {
    return combined;
  }

  try {
    const fs = globalThis.process?.versions?.node ? requireFs() : null;
    if (fs) {
      return `${fs.cv}\n${fs.print}`;
    }
  } catch {
    // fall through
  }
  return combined;
}

function requireFs() {
  const fs = requireNode('node:fs');
  const path = requireNode('node:path');
  const url = requireNode('node:url');
  const dir = path.dirname(url.fileURLToPath(import.meta.url));
  return {
    cv: fs.readFileSync(path.join(dir, '../styles/cv.css'), 'utf8'),
    print: fs.readFileSync(path.join(dir, '../styles/print.css'), 'utf8')
  };
}

function requireNode(specifier) {
  return globalThis.process?.getBuiltinModule
    ? globalThis.process.getBuiltinModule(specifier)
    : null;
}
