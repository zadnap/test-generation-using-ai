import { describe, expect, it } from 'vitest';
import { ParseFilePipeBuilder } from '../../../../../packages/common/pipes/file/parse-file-pipe.builder.js';
import { MaxFileSizeValidator } from '../../../../../packages/common/pipes/file/max-file-size.validator.js';
import { FileTypeValidator } from '../../../../../packages/common/pipes/file/file-type.validator.js';

describe('ParseFilePipeBuilder', () => {
  it('adds a max size validator and returns the builder', () => {
    const builder = new ParseFilePipeBuilder();
    expect(builder.addMaxSizeValidator({ maxSize: 10 })).toBe(builder);
  });

  it('adds a file type validator and returns the builder', () => {
    const builder = new ParseFilePipeBuilder();
    expect(builder.addFileTypeValidator({ fileType: 'png' })).toBe(builder);
  });

  it('adds custom validators and returns the builder', () => {
    const builder = new ParseFilePipeBuilder();
    const validator = new MaxFileSizeValidator({ maxSize: 10 });
    expect(builder.addValidator(validator)).toBe(builder);
  });

  it('builds a pipe with all validators and resets the builder', () => {
    const builder = new ParseFilePipeBuilder();
    builder
      .addMaxSizeValidator({ maxSize: 10 })
      .addFileTypeValidator({ fileType: 'png' });

    const pipe = builder.build();
    const validators = (pipe as any).getValidators();
    expect(validators).toHaveLength(2);
    expect(validators[0]).toBeInstanceOf(MaxFileSizeValidator);
    expect(validators[1]).toBeInstanceOf(FileTypeValidator);

    const nextPipe = builder.build();
    expect((nextPipe as any).getValidators()).toHaveLength(0);
  });

  it('passes additional parse-file options to the built pipe', () => {
    const builder = new ParseFilePipeBuilder();
    const pipe = builder.build({ fileIsRequired: false });
    expect((pipe as any).fileIsRequired).toBe(false);
  });
});
