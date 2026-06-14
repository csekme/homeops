/**
 * Account activation logic. Modeled as a query keyed by token so it runs exactly once
 * per token and is cached — robust under React StrictMode's mount/unmount/mount (a
 * `useMutation` + ref guard there leaves a fresh, idle observer and the UI hangs on
 * "pending"). Returns a single derived status the page renders from.
 */
import { activate } from '@homeops/api-client';
import { useQuery } from '@tanstack/react-query';
export function useActivation(token) {
    const query = useQuery({
        queryKey: ['auth', 'activate', token],
        queryFn: () => activate({ token: token }),
        enabled: Boolean(token),
        retry: false,
        staleTime: Infinity,
        gcTime: Infinity,
    });
    if (!token || query.isError)
        return 'error';
    if (query.isSuccess)
        return 'success';
    return 'pending';
}
