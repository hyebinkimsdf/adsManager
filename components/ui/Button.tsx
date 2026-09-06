import { type ButtonHTMLAttributes, forwardRef } from "react";
import styled from "@emotion/styled";
import { css, type Theme } from "@emotion/react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyle = (theme: Theme, variant: Variant) =>
  ({
    primary: css`
      background-color: ${theme.colors.blue[500]};
      color: white;
      &:hover:not(:disabled) {
        background-color: ${theme.colors.blue[600]};
      }
      &:active:not(:disabled) {
        background-color: ${theme.colors.blue[700]};
      }
      &:disabled {
        background-color: ${theme.colors.gray[200]};
        color: ${theme.colors.gray[400]};
      }
    `,
    secondary: css`
      background-color: ${theme.colors.gray[100]};
      color: ${theme.colors.gray[800]};
      &:hover:not(:disabled) {
        background-color: ${theme.colors.gray[200]};
      }
      &:disabled {
        color: ${theme.colors.gray[400]};
      }
    `,
    ghost: css`
      background-color: transparent;
      color: ${theme.colors.gray[700]};
      &:hover:not(:disabled) {
        background-color: ${theme.colors.gray[100]};
      }
      &:disabled {
        color: ${theme.colors.gray[400]};
      }
    `,
    danger: css`
      background-color: ${theme.colors.red[50]};
      color: ${theme.colors.red[500]};
      &:hover:not(:disabled) {
        background-color: #fbdcda;
      }
      &:disabled {
        color: ${theme.colors.gray[400]};
      }
    `,
  })[variant];

const sizeStyle: Record<Size, ReturnType<typeof css>> = {
  sm: css`
    height: 2.25rem;
    padding: 0 0.75rem;
    font-size: 13px;
    gap: 0.375rem;
  `,
  md: css`
    height: 2.75rem;
    padding: 0 1rem;
    font-size: 14px;
    gap: 0.5rem;
  `,
  lg: css`
    height: 3.25rem;
    padding: 0 1.25rem;
    font-size: 15px;
    gap: 0.5rem;
  `,
};

const StyledButton = styled.button<{ $variant: Variant; $size: Size }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-weight: 600;
  transition: background-color ${({ theme }) => theme.motion.duration.fast};

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px white, 0 0 0 4px ${({ theme }) => theme.colors.blue[500]};
  }

  &:disabled {
    cursor: not-allowed;
  }

  ${({ theme, $variant }) => variantStyle(theme, $variant)}
  ${({ $size }) => sizeStyle[$size]}
`;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", ...props }, ref) => {
    return <StyledButton ref={ref} $variant={variant} $size={size} {...props} />;
  }
);
Button.displayName = "Button";
