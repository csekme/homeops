import { type LoginInput } from '@homeops/validation';
import { type UseFormReturn } from 'react-hook-form';
interface UseLoginForm {
    form: UseFormReturn<LoginInput>;
    onSubmit: (e?: React.BaseSyntheticEvent) => void;
    isPending: boolean;
    isError: boolean;
    errorKey: string;
}
export declare function useLoginForm(redirectTo?: string): UseLoginForm;
export {};
