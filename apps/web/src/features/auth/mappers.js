export function toLoginRequest(values) {
    return { email: values.email, password: values.password };
}
export function toRegisterRequest(values, locale) {
    return {
        email: values.email,
        password: values.password,
        display_name: values.displayName,
        locale,
    };
}
