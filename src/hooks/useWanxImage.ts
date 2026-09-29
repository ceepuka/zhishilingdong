import { useEffect, useState } from 'react';
import { generateImageByWanx, isWanxConfigured, type GeneratedImage } from '../services/wanxImage';

/**
 * 生图兜底 Hook：当 AI 拿不到可靠真实图、但给出了 imageQuery 时，
 * 用通义万相按关键词生成一张示意图。
 *
 * - 未配置 wanx → 完全不发请求
 * - enabled=false → 不发请求
 * - 失败静默返回 null，绝不阻塞渲染
 */
export function useWanxImage(query: string | undefined, enabled: boolean): GeneratedImage | null {
  const [result, setResult] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    if (!enabled || !query || !isWanxConfigured()) {
      setResult(null);
      return;
    }
    let alive = true;
    setResult(null);
    generateImageByWanx(query).then((res) => {
      if (alive) setResult(res);
    });
    return () => {
      alive = false;
    };
  }, [query, enabled]);

  return result;
}
