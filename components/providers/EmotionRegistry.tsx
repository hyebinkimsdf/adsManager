"use client";

import { useState } from "react";
import { useServerInsertedHTML } from "next/navigation";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";

// Emotion의 기본(레지스트리 없는) SSR 동작은 css prop을 쓰는 컴포넌트마다 <style> 태그를
// 트리 안에 즉석으로 끼워 넣는다. App Router 스트리밍/정적 렌더링에서는 이 방식이 서버 트리와
// 클라이언트 첫 렌더 트리를 구조적으로 어긋나게 만들어 hydration mismatch를 낸다
// (https://github.com/emotion-js/emotion/issues/2928, Next.js CSS-in-JS 가이드에도 명시된 이슈).
// 대신 하나의 캐시에 스타일을 모아뒀다가 useServerInsertedHTML로 <head>에 한 번에 흘려보내면
// 트리 구조가 서버/클라이언트에서 항상 동일해진다.
export function EmotionRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "css" });
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = "";
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style key={cache.key} data-emotion={`${cache.key} ${names.join(" ")}`} dangerouslySetInnerHTML={{ __html: styles }} />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
