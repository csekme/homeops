'use client';
import React from 'react';
import { createButton } from '@gluestack-ui/core/button/creator';
import {
  tva,
  withStyleContext,
  useStyleContext,
  type VariantProps,
} from '@gluestack-ui/utils/nativewind-utils';
import { cssInterop } from 'nativewind';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { PrimitiveIcon, UIIcon } from '@gluestack-ui/core/icon/creator';

const SCOPE = 'BUTTON';

const Root = withStyleContext(Pressable, SCOPE);

const UIButton = createButton({
  Root: Root,
  Text,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: UIIcon,
});

cssInterop(PrimitiveIcon, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: true,
      width: true,
      fill: true,
      color: 'classNameColor',
      stroke: true,
    },
  },
});

const buttonStyle = tva({
  base: 'group/button rounded-xl bg-primary flex-row items-center justify-center data-[focus-visible=true]:web:outline-none data-[focus-visible=true]:web:ring-2 data-[disabled=true]:opacity-40 gap-2',
  variants: {
    action: {
      primary:
        'bg-primary border-primary data-[hover=true]:bg-primary/90 data-[active=true]:bg-primary/80 data-[focus-visible=true]:web:ring-ring',
      secondary:
        'bg-secondary border-border data-[hover=true]:bg-secondary/80 data-[active=true]:bg-secondary/70 data-[focus-visible=true]:web:ring-ring',
      positive:
        'bg-success border-success data-[hover=true]:bg-success/90 data-[active=true]:bg-success/80 data-[focus-visible=true]:web:ring-ring',
      negative:
        'bg-destructive border-destructive data-[hover=true]:bg-destructive/90 data-[active=true]:bg-destructive/80 data-[focus-visible=true]:web:ring-ring',
      default:
        'bg-transparent data-[hover=true]:bg-muted data-[active=true]:bg-transparent',
    },
    variant: {
      link: 'px-0',
      outline:
        'bg-transparent border data-[hover=true]:bg-muted data-[active=true]:bg-transparent',
      solid: '',
    },

    size: {
      xs: 'px-3.5 h-8',
      sm: 'px-4 h-9',
      md: 'px-5 h-10',
      lg: 'px-6 h-11',
      xl: 'px-7 h-12',
    },
  },
  compoundVariants: [
    {
      action: 'primary',
      variant: 'link',
      class:
        'px-0 bg-transparent data-[hover=true]:bg-transparent data-[active=true]:bg-transparent',
    },
    {
      action: 'secondary',
      variant: 'link',
      class:
        'px-0 bg-transparent data-[hover=true]:bg-transparent data-[active=true]:bg-transparent',
    },
    {
      action: 'positive',
      variant: 'link',
      class:
        'px-0 bg-transparent data-[hover=true]:bg-transparent data-[active=true]:bg-transparent',
    },
    {
      action: 'negative',
      variant: 'link',
      class:
        'px-0 bg-transparent data-[hover=true]:bg-transparent data-[active=true]:bg-transparent',
    },
    {
      action: 'primary',
      variant: 'outline',
      class:
        'bg-transparent data-[hover=true]:bg-muted data-[active=true]:bg-transparent',
    },
    {
      action: 'secondary',
      variant: 'outline',
      class:
        'bg-transparent data-[hover=true]:bg-muted data-[active=true]:bg-transparent',
    },
    {
      action: 'positive',
      variant: 'outline',
      class:
        'bg-transparent data-[hover=true]:bg-muted data-[active=true]:bg-transparent',
    },
    {
      action: 'negative',
      variant: 'outline',
      class:
        'bg-transparent data-[hover=true]:bg-muted data-[active=true]:bg-transparent',
    },
  ],
});

const buttonTextStyle = tva({
  base: 'text-primary-foreground font-semibold web:select-none',
  parentVariants: {
    action: {
      primary:
        'text-primary data-[hover=true]:text-primary data-[active=true]:text-primary',
      secondary:
        'text-foreground data-[hover=true]:text-foreground data-[active=true]:text-foreground',
      positive:
        'text-success data-[hover=true]:text-success data-[active=true]:text-success',
      negative:
        'text-destructive data-[hover=true]:text-destructive data-[active=true]:text-destructive',
    },
    variant: {
      link: 'data-[hover=true]:underline data-[active=true]:underline',
      outline: '',
      solid:
        'text-primary-foreground data-[hover=true]:text-primary-foreground data-[active=true]:text-primary-foreground',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
    },
  },
  parentCompoundVariants: [
    {
      variant: 'solid',
      action: 'primary',
      class:
        'text-primary-foreground data-[hover=true]:text-primary-foreground data-[active=true]:text-primary-foreground',
    },
    {
      variant: 'solid',
      action: 'secondary',
      class:
        'text-secondary-foreground data-[hover=true]:text-secondary-foreground data-[active=true]:text-secondary-foreground',
    },
    {
      variant: 'solid',
      action: 'positive',
      class:
        'text-success-foreground data-[hover=true]:text-success-foreground data-[active=true]:text-success-foreground',
    },
    {
      variant: 'solid',
      action: 'negative',
      class:
        'text-destructive-foreground data-[hover=true]:text-destructive-foreground data-[active=true]:text-destructive-foreground',
    },
    {
      variant: 'outline',
      action: 'primary',
      class:
        'text-primary data-[hover=true]:text-primary data-[active=true]:text-primary',
    },
    {
      variant: 'outline',
      action: 'secondary',
      class:
        'text-foreground data-[hover=true]:text-foreground data-[active=true]:text-foreground',
    },
    {
      variant: 'outline',
      action: 'positive',
      class:
        'text-success data-[hover=true]:text-success data-[active=true]:text-success',
    },
    {
      variant: 'outline',
      action: 'negative',
      class:
        'text-destructive data-[hover=true]:text-destructive data-[active=true]:text-destructive',
    },
  ],
});

const buttonIconStyle = tva({
  base: 'fill-none',
  parentVariants: {
    variant: {
      link: 'data-[hover=true]:underline data-[active=true]:underline',
      outline: '',
      solid:
        'text-primary-foreground data-[hover=true]:text-primary-foreground data-[active=true]:text-primary-foreground',
    },
    size: {
      xs: 'h-3.5 w-3.5',
      sm: 'h-4 w-4',
      md: 'h-[18px] w-[18px]',
      lg: 'h-[18px] w-[18px]',
      xl: 'h-5 w-5',
    },
    action: {
      primary:
        'text-primary data-[hover=true]:text-primary data-[active=true]:text-primary',
      secondary:
        'text-foreground data-[hover=true]:text-foreground data-[active=true]:text-foreground',
      positive:
        'text-success data-[hover=true]:text-success data-[active=true]:text-success',

      negative:
        'text-destructive data-[hover=true]:text-destructive data-[active=true]:text-destructive',
    },
  },
  parentCompoundVariants: [
    {
      variant: 'solid',
      action: 'primary',
      class:
        'text-primary-foreground data-[hover=true]:text-primary-foreground data-[active=true]:text-primary-foreground',
    },
    {
      variant: 'solid',
      action: 'secondary',
      class:
        'text-secondary-foreground data-[hover=true]:text-secondary-foreground data-[active=true]:text-secondary-foreground',
    },
    {
      variant: 'solid',
      action: 'positive',
      class:
        'text-success-foreground data-[hover=true]:text-success-foreground data-[active=true]:text-success-foreground',
    },
    {
      variant: 'solid',
      action: 'negative',
      class:
        'text-destructive-foreground data-[hover=true]:text-destructive-foreground data-[active=true]:text-destructive-foreground',
    },
  ],
});

const buttonGroupStyle = tva({
  base: '',
  variants: {
    space: {
      'xs': 'gap-1',
      'sm': 'gap-2',
      'md': 'gap-3',
      'lg': 'gap-4',
      'xl': 'gap-5',
      '2xl': 'gap-6',
      '3xl': 'gap-7',
      '4xl': 'gap-8',
    },
    isAttached: {
      true: 'gap-0',
    },
    flexDirection: {
      'row': 'flex-row',
      'column': 'flex-col',
      'row-reverse': 'flex-row-reverse',
      'column-reverse': 'flex-col-reverse',
    },
  },
});

type IButtonProps = Omit<
  React.ComponentPropsWithoutRef<typeof UIButton>,
  'context'
> &
  VariantProps<typeof buttonStyle> & { className?: string };

const Button = React.forwardRef<
  React.ElementRef<typeof UIButton>,
  IButtonProps
>(
  (
    { className, variant = 'solid', size = 'md', action = 'primary', ...props },
    ref
  ) => {
    return (
      <UIButton
        ref={ref}
        {...props}
        className={buttonStyle({ variant, size, action, class: className })}
        context={{ variant, size, action }}
      />
    );
  }
);

type IButtonTextProps = React.ComponentPropsWithoutRef<typeof UIButton.Text> &
  VariantProps<typeof buttonTextStyle> & { className?: string };

const ButtonText = React.forwardRef<
  React.ElementRef<typeof UIButton.Text>,
  IButtonTextProps
>(({ className, variant, size, action, ...props }, ref) => {
  const {
    variant: parentVariant,
    size: parentSize,
    action: parentAction,
  } = useStyleContext(SCOPE);

  return (
    <UIButton.Text
      ref={ref}
      {...props}
      className={buttonTextStyle({
        parentVariants: {
          variant: parentVariant,
          size: parentSize,
          action: parentAction,
        },
        variant,
        size,
        action,
        class: className,
      })}
    />
  );
});

const ButtonSpinner = UIButton.Spinner;

type IButtonIcon = React.ComponentPropsWithoutRef<typeof UIButton.Icon> &
  VariantProps<typeof buttonIconStyle> & {
    className?: string | undefined;
    as?: React.ElementType;
    height?: number;
    width?: number;
  };

const ButtonIcon = React.forwardRef<
  React.ElementRef<typeof UIButton.Icon>,
  IButtonIcon
>(({ className, size, ...props }, ref) => {
  const {
    variant: parentVariant,
    size: parentSize,
    action: parentAction,
  } = useStyleContext(SCOPE);

  if (typeof size === 'number') {
    return (
      <UIButton.Icon
        ref={ref}
        {...props}
        className={buttonIconStyle({ class: className })}
        size={size}
      />
    );
  } else if (
    (props.height !== undefined || props.width !== undefined) &&
    size === undefined
  ) {
    return (
      <UIButton.Icon
        ref={ref}
        {...props}
        className={buttonIconStyle({ class: className })}
      />
    );
  }
  return (
    <UIButton.Icon
      {...props}
      className={buttonIconStyle({
        parentVariants: {
          size: parentSize,
          variant: parentVariant,
          action: parentAction,
        },
        size,
        class: className,
      })}
      ref={ref}
    />
  );
});

type IButtonGroupProps = React.ComponentPropsWithoutRef<typeof UIButton.Group> &
  VariantProps<typeof buttonGroupStyle>;

const ButtonGroup = React.forwardRef<
  React.ElementRef<typeof UIButton.Group>,
  IButtonGroupProps
>(
  (
    {
      className,
      space = 'md',
      isAttached = false,
      flexDirection = 'column',
      ...props
    },
    ref
  ) => {
    return (
      <UIButton.Group
        className={buttonGroupStyle({
          class: className,
          space,
          isAttached,
          flexDirection,
        })}
        {...props}
        ref={ref}
      />
    );
  }
);

Button.displayName = 'Button';
ButtonText.displayName = 'ButtonText';
ButtonSpinner.displayName = 'ButtonSpinner';
ButtonIcon.displayName = 'ButtonIcon';
ButtonGroup.displayName = 'ButtonGroup';

export { Button, ButtonText, ButtonSpinner, ButtonIcon, ButtonGroup };
