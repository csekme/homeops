import { useMe } from '@homeops/api-client';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Splash } from '@/components/splash';
import { useAuthBoot } from '@/lib/auth';
/**
 * Route guard (plan §3.12). Waits for the boot refresh, then uses `useMe`
 * (enabled only after boot) to decide. Unauthenticated → redirect to /login.
 */
export function RequireAuth() {
    const { booted } = useAuthBoot();
    const location = useLocation();
    const { data: user, isLoading, isError } = useMe({ enabled: booted });
    if (!booted || (isLoading && !user)) {
        return <Splash />;
    }
    if (isError || !user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
    }
    return <Outlet />;
}
