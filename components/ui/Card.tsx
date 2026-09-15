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

// 페이지의 h1(캠페인 이름 등) 바로 아래 단계 — h3로 두면 중간 단계(h2) 없이 건너뛴다는
// 접근성 감사(heading order)에 걸린다. 이 컴포넌트 아래에 더 깊은 소제목이 없어 h2로 충분하다.
export const CardTitle = styled.h2`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray[800]};
`;
