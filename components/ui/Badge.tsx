import { type HTMLAttributes } from "react";
import styled from "@emotion/styled";
import { css, type Theme } from "@emotion/react";

type Tone = "blue" | "gray" | "green" | "red";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

// 배지 배경(각 색의 50/100 단계)은 아주 밝아서, 글자색은 각 색상의 가장 옅은 단계가 아니라
// 명암비 4.5:1을 실제로 채우는 진한 단계를 골라야 한다. gray-600·green-600·red-500은 이 배경들
// 위에서 각각 약 4.2:1·2.7:1·3.3:1로 기준에 못 미쳐 한 단계씩 더 진한 색을 쓴다.
const toneStyle = (theme: Theme, tone: Tone) =>
  ({
    blue: css`
      background-color: ${theme.colors.blue[50]};
      color: ${theme.colors.blue[600]};
    `,
    gray: css`
      background-color: ${theme.colors.gray[100]};
      color: ${theme.colors.gray[700]};
    `,
    green: css`
      background-color: ${theme.colors.green[50]};
      color: ${theme.colors.green[700]};
    `,
    red: css`
      background-color: ${theme.colors.red[50]};
      color: ${theme.colors.red[600]};
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
