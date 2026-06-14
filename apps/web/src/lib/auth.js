import { refreshAccessToken } from '@homeops/api-client';
import { createContext, useContext, useEffect, useState } from 'react';
const AuthBootContext = createContext({ booted: false });
export function AuthBootProvider({ children }) {
    const [booted, setBooted] = useState(false);
    useEffect(() => {
        let active = true;
        void refreshAccessToken().finally(() => {
            if (active)
                setBooted(true);
        });
        return () => {
            active = false;
        };
    }, []);
    return <AuthBootContext.Provider value={{ booted }}>{children}</AuthBootContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuthBoot() {
    return useContext(AuthBootContext);
}
