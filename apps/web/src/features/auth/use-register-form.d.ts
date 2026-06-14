import { type RegisterInput } from '@homeops/validation';
import { type UseFormReturn } from 'react-hook-form';
interface UseRegisterForm {
    form: UseFormReturn<RegisterInput>;
    onSubmit: (e?: React.BaseSyntheticEvent) => void;
    isPending: boolean;
    isError: boolean;
    isSuccess: boolean;
}
export declare function useRegisterForm(): UseRegisterForm;
export {};
