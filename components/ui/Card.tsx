import styled from "@emotion/styled";

export const Card = styled.div`
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.25rem;
  box-shadow: ${({ theme }) => theme.shadow.card};
`;

export const CardHeader = styled.div`
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const CardTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray[800]};
`;
