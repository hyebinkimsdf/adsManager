import styled from "@emotion/styled";

export const Skeleton = styled.div`
  border-radius: ${({ theme }) => theme.radius.sm};
  background-color: ${({ theme }) => theme.colors.gray[100]};
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;
