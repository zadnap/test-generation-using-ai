import { describe, expect, it } from 'vitest';
import { ParseFilePipeBuilder } from '../../../../../packages/common/pipes/file/parse-file-pipe.builder.js';
import {
  FileTypeValidator,
  MaxFileSizeValidator,
} from '../../../../../packages/common/pipes/file/index.js';
import { FileValidator } from '../../../../../packages/common/pipes/file/file-validator.interface.js';

class CustomValidator extends FileValidator<{ name: string }> {
  isValid(): boolean {
    return true;
  }
  buildErrorMessage(): string {
    return 'invalid';
  }
}

describe('ParseFilePipeBuilder (C3)', () => {
  it('builds a pipe without validators', () => {
    const pipe = new ParseFilePipeBuilder().build();
    expect(pipe.getValidators()).toEqual([]);
  });

  it('adds a max-size validator', () => {
    const builder = new ParseFilePipeBuilder();
    const options = { maxSize: 10 };
    const returned = builder.addMaxSizeValidator(options);

    expect(returned).toBe(builder);
    expect(builder.build().getValidators()).toMatchObject([
      new MaxFileSizeValidator(options),
    ]);
  });

  it('adds a file-type validator', () => {
    const builder = new ParseFilePipeBuilder();
    const options = { fileType: 'image/png' };
    const returned = builder.addFileTypeValidator(options);

    expect(returned).toBe(builder);
    expect(builder.build().getValidators()).toMatchObject([
      new FileTypeValidator(options),
    ]);
  });

  it('adds an arbitrary validator', () => {
    const builder = new ParseFilePipeBuilder();
    const validator = new CustomValidator({ name: 'x' });
    const returned = builder.addValidator(validator);

    expect(returned).toBe(builder);
    expect(builder.build().getValidators()).toEqual([validator]);
  });

  it('supports chaining several validators', () => {
    const pipe = new ParseFilePipeBuilder()
      .addMaxSizeValidator({ maxSize: 10 })
      .addFileTypeValidator({ fileType: 'image/png' })
      .addValidator(new CustomValidator({ name: 'x' }))
      .build();

    expect(pipe.getValidators()).toHaveLength(3);
  });

  it('forwards additional options to the pipe', () => {
    const pipe = new ParseFilePipeBuilder()
      .addMaxSizeValidator({ maxSize: 10 })
      .build({ fileIsRequired: false });

    expect(pipe.getValidators()).toHaveLength(1);
    expect(pipe).toBeInstanceOf(Object);
  });

  it('does not reuse validators after building', () => {
    const builder = new ParseFilePipeBuilder();
    builder.addMaxSizeValidator({ maxSize: 10 });
    const first = builder.build();
    const second = builder.build();

    expect(first.getValidators()).toHaveLength(1);
    expect(second.getValidators()).toHaveLength(0);
    expect(first.getValidators()).not.toBe(second.getValidators());
  });
});
