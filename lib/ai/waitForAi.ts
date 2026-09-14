/** 호출자의 대기만 제한한다. 공유 모델 다운로드를 취소하지 않는다. */
export function waitForAi<T>(promise: Promise<T>, { signal, timeoutMs }: { signal?: AbortSignal; timeoutMs: number }): Promise<T> {
  return new Promise((resolve, reject) => {
    const finish = (callback: () => void) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException("AI request cancelled", "AbortError")));
    const timer = setTimeout(() => finish(() => reject(new DOMException("AI wait timed out", "TimeoutError"))), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    // 대기가 이미 취소된 경우에도 원래 promise의 rejection을 처리한다.
    promise.then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
    if (signal?.aborted) onAbort();
  });
}
