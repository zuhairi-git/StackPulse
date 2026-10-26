import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { Icon } from '../src/design-system/Brand';
import { availableIconStyles, iconStyles, IconStyleProvider, resolveIconStyle } from '../src/design-system/IconStyle';

describe('Font Awesome icon styles', () => {
  it('defaults to the installed Thin font and falls back from missing styles', () => {
    expect(resolveIconStyle(null).value).toBe('duotone-thin');
    expect(resolveIconStyle('unknown').value).toBe('duotone-thin');
    for (const style of iconStyles) {
      expect(resolveIconStyle(style.value).value).toBe(style.url ? style.value : 'duotone-thin');
    }
    expect(availableIconStyles.every(style => !!style.url)).toBe(true);
  });

  it('registers only installed fonts and applies the selected style globally', () => {
    const html = renderToStaticMarkup(createElement(IconStyleProvider, { children: createElement(Icon, { name: 'settings' }) }));
    expect(html).toContain('@font-face');
    expect(html).toContain('--ds-icon-family:"StackPulse-duotone-thin"');
    expect(html).toContain('--ds-icon-weight:100');
    expect(html).toContain('fa-duotone fa-gear');
    expect(html).not.toContain('undefined');
    for (const style of iconStyles.filter(style => !style.url)) expect(html).not.toContain(`font-family:"StackPulse-${style.value}"`);
  });

  it('maps every interface icon to a glyph defined by the supplied kit', () => {
    const css = readFileSync(new URL('../fa-kit-60396e54cd-web/css/fontawesome.css', import.meta.url), 'utf8');
    for (const name of ['grid', 'palette', 'pulse', 'link', 'settings', 'arrow', 'external', 'refresh', 'shield', 'lock', 'plus', 'search', 'clock', 'download', 'close', 'box', 'chevron', 'check']) {
      const html = renderToStaticMarkup(createElement(Icon, { name }));
      const glyph = html.match(/fa-duotone (fa-[\w-]+)/)![1];
      expect(css).toContain(`.${glyph} {`);
      expect(html).toContain('aria-hidden="true"');
    }
  });
});
