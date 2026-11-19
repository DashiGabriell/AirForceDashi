import { generateChunkMesh } from "@afd/game-core";

type Req = { id: number; cx: number; cz: number };

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (ev: MessageEvent<Req>) => {
  const { id, cx, cz } = ev.data;
  const data = generateChunkMesh(cx, cz);
  ctx.postMessage(
    {
      id,
      cx,
      cz,
      vertices: data.vertices,
      indices: data.indices,
      res: data.res,
    },
    [data.vertices.buffer, data.indices.buffer],
  );
};
