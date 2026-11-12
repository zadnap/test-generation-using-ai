import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewRenderer } from '../../../../packages/platform-node/views/view-renderer.js';

// CFG (C3) summary for ViewRenderer:
//   setEngine: typeof options === 'string' T/F; engine entry missing T/F;
//              root ?? templates T/F; options.* ?? defaults T/F
//   render: cache hit T/F; production T/F
//   createRenderFn: module function T/F; __express T/F; compile T/F;
//                   renderFile T/F; none -> throw
//   getEngine: engine cached T/F; import success/failure
//   resolveFile: extname(view) T/F; each candidate/root; traversal skip T/F;
//                stat isFile T/F; stat throws T/F; not found
const dirs: string[] = [];

function makeDir() {
  const dir = mkdtempSync(join(tmpdir(), 'nest-view-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const fnEngine = (html = 'ok') => vi.fn((_file, _data, cb) => cb(null, html));

describe('ViewRenderer', () => {
  it('should not be configured initially', () => {
    expect(new ViewRenderer().isConfigured()).toBe(false);
  });

  describe('setEngine', () => {
    it('should accept an Express-style engine name', async () => {
      const renderer = new ViewRenderer();
      renderer.setEngine('definitely-missing-engine-xyz');
      expect(renderer.isConfigured()).toBe(true);
      // The engine is loaded on first render, so a missing module rejects.
      await expect(renderer.render('index')).rejects.toThrow(
        'Cannot load the "definitely-missing-engine-xyz" view engine',
      );
    });

    it('should throw when no engine is given', () => {
      expect(() => new ViewRenderer().setEngine({ engine: {} } as any)).toThrow(
        TypeError,
      );
      expect(() => new ViewRenderer().setEngine({} as any)).toThrow(TypeError);
    });

    it('should store root, viewExt, defaultContext, options and production', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'page.custom'), 'x');
      const module = vi.fn((_file, _data, cb) => cb(null, 'rendered'));
      const renderer = new ViewRenderer();
      renderer.setEngine({
        engine: { custom: module },
        root: dir,
        viewExt: 'custom',
        defaultContext: { a: 1, b: 1 },
        options: { opt: true },
        production: false,
      });
      const html = await renderer.render('page', { b: 2 });
      expect(html).toBe('rendered');
      expect(module).toHaveBeenCalledTimes(1);
      const data = module.mock.calls[0][1];
      expect(data).toMatchObject({
        a: 1,
        b: 2,
        opt: true,
        cache: false,
        settings: { 'view engine': 'custom', 'view cache': false },
      });
    });

    it('should use templates as an alias of root', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'index.hbs'), 'x');
      const module = vi.fn((_file, _data, cb) => cb(null, 'hbs'));
      const renderer = new ViewRenderer();
      renderer.setEngine({
        engine: { handlebars: module },
        templates: dir,
      });
      expect(await renderer.render('index')).toBe('hbs');
    });

    it('should cache the resolved render function in production', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'index.ejs'), 'x');
      const module = vi.fn((_file, _data, cb) => cb(null, 'ok'));
      const renderer = new ViewRenderer();
      renderer.setEngine({ engine: { ejs: module }, root: dir, production: true });
      expect(await renderer.render('index')).toBe('ok');
      // The file is gone, but the cached render function still resolves.
      rmSync(join(dir, 'index.ejs'));
      expect(await renderer.render('index')).toBe('ok');
      // Setting the engine again clears the cache.
      renderer.setEngine({ engine: { ejs: module }, root: dir, production: true });
      await expect(renderer.render('index')).rejects.toThrow(
        'Failed to lookup view',
      );
    });
  });

  describe('setBaseViewsDir and setLocal', () => {
    it('should resolve roots and prepend local values', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'index.ejs'), 'x');
      const module = vi.fn((_file, data, cb) => cb(null, JSON.stringify(data)));
      const renderer = new ViewRenderer();
      renderer.setEngine({
        engine: { ejs: module },
        defaultContext: { shared: 'default', overridden: 'default' },
      });
      renderer.setBaseViewsDir(dir);
      renderer.setLocal('local', 'value');
      renderer.setLocal('overridden', 'local');
      const html = await renderer.render('index', { overridden: 'data' });
      expect(JSON.parse(html)).toMatchObject({
        shared: 'default',
        local: 'value',
        overridden: 'data',
      });
    });
  });

  describe('createRenderFn engine shapes', () => {
    async function renderWith(module: any, view = 'index') {
      const dir = makeDir();
      writeFileSync(join(dir, 'index.ejs'), 'template');
      const renderer = new ViewRenderer();
      renderer.setEngine({ engine: { ejs: module }, root: dir });
      return renderer.render(view, { x: 1 });
    }

    it('should support a callback engine function', async () => {
      expect(await renderWith(fnEngine('cb'))).toBe('cb');
    });

    it('should support an __express engine', async () => {
      const module = {
        __express: vi.fn((_file, _data, cb) => cb(null, 'express')),
      };
      expect(await renderWith(module)).toBe('express');
    });

    it('should support a compile engine', async () => {
      const template = vi.fn((data, options) => `compiled ${data.x}`);
      const module = {
        compile: vi.fn(() => template),
      };
      expect(await renderWith(module)).toBe('compiled 1');
      expect(module.compile).toHaveBeenCalledWith(
        'template',
        expect.objectContaining({ filename: expect.stringContaining('index.ejs') }),
      );
      expect(template).toHaveBeenCalledWith(
        expect.objectContaining({ x: 1 }),
        expect.objectContaining({ filepath: expect.stringContaining('index.ejs') }),
      );
    });

    it('should support a renderFile engine', async () => {
      const module = {
        renderFile: vi.fn((_file, _data, cb) => cb(null, 'file')),
      };
      expect(await renderWith(module)).toBe('file');
    });

    it('should throw when the engine exposes none of the supported functions', async () => {
      await expect(renderWith({})).rejects.toThrow(
        'exposes none of __express(), compile() or renderFile()',
      );
    });

    it('should reject when a callback engine reports an error', async () => {
      const module = vi.fn((_file, _data, cb) => cb(new Error('boom')));
      await expect(renderWith(module)).rejects.toThrow('boom');
    });

    it('should resolve an engine that returns the html instead of calling back', async () => {
      const module = vi.fn(() => 'returned');
      expect(await renderWith(module)).toBe('returned');
    });

    it('should resolve an engine that returns a promise', async () => {
      const module = vi.fn(() => Promise.resolve('promised'));
      expect(await renderWith(module)).toBe('promised');
    });

    it('should reject when an engine returns a rejected promise', async () => {
      const module = vi.fn(() => Promise.reject(new Error('async boom')));
      await expect(renderWith(module)).rejects.toThrow('async boom');
    });

    it('should default the callback html to an empty string', async () => {
      const module = vi.fn((_file, _data, cb) => cb(null, undefined));
      expect(await renderWith(module)).toBe('');
    });
  });

  describe('resolveFile', () => {
    it('should append the engine extension when the view has none', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'page.ejs'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: dir });
      await renderer.render('page');
      expect(module.mock.calls[0][0]).toBe(join(dir, 'page.ejs'));
    });

    it('should use the default extension for a known engine name', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'page.hbs'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { handlebars: module }, root: dir });
      await renderer.render('page');
      expect(module.mock.calls[0][0]).toBe(join(dir, 'page.hbs'));
    });

    it('should use the engine name when there is no default extension', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'page.ejs'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: dir });
      await renderer.render('page');
      expect(module.mock.calls[0][0]).toBe(join(dir, 'page.ejs'));
    });

    it('should keep an explicit extension', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'page.html'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: dir });
      await renderer.render('page.html');
      expect(module.mock.calls[0][0]).toBe(join(dir, 'page.html'));
    });

    it('should resolve users to users/index.ejs', async () => {
      const dir = makeDir();
      mkdirSync(join(dir, 'users'));
      writeFileSync(join(dir, 'users', 'index.ejs'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: dir });
      await renderer.render('users');
      expect(module.mock.calls[0][0]).toBe(join(dir, 'users', 'index.ejs'));
    });

    it('should resolve users/ to users/index.ejs', async () => {
      const dir = makeDir();
      mkdirSync(join(dir, 'users'));
      writeFileSync(join(dir, 'users', 'index.ejs'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: dir });
      await renderer.render('users/');
      expect(module.mock.calls[0][0]).toBe(join(dir, 'users', 'index.ejs'));
    });

    it('should skip a directory named like the view', async () => {
      const dir = makeDir();
      mkdirSync(join(dir, 'page.ejs'));
      const second = makeDir();
      writeFileSync(join(second, 'page.ejs'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: [dir, second] });
      await renderer.render('page');
      expect(module.mock.calls[0][0]).toBe(join(second, 'page.ejs'));
    });

    it('should search the roots in order', async () => {
      const first = makeDir();
      const second = makeDir();
      writeFileSync(join(second, 'page.ejs'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: [first, second] });
      await renderer.render('page');
      expect(module.mock.calls[0][0]).toBe(join(second, 'page.ejs'));
    });

    it('should prefer a file in any directory over an index', async () => {
      const first = makeDir();
      const second = makeDir();
      writeFileSync(join(second, 'page.ejs'), 'x');
      mkdirSync(join(first, 'page.ejs'));
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: [first, second] });
      await renderer.render('page');
      expect(module.mock.calls[0][0]).toBe(join(second, 'page.ejs'));
    });

    it('should refuse to resolve outside the views directories', async () => {
      const dir = makeDir();
      const outside = makeDir();
      writeFileSync(join(outside, 'secret.ejs'), 'x');
      const renderer = new ViewRenderer();
      const module = fnEngine('ok');
      renderer.setEngine({ engine: { ejs: module }, root: dir });
      await expect(renderer.render(join(outside, 'secret'))).rejects.toThrow(
        'Failed to lookup view',
      );
    });

    it('should throw a plural message for several roots', async () => {
      const renderer = new ViewRenderer();
      renderer.setEngine({ engine: { ejs: vi.fn() }, root: [makeDir(), makeDir()] });
      await expect(renderer.render('missing')).rejects.toThrow('directories');
    });

    it('should throw a singular message for one root', async () => {
      const renderer = new ViewRenderer();
      renderer.setEngine({ engine: { ejs: vi.fn() }, root: makeDir() });
      await expect(renderer.render('missing')).rejects.toThrow('directory');
    });
  });
});
