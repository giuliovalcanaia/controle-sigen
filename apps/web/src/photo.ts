/** Lado da foto guardada: 3× o círculo de 44 px, suficiente em telas retina. */
const MAX_SIDE = 512;
const QUALITY = 0.82;

/**
 * Recorte quadrado central. Fica separado para poder testar sem DOM:
 * a foto é cortada no centro, então o animal não aparece esticado.
 */
export function squareCropRect(
  width: number,
  height: number,
): { x: number; y: number; size: number } {
  const size = Math.min(width, height);
  return {
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
    size,
  };
}

/**
 * Lê a foto escolhida, recorta no centro e devolve um JPEG pequeno.
 * Reduzir no celular evita mandar 5 MB pela rede e, de quebra, o
 * reencode remove o EXIF (inclusive a localização da foto).
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;

    try {
      await image.decode();
    } catch {
      throw new Error("Não consegui abrir essa foto. Tente escolher outra.");
    }

    // naturalWidth/Height já vêm com a orientação EXIF aplicada.
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
      throw new Error("Não consegui abrir essa foto. Tente escolher outra.");
    }

    const { x, y, size } = squareCropRect(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = MAX_SIDE;
    canvas.height = MAX_SIDE;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não consegui preparar a foto.");

    context.drawImage(image, x, y, size, size, 0, 0, MAX_SIDE, MAX_SIDE);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", QUALITY);
    });
    if (!blob) throw new Error("Não consegui preparar a foto.");

    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
