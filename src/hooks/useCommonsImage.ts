import { useEffect, useState } from 'react';
import { findKnowledgeImage, type FoundImage } from '../services/commonsImage';

/**
 * 概念配图兜底：当概念既没有权威图直链（image）、也没有内联 SVG 时，
 * 才按 AI 给出的关键词去检索一张标准示意图（免费、无需 Key）。
 *
 * 关键词语言由 AI 自己决定 —— 中文词走中文源、英文词走 Commons，
 * 见 services/commonsImage.ts 的路由规则。
 *
 * enabled=false 时完全不发请求，避免无谓的跨域调用；
 * 组件卸载时中断请求，避免 setState 警告。
 */
export function useKnowledgeImage(query: string | undefined, enabled: boolean): FoundImage | null {
  const [image, setImage] = useState<FoundImage | null>(null);

  useEffect(() => {
    if (!enabled || !query) {
      setImage(null);
      return;
    }
    let alive = true;
    const ctrl = new AbortController();
    setImage(null);
    findKnowledgeImage(query, ctrl.signal).then((found) => {
      if (alive) setImage(found);
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [query, enabled]);

  return image;
}

/** 兼容旧命名 */
export const useCommonsImage = useKnowledgeImage;
