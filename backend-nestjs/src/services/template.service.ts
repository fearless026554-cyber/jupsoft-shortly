import * as fs from 'node:fs';
import * as path from 'node:path';
import { TEMPLATE_CONFIG } from '../constants/index.js';

export class TemplateService {
  private static cache: Map<string, string> = new Map();

  /**
   * Resolve template file path safely across dev (ts) and prod (dist) environments
   */
  private static getTemplatePath(templateName: string): string {
    const candidates = [
      path.resolve(process.cwd(), TEMPLATE_CONFIG.SRC_PATH, `${templateName}.html`),
      path.resolve(process.cwd(), TEMPLATE_CONFIG.DIST_PATH, `${templateName}.html`),
      path.resolve(process.cwd(), TEMPLATE_CONFIG.ROOT_PATH, `${templateName}.html`),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
    return candidates[0];
  }

  /**
   * Render an external HTML template with dynamic variable replacements
   */
  public static render(templateName: string, data: Record<string, string>): string {
    let content = this.cache.get(templateName);

    if (!content) {
      const filePath = this.getTemplatePath(templateName);
      try {
        content = fs.readFileSync(filePath, 'utf-8');
        this.cache.set(templateName, content);
      } catch {
        content = TEMPLATE_CONFIG.FALLBACK_HTML;
      }
    }

    let rendered = content;
    for (const [key, value] of Object.entries(data)) {
      rendered = rendered.replaceAll(`{{${key}}}`, value);
    }

    return rendered;
  }
}
