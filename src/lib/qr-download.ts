/** Saves the QR code SVG inside `container` as a 1200px PNG named `filename`. */
export const downloadQrPng = async (
  container: HTMLElement,
  filename: string,
): Promise<void> => {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('No QR code to download')

  const size = 1200
  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute('width', String(size))
  clone.setAttribute('height', String(size))
  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    }),
  )

  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not draw the QR code'))
      image.src = svgUrl
    })

    // A white margin, so printers and scanners see the code's quiet zone.
    const margin = 80
    const canvas = document.createElement('canvas')
    canvas.width = size + margin * 2
    canvas.height = size + margin * 2
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not draw the QR code')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, margin, margin, size, size)

    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('Could not save the QR code')),
        'image/png',
      ),
    )
    const link = document.createElement('a')
    link.href = URL.createObjectURL(png)
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
