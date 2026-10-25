import { describe, expect, it } from "vitest";
import { squareCropRect } from "./photo";

describe("squareCropRect", () => {
  it("corta o centro de uma foto em pé", () => {
    // 1200×1600 (retrato): o quadrado tem 1200 e sobra 200 em cima e embaixo.
    expect(squareCropRect(1200, 1600)).toEqual({ x: 0, y: 200, size: 1200 });
  });

  it("corta o centro de uma foto deitada", () => {
    expect(squareCropRect(1600, 1200)).toEqual({ x: 200, y: 0, size: 1200 });
  });

  it("não mexe em foto já quadrada", () => {
    expect(squareCropRect(800, 800)).toEqual({ x: 0, y: 0, size: 800 });
  });

  it("arredonda sobras ímpares sem sair da imagem", () => {
    const { x, y, size } = squareCropRect(1001, 800);
    expect(size).toBe(800);
    expect(x + size).toBeLessThanOrEqual(1001);
    expect(y + size).toBeLessThanOrEqual(800);
    expect(x).toBe(101);
  });
});
