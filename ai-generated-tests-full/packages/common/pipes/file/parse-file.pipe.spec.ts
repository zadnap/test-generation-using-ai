import { describe, expect, it } from 'vitest';
import { ParseFilePipe } from '../../../../../packages/common/pipes/file/parse-file.pipe.js';
import { FileValidator } from '../../../../../packages/common/pipes/file/file-validator.interface.js';

class StubValidator extends FileValidator<{ valid: boolean; message: string }> {
  isValid(): boolean {
    return this.validationOptions.valid;
  }
  buildErrorMessage(): string {
    return this.validationOptions.message;
  }
}

class BuilderReturningValidator extends FileValidator<any> {
  isValid(): boolean {
    return true;
  }
  buildErrorMessage(): string {
    return '';
  }
}

describe('ParseFilePipe', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty array', []],
    ['empty object', {}],
  ])('throws for required %s values', async (_label, value) => {
    await expect(new ParseFilePipe().transform(value)).rejects.toThrow(
      'File is required',
    );
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty array', []],
    ['empty object', {}],
  ])('returns %s when the file is not required', async (_label, value) => {
    await expect(
      new ParseFilePipe({ fileIsRequired: false }).transform(value),
    ).resolves.toBe(value);
  });

  it('returns the value when no validators are configured', async () => {
    const value = { size: 1, mimetype: 'x' };
    await expect(new ParseFilePipe().transform(value)).resolves.toBe(value);
  });

  it('validates a single file', async () => {
    const file = { size: 1, mimetype: 'x' };
    const pipe = new ParseFilePipe({
      validators: [new StubValidator({ valid: true, message: '' })],
    });
    await expect(pipe.transform(file)).resolves.toBe(file);
  });

  it('validates an array of files', async () => {
    const files = [
      { size: 1, mimetype: 'x' },
      { size: 2, mimetype: 'y' },
    ];
    const pipe = new ParseFilePipe({
      validators: [new StubValidator({ valid: true, message: '' })],
    });
    await expect(pipe.transform(files)).resolves.toBe(files);
  });

  it('throws with the validator message for an invalid file', async () => {
    const pipe = new ParseFilePipe({
      validators: [new StubValidator({ valid: false, message: 'invalid file' })],
    });
    await expect(pipe.transform({ size: 1, mimetype: 'x' })).rejects.toThrow(
      'invalid file',
    );
  });

  it('supports custom exception factories', async () => {
    const pipe = new ParseFilePipe({
      exceptionFactory: message => new Error(`custom:${message}`),
    });
    await expect(pipe.transform(undefined)).rejects.toThrow(
      'custom:File is required',
    );
  });

  it('passes validators through getValidators', () => {
    const validator = new BuilderReturningValidator({});
    const pipe = new ParseFilePipe({ validators: [validator] });
    expect(pipe.getValidators()).toEqual([validator]);
  });
});
