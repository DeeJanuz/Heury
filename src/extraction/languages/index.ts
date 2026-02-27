/**
 * Language Registry Wiring
 *
 * Creates a pre-configured LanguageRegistry with all supported language
 * extractors registered. This is the main entry point for multi-language
 * code analysis.
 */

import { LanguageRegistry } from '../language-registry.js';
import { JavaScriptTypeScriptExtractor } from './javascript-typescript.js';
import { GoExtractor } from './go.js';
import { JavaExtractor } from './java.js';
import { RustExtractor } from './rust.js';
import { CSharpExtractor } from './csharp.js';
import { PythonExtractor } from './python.js';

/**
 * Create a LanguageRegistry pre-configured with all 6 supported language extractors.
 */
export function createLanguageRegistry(): LanguageRegistry {
  const registry = new LanguageRegistry();
  registry.register(new JavaScriptTypeScriptExtractor());
  registry.register(new GoExtractor());
  registry.register(new JavaExtractor());
  registry.register(new RustExtractor());
  registry.register(new CSharpExtractor());
  registry.register(new PythonExtractor());
  return registry;
}

// Also export individual extractors for direct use
export { JavaScriptTypeScriptExtractor } from './javascript-typescript.js';
export { GoExtractor } from './go.js';
export { JavaExtractor } from './java.js';
export { RustExtractor } from './rust.js';
export { CSharpExtractor } from './csharp.js';
export { PythonExtractor } from './python.js';
