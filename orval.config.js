/**
 * OpenAPI → types + api-client codegen (spec §5.9, plan §3.11).
 *
 * Input is the pinned `openapi.snapshot.json` so CI is deterministic; `pnpm codegen:fetch`
 * refreshes it from a running backend. Output: react-query hooks into `@homeops/api-client`
 * and DTO schemas into `@homeops/types`, all routed through the custom fetch mutator
 * (memory token + `/api` base + `credentials: include`).
 *
 * Phase 0 status: the hand-written interim client in `packages/api-client/src/{auth,http}.ts`
 * is active; this config is the seam to switch to generated hooks once the backend's
 * auth+household+obligation+expense endpoints are stable.
 */
import { defineConfig } from 'orval';
export default defineConfig({
    homeops: {
        input: {
            target: './openapi.snapshot.json',
        },
        output: {
            mode: 'tags-split',
            client: 'react-query',
            target: './packages/api-client/src/generated',
            schemas: './packages/types/src/generated',
            clean: true,
            prettier: true,
            override: {
                mutator: {
                    path: './packages/api-client/src/orval-mutator.ts',
                    name: 'customInstance',
                },
                query: {
                    useQuery: true,
                    useMutation: true,
                },
            },
        },
    },
});
