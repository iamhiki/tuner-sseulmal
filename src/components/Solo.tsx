import type { ComponentChildren } from "preact";
import { Mascot, type Pose } from "./Mascot.tsx";

/** 쓸말이 + 제목 + 본문 한 판. 시작·장치 선택·오류 화면이 같은 틀을 쓴다. */
export function Solo({
  pose,
  title,
  children,
}: {
  pose: Pose;
  title: string;
  children: ComponentChildren;
}) {
  return (
    <section class="box solo">
      <div class={`anim a-${pose}`}>
        <Mascot pose={pose} size={220} />
      </div>
      <div>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}
