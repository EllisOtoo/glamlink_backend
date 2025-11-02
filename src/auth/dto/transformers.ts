import type { TransformFnParams } from 'class-transformer';

export const trimStringTransform = ({
  value,
}: TransformFnParams): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};
