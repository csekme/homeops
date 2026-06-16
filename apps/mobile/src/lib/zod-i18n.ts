/**
 * Global Zod error map → i18n (plan §M2), the RN port of `apps/web/src/lib/zod-i18n.ts`.
 * The shared `@homeops/validation` schemas omit human messages on purpose; this maps Zod
 * issue *codes* to localized strings from the `validation` namespace. Imported for
 * side-effect after i18n init.
 */
import { z } from 'zod';

import i18n from './i18n';

const tv = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(key, { ns: 'validation', ...opts });

const errorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: tv('required') };
      }
      return { message: tv('invalid') };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return {
          message:
            Number(issue.minimum) <= 1
              ? tv('required')
              : tv('minLength', { min: Number(issue.minimum) }),
        };
      }
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: tv('maxLength', { max: Number(issue.maximum) }) };
      }
      break;
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: tv('email') };
      break;
    default:
      break;
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(errorMap);
