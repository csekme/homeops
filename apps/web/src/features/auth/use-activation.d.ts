export type ActivationStatus = 'pending' | 'success' | 'error';
export declare function useActivation(token: string | undefined): ActivationStatus;
