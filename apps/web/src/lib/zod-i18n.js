/**
 * Global Zod error map → i18n (fixes English validation messages on HU/EN UI).
 *
 * The shared `@homeops/validation` schemas omit human-readable messages on user-facing
 * fields on purpose; this map turns the Zod issue *codes* into localized strings from the
 * `validation` namespace. Imported for side-effect in `main.tsx` after i18n init.
 */
import { z } from 'zod';
import i18n from '@/lib/i18n';
const tv = (key, opts) => i18n.t(key, { ns: 'validation', ...opts });
const errorMap = (issue, ctx) => {
    switch (issue.code) {
        case z.ZodIssueCode.invalid_type:
            if (issue.received === 'undefined' || issue.received === 'null') {
                return { message: tv('required') };
            }
            return { message: tv('invalid') };
        case z.ZodIssueCode.too_small:
            if (issue.type === 'string') {
                return {
                    message: Number(issue.minimum) <= 1
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
            if (issue.validation === 'email')
                return { message: tv('email') };
            break;
        default:
            break;
    }
    return { message: ctx.defaultError };
};
z.setErrorMap(errorMap);
