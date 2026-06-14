import { describe, it, expect } from "vitest";
import { resources, ns, supportedLngs } from "./index.js";
/** Collect the fully-qualified leaf key paths of a nested object. */
function leafKeys(obj, prefix = "") {
    if (obj === null || typeof obj !== "object") {
        return [prefix];
    }
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        keys.push(...leafKeys(value, path));
    }
    return keys.sort();
}
describe("i18n key parity", () => {
    for (const namespace of ns) {
        it(`HU and EN have identical keys in "${namespace}"`, () => {
            const hu = leafKeys(resources.hu[namespace]);
            const en = leafKeys(resources.en[namespace]);
            expect(en).toEqual(hu);
        });
    }
    it("every supported language has every namespace", () => {
        for (const lng of supportedLngs) {
            for (const namespace of ns) {
                expect(resources[lng][namespace]).toBeDefined();
            }
        }
    });
    it("common.appName is HomeOps in every language", () => {
        for (const lng of supportedLngs) {
            expect(resources[lng].common.appName).toBe("HomeOps");
        }
    });
});
