import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          backgroundColor: '#f5efe6',
          color: '#111111',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '30px',
            fontWeight: 800,
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#fb923c',
              border: '4px solid #111111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 900,
            }}
          >
            P
          </div>
          Pulse
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              fontSize: '62px',
              fontWeight: 900,
              lineHeight: 1.05,
              whiteSpace: 'pre-line',
            }}
          >
            {"Hear your customers,\n don't just read them."}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 600, maxWidth: '900px' }}>
            QR-based voice feedback with instant transcription and saved audio.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '18px',
            fontSize: '22px',
            fontWeight: 800,
          }}
        >
          Limited time: 3 free pulses
        </div>
      </div>
    ),
    size,
  )
}
