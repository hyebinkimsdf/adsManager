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
