import { useMemo } from "react";
import { spriteURL } from "./sprites.js";

/* 픽셀맵 + 팔레트를 캔버스로 구워서 img 로 그립니다.
   cacheKey 가 같으면 같은 그림을 다시 쓰고, 크기는 CSS 로만 키웁니다. */
export function Pix({ map, palette, scale, cacheKey, className, style, alt = "" }) {
  const url = useMemo(() => spriteURL(map, palette, cacheKey), [map, palette, cacheKey]);
  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className={"ccPix " + (className || "")}
      style={{ width: map[0].length * scale, height: map.length * scale, ...style }}
    />
  );
}
