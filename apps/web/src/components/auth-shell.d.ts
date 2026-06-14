interface AuthShellProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}
/** Centered card layout shared by the auth pages (plan §3.13). */
export declare function AuthShell({ title, description, children, footer }: AuthShellProps): import("react").JSX.Element;
export {};
