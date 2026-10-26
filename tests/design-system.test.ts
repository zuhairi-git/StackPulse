import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Button, Dialog, Input, SearchField, Switch } from '../src/design-system';
import { DesignSystemGallery } from '../src/design-system/Gallery';

describe('design system integration', () => {
  it('preserves native form semantics and accessibility props', () => {
    const button = renderToStaticMarkup(createElement(Button, { type: 'submit', disabled: true, variant: 'primary', children: 'Save' }));
    expect(button).toContain('type="submit"');
    expect(button).toContain('disabled=""');
    expect(button).toContain('class="button primary"');
    expect(renderToStaticMarkup(createElement(Input, { required: true, type: 'password', 'aria-describedby': 'hint' }))).toContain('aria-describedby="hint"');
    expect(renderToStaticMarkup(createElement(Dialog, { 'aria-labelledby': 'title' }))).toContain('<dialog aria-labelledby="title"');
  });

  it('exposes named search fields and checked switches', () => {
    expect(renderToStaticMarkup(createElement(SearchField, { label: 'Search resources', value: '', readOnly: true }))).toContain('aria-label="Search resources"');
    const toggle = renderToStaticMarkup(createElement(Switch, { checked: true, onCheckedChange: () => {}, 'aria-label': 'Activate Vercel' }));
    expect(toggle).toContain('role="switch"');
    expect(toggle).toContain('aria-checked="true"');
    expect(toggle).toContain('aria-label="Activate Vercel"');
  });

  it('renders the component catalog without account or storage services', () => {
    const html = renderToStaticMarkup(createElement(DesignSystemGallery));
    for (const section of ['Foundations', 'Buttons &amp; navigation', 'Forms &amp; dropdowns', 'Status &amp; feedback', 'Cards, metrics &amp; settings', 'Search, tables &amp; empty states', 'Dialogs &amp; provider selection', 'Icons &amp; provider logos']) expect(html).toContain(section);
    expect(html).toContain('aria-labelledby="ds-dialog-title"');
    expect(html).toContain('role="combobox"');
  });
});
