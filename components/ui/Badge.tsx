import { type HTMLAttributes } from "react";
import styled from "@emotion/styled";
import { css, type Theme } from "@emotion/react";

type Tone = "blue" | "gray" | "green" | "red";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneStyle = (theme: Theme, tone: Tone) =>
  ({
    blue: css`
      background-color: ${theme.colors.blue[50]};
      color: ${theme.colors.blue[600]};
    `,
    gray: css`
      background-color: ${theme.colors.gray[100]};
      color: ${theme.colors.gray[600]};
    `,
    green: css`
      background-color: ${theme.colors.green[50]};
      color: ${theme.colors.green[600]};
    `,
    red: css`
      background-color: ${theme.colors.red[50]};
      color: ${theme.colors.red[500]};
    `,
  })[tone];

const StyledBadge = styled.span<{ $tone: Tone }>`
  display: inline-flex;
  align-items: center;
  border-radius: ${({ theme }) => theme.radius.full};
  padding: 0.25rem 0.625rem;
  font-size: 12px;
  font-weight: 500;

  ${({ theme, $tone }) => toneStyle(theme, $tone)}
`;

export function Badge({ tone = "gray", ...props }: BadgeProps) {
  return <StyledBadge $tone={tone} {...props} />;
}
