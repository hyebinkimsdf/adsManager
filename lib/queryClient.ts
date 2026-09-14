import { QueryClient } from "@tanstack/react-query";

// 브라우저에서만 동작하는 CSR 전용 앱이라 요청마다 새로 만들 필요 없이 싱글턴으로 공유한다.
// 컴포넌트 밖(applyAction 등 순수 함수)에서도 캐시를 직접 갱신할 수 있어야 하므로 export한다.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// 캠페인 계열만 짧은 재방문에서 재사용한다. 다른 실시간 조회의 정책은 바꾸지 않는다.
// 만료는 다음 마운트/재연결에서 재조회할 기준이며, 30초 주기 폴링이 아니다.
queryClient.setQueryDefaults(["campaigns"], { staleTime: 30_000 });
