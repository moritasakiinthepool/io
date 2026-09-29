// 響き(IR)の計算は重いので、画面を止めないよう Worker で行う
import { renderRoom } from './room-model.js';

self.onmessage = (e) => {
  const { id, spec, sampleRate, opts } = e.data;
  const result = renderRoom(spec, sampleRate, opts);
  self.postMessage({ id, ...result }, [result.ir[0].buffer, result.ir[1].buffer]);
};
